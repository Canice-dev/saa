import "dotenv/config";
import { and, desc, eq, getDatabase, sql } from "../../web/src/lib/db/client.js";
import {
  businessSettings,
  conversations,
  customers,
  messages,
  outboxEvents,
} from "../../web/src/lib/db/schema.js";
import {
  sendWhatsAppText,
  WhatsAppSendError,
} from "../../web/src/lib/integrations/meta/whatsapp-send.js";
import {
  createCustomerReply,
  summarizeAIError,
  type ReplyTurn,
} from "./ai.js";
import { findRelevantProducts, indexPendingProducts } from "./catalog.js";

const POLL_INTERVAL_MS = 3_000;
const INDEX_INTERVAL_MS = 12_000;
const JOB_LEASE_SECONDS = 120;
const MAX_ATTEMPTS = 5;
const MAX_RETRY_DELAY_SECONDS = 300;
const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  if (
    typeof value.inboundMessageId !== "string" ||
    typeof value.generation !== "number"
  ) {
    return null;
  }
  return {
    inboundMessageId: value.inboundMessageId,
    generation: value.generation,
  };
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
  const retryDelaySeconds = Math.min(
    15 * 2 ** Math.max(0, job.attempts - 1),
    MAX_RETRY_DELAY_SECONDS,
  );
  const now = new Date();

  await getDatabase()
    .update(outboxEvents)
    .set({
      status: failedPermanently ? "failed" : "pending",
      availableAt: failedPermanently
        ? now
        : new Date(now.getTime() + retryDelaySeconds * 1000),
      processedAt: failedPermanently ? now : null,
    })
    .where(eq(outboxEvents.id, job.id));

  console.error("AI worker job failed", {
    jobId: job.id,
    attempt: job.attempts,
    final: failedPermanently,
    error: summarizeAIError(error),
    ...(error instanceof WhatsAppSendError
      ? { provider: error.diagnostics }
      : {}),
  });
}

async function processJob(job: ClaimedReplyJob) {
  const payload = parseReplyPayload(job.payload);
  if (!payload) {
    await completeJob(job.id);
    console.warn("AI worker skipped a job with an invalid payload", job.id);
    return;
  }

  const db = getDatabase();
  const [conversation] = await db
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
    .innerJoin(
      businessSettings,
      eq(businessSettings.businessId, conversations.businessId),
    )
    .where(
      and(
        eq(conversations.id, job.aggregate_id),
        eq(conversations.businessId, 1),
      ),
    )
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

  const [latestInbound] = await db
    .select({
      id: messages.id,
      body: messages.body,
      messageType: messages.messageType,
      receivedAt: messages.receivedAt,
      providerTimestamp: messages.providerTimestamp,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversation.id),
        eq(messages.direction, "inbound"),
      ),
    )
    .orderBy(desc(messages.receivedAt))
    .limit(1);

  if (!latestInbound || latestInbound.id !== payload.inboundMessageId) {
    await completeJob(job.id);
    return;
  }

  const inboundTime =
    latestInbound.providerTimestamp ?? latestInbound.receivedAt;
  const inboundAge = Date.now() - inboundTime.getTime();
  if (
    inboundAge < 0 ||
    inboundAge >= CUSTOMER_SERVICE_WINDOW_MS ||
    latestInbound.messageType === "reaction" ||
    !latestInbound.body?.trim()
  ) {
    await completeJob(job.id);
    return;
  }

  const [latestOutbound] = await db
    .select({ receivedAt: messages.receivedAt })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversation.id),
        eq(messages.direction, "outbound"),
      ),
    )
    .orderBy(desc(messages.receivedAt))
    .limit(1);

  if (
    latestOutbound &&
    latestOutbound.receivedAt.getTime() > latestInbound.receivedAt.getTime()
  ) {
    await completeJob(job.id);
    return;
  }

  const recentMessages = await db
    .select({
      senderRole: messages.senderRole,
      body: messages.body,
      messageType: messages.messageType,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(desc(messages.receivedAt))
    .limit(12);

  const turns: ReplyTurn[] = [];
  for (const message of recentMessages.reverse()) {
    if (!message.body?.trim() || message.messageType === "reaction") continue;
    if (message.senderRole === "customer") {
      turns.push({ role: "user", content: message.body });
    } else if (
      message.senderRole === "seller" ||
      message.senderRole === "assistant"
    ) {
      turns.push({ role: "assistant", content: message.body });
    }
  }

  const productFacts = await findRelevantProducts(latestInbound.body);
  const reply = await createCustomerReply(turns, productFacts);
  const providerMessageId = await sendWhatsAppText(
    conversation.recipientId,
    reply,
  );

  await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      provider: "meta",
      providerMessageId,
      senderRole: "assistant",
      direction: "outbound",
      messageType: "text",
      body: reply,
      providerTimestamp: new Date(),
      deliveryStatus: "accepted",
    })
    .onConflictDoNothing();

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversation.id));
  await completeJob(job.id);
  console.info("AI worker sent a model-generated reply", job.id);
}

const sleep = (durationMs: number) =>
  new Promise((resolve) => setTimeout(resolve, durationMs));
let stopping = false;

process.once("SIGINT", () => {
  stopping = true;
});
process.once("SIGTERM", () => {
  stopping = true;
});

async function runReplyQueue() {
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
      console.error(
        "AI worker could not poll the outbox",
        summarizeAIError(error),
      );
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

async function runCatalogIndexer() {
  while (!stopping) {
    try {
      const indexed = await indexPendingProducts();
      await sleep(indexed > 0 ? 500 : INDEX_INTERVAL_MS);
    } catch (error) {
      console.error(
        "AI worker could not index catalog products",
        summarizeAIError(error),
      );
      await sleep(INDEX_INTERVAL_MS);
    }
  }
}

async function main() {
  const requiredSettings = [
    "DATABASE_URL",
    "OPENAI_API_KEY",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
  ];
  const missingSettings = requiredSettings.filter((name) => !process.env[name]);
  if (missingSettings.length > 0) {
    throw new Error(`Missing worker settings: ${missingSettings.join(", ")}`);
  }

  console.info(
    `Inbox AI worker started with OpenAI model ${process.env.OPENAI_CHAT_MODEL ?? "gpt-6-luna"}. Automation must be enabled to send replies.`,
  );
  await Promise.all([runReplyQueue(), runCatalogIndexer()]);
  console.info("Inbox AI worker stopped.");
}

void main().catch((error: unknown) => {
  console.error(
    "Inbox AI worker failed to start",
    error instanceof Error ? error.message : "UnknownError",
  );
  process.exitCode = 1;
});
