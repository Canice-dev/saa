import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { conversations, customers, messages } from "@/lib/db/schema";
import { sendWhatsAppText, WhatsAppSendError } from "@/lib/integrations/meta/whatsapp-send";
import { isSameOriginRequest } from "@/lib/http/same-origin";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 4096;
const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REQUEST_BYTES = 12_000;

type RouteContext = { params: Promise<{ conversationId: string }> };

async function readRequestBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }

  return body + decoder.decode();
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed" }, { status: 403 });
  }

  const { conversationId } = await params;
  if (!UUID_PATTERN.test(conversationId)) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "Message is too long" }, { status: 413 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Expected a JSON message" }, { status: 415 });
  }

  let payload: unknown;
  try {
    const rawBody = await readRequestBody(request);
    if (rawBody === null) return Response.json({ error: "Message request is too large" }, { status: 413 });
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid message request" }, { status: 400 });
  }

  const body =
    typeof payload === "object" && payload !== null && "body" in payload &&
    typeof payload.body === "string"
      ? payload.body.trim()
      : "";

  if (!body) return Response.json({ error: "Write a message first" }, { status: 400 });
  if (body.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: "Messages can be up to 4,096 characters" }, { status: 400 });
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!process.env.DATABASE_URL || !phoneNumberId || !accessToken) {
    return Response.json({ error: "WhatsApp replies are not configured" }, { status: 503 });
  }

  try {
    const db = getDatabase();
    const [conversation] = await db
      .select({
        id: conversations.id,
        channel: conversations.channel,
        recipientId: customers.externalUserId,
        lastInboundAt: sql<Date | null>`(
          select coalesce(${messages.providerTimestamp}, ${messages.receivedAt})
          from ${messages}
          where ${messages.conversationId} = ${conversations.id}
            and ${messages.direction} = 'inbound'
          order by ${messages.receivedAt} desc
          limit 1
        )`,
      })
      .from(conversations)
      .innerJoin(customers, eq(conversations.customerId, customers.id))
      .where(and(eq(conversations.id, conversationId), eq(conversations.businessId, 1)))
      .limit(1);

    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }
    if (conversation.channel !== "whatsapp") {
      return Response.json({ error: "Replies are currently available for WhatsApp only" }, { status: 409 });
    }
    if (!conversation.lastInboundAt) {
      return Response.json({ error: "A customer message is required before replying" }, { status: 409 });
    }

    const lastInboundAt = new Date(conversation.lastInboundAt).getTime();
    const elapsed = Date.now() - lastInboundAt;
    if (!Number.isFinite(lastInboundAt) || elapsed < 0 || elapsed >= CUSTOMER_SERVICE_WINDOW_MS) {
      return Response.json({ error: "The 24-hour WhatsApp reply window has expired" }, { status: 409 });
    }

    const providerMessageId = await sendWhatsAppText(conversation.recipientId, body);
    try {
      await db.execute(sql`
        WITH updated_conversation AS (
          UPDATE conversations
          SET last_seller_message_at = now(), updated_at = now()
          WHERE id = ${conversation.id} AND business_id = 1
          RETURNING id
        )
        INSERT INTO messages (
          conversation_id, provider, provider_message_id, sender_role, direction,
          message_type, body, provider_timestamp, delivery_status
        )
        SELECT id, 'meta', ${providerMessageId}, 'seller', 'outbound',
          'text', ${body}, now(), 'accepted'
        FROM updated_conversation
        ON CONFLICT (provider, provider_message_id) DO NOTHING
      `);
    } catch {
      console.error("WhatsApp reply was sent but could not be stored", conversation.id);
      return Response.json(
        { error: "WhatsApp accepted the reply, but it could not be saved. Refresh before trying again." },
        { status: 500 },
      );
    }

    return Response.json({ sent: true }, { status: 201 });
  } catch (error) {
    console.error("WhatsApp seller reply failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
      ...(error instanceof WhatsAppSendError ? { provider: error.diagnostics } : {}),
    });
    return Response.json(
      { error: error instanceof WhatsAppSendError
        ? "WhatsApp could not confirm the message. Check the thread before retrying."
        : "Could not send the message. Try again." },
      { status: 502 },
    );
  }
}
