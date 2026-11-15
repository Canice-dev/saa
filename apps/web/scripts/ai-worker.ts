import "dotenv/config";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { businessSettings, conversations, customers, messages, outboxEvents } from "@/lib/db/schema";
import { sendWhatsAppText, WhatsAppSendError } from "@/lib/integrations/meta/whatsapp-send";

const POLL_INTERVAL_MS = 3_000;
const JOB_LEASE_SECONDS = 120;
const MAX_ATTEMPTS = 5;
const MAX_RETRY_DELAY_SECONDS = 300;
const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const REPLY_TEXT = "Hello Sales Assistant, how can I help today?";

type ClaimedReplyJob = {
  id: string;
  aggregate_id: string;
  payload: unknown;
  attempts: number;
};

type ReplyPayload = {
  inboundMessageId: string;
  generation: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseReplyPayload(value: unknown): ReplyPayload | null {
  if (!isObject(value)) return null;
  if (typeof value.inboundMessageId !== "string" || typeof value.generation !== "number") return null;
  return { inboundMessageId: value.inboundMessageId, generation: value.generation };
}

async function claimNextJob(): Promise<ClaimedReplyJob | undefined> {
  const result = await getDatabase().execute(sql`
    WITH recovered_jobs AS (
      UPDATE outbox_events
      SET status = 'pending'
      WHERE event_type = 'reply_due'
        AND status = 'processing'
        AND available_at <= now()
    ), candidate AS (
      SELECT event.id
      FROM outbox_events AS event
      INNER JOIN business_settings AS settings
        ON settings.business_id = event.business_id
      WHERE event.event_type = 'reply_due'
        AND event.status = 'pending'
        AND event.available_at <= now()
        AND settings.automation_enabled = true
      ORDER BY event.available_at ASC, event.created_at ASC
      LIMIT 1
      FOR UPDATE OF event SKIP LOCKED
    ), claimed_job AS (
      UPDATE outbox_events AS event
      SET status = 'processing',
          attempts = event.attempts + 1,
          available_at = now() + make_interval(secs => ${JOB_LEASE_SECONDS})
      FROM candidate
      WHERE event.id = candidate.id
      RETURNING event.id, event.aggregate_id, event.payload, event.attempts
    )
    SELECT id, aggregate_id, payload, attempts FROM claimed_job
  `);

  return result.rows[0] as ClaimedReplyJob | undefined;
}

async function completeJob(jobId: string) {
  await getDatabase()
    .update(outboxEvents)
    .set({ status: "completed", processedAt: new Date() })
    .where(eq(outboxEvents.id, jobId));
}

async function retryJob(job: ClaimedReplyJob, error: unknown) {
  const failedPermanently = job.attempts >= MAX_ATTEMPTS;
  const retryDelaySeconds = Math.min(15 * 2 ** Math.max(0, job.attempts - 1), MAX_RETRY_DELAY_SECONDS);
  await getDatabase()
    .update(outboxEvents)
    .set({
      status: failedPermanently ? "failed" : "pending",
      availableAt: failedPermanently
        ? new Date()
        : new Date(Date.now() + retryDelaySeconds * 1000),
      processedAt: failedPermanently ? new Date() : null,
    })
    .where(eq(outboxEvents.id, job.id));

  console.error("AI worker job failed", {
    jobId: job.id,
    attempt: job.attempts,
    final: failedPermanently,
    errorType: error instanceof Error ? error.name : "UnknownError",
    ...(error instanceof WhatsAppSendError ? { provider: error.diagnostics } : {}),
  });
}

async function processJob(job: ClaimedReplyJob) {
  const payload = parseReplyPayload(job.payload);
  if (!payload) {
    await completeJob(job.id);
    console.warn("AI worker skipped a job with an invalid payload", job.id);
    return;
  }

  const [conversation] = await getDatabase()
    .select({
      id: conversations.id,
      channel: conversations.channel,
      state: conversations.state,
      automationPaused: conversations.automationPaused,
      responseGeneration: conversations.responseGeneration,
      recipientId: customers.externalUserId,
      automationEnabled: businessSettings.automationEnabled,
    })
    .from(conversations)
    .innerJoin(customers, eq(customers.id, conversations.customerId))
    .innerJoin(businessSettings, eq(businessSettings.businessId, conversations.businessId))
    .where(and(eq(conversations.id, job.aggregate_id), eq(conversations.businessId, 1)))
    .limit(1);

  if (
    !conversation ||
    !conversation.automationEnabled ||
    conversation.automationPaused ||
    conversation.state !== "open" ||
    conversation.channel !== "whatsapp" ||
    conversation.responseGeneration !== payload.generation
  ) {
    await completeJob(job.id);
    return;
  }

  const [latestInbound] = await getDatabase()
    .select({
      id: messages.id,
      receivedAt: messages.receivedAt,
      providerTimestamp: messages.providerTimestamp,
    })
    .from(messages)
    .where(and(eq(messages.conversationId, conversation.id), eq(messages.direction, "inbound")))
    .orderBy(desc(messages.receivedAt))
    .limit(1);

  if (!latestInbound || latestInbound.id !== payload.inboundMessageId) {
    await completeJob(job.id);
    return;
  }

  const inboundTime = latestInbound.providerTimestamp ?? latestInbound.receivedAt;
  const inboundAge = Date.now() - inboundTime.getTime();
  if (inboundAge < 0 || inboundAge >= CUSTOMER_SERVICE_WINDOW_MS) {
    await completeJob(job.id);
    return;
  }

  const [latestOutbound] = await getDatabase()
    .select({ receivedAt: messages.receivedAt })
    .from(messages)
    .where(and(eq(messages.conversationId, conversation.id), eq(messages.direction, "outbound")))
    .orderBy(desc(messages.receivedAt))
    .limit(1);

  if (latestOutbound && latestOutbound.receivedAt.getTime() > latestInbound.receivedAt.getTime()) {
    await completeJob(job.id);
    return;
  }

  const providerMessageId = await sendWhatsAppText(conversation.recipientId, REPLY_TEXT);
  await getDatabase()
    .insert(messages)
    .values({
      conversationId: conversation.id,
      provider: "meta",
      providerMessageId,
      senderRole: "assistant",
      direction: "outbound",
      messageType: "text",
      body: REPLY_TEXT,
      providerTimestamp: new Date(),
      deliveryStatus: "accepted",
    })
    .onConflictDoNothing();

  await getDatabase()
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversation.id));
  await completeJob(job.id);
  console.info("AI worker sent a reply", job.id);
}

const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));
let stopping = false;

process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");

  console.info("Inbox reply worker started. It will only send when automation is enabled.");
  while (!stopping) {
    try {
      const job = await claimNextJob();
      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      try {
        await processJob(job);
      } catch (error) {
        await retryJob(job, error);
      }
    } catch (error) {
      console.error("AI worker could not poll the outbox", error instanceof Error ? error.name : "UnknownError");
      await sleep(POLL_INTERVAL_MS);
    }
  }

  console.info("Inbox reply worker stopped.");
}

void main().catch((error) => {
  console.error("Inbox reply worker failed to start", error instanceof Error ? error.name : "UnknownError");
  process.exitCode = 1;
});
