import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string | null,
): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (
    !appSecret ||
    !signatureHeader ||
    !/^sha256=[a-f0-9]{64}$/i.test(signatureHeader)
  ) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  return safeEqual(expected, signatureHeader.toLowerCase());
}

export function verifyMetaChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null,
): string | null {
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!expectedToken || mode !== "subscribe" || !token || !challenge)
    return null;
  return safeEqual(expectedToken, token) ? challenge : null;
}

function messageBody(message: JsonObject): {
  type: string;
  body: string | null;
} {
  const type = asString(message.type) ?? "unknown";
  const content = isObject(message[type])
    ? (message[type] as JsonObject)
    : undefined;
  const body =
    type === "text" && content ? (asString(content.body) ?? null) : null;
  return { type, body };
}

function providerTime(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const date = new Date(Number(value) * 1000);
  return Number.isNaN(date.valueOf()) ? null : date;
}

async function persistInboundMessage(input: {
  accountId: string;
  messageId: string;
  senderId: string;
  senderName: string | null;
  messageType: string;
  body: string | null;
  providerTimestamp: Date | null;
}) {
  const db = getDatabase();
  const eventKey = `message:${input.accountId}:${input.messageId}`;

  // A single statement keeps the idempotency record, message, conversation update,
  // and delayed-reply outbox item atomic. Duplicate Meta deliveries become no-ops.
  await db.execute(sql`
    WITH inserted_event AS (
      INSERT INTO provider_events (provider, event_key, event_type, provider_account_id, processed_at)
      VALUES ('whatsapp', ${eventKey}, 'message', ${input.accountId}, now())
      ON CONFLICT (provider, event_key) DO NOTHING
      RETURNING id
    ), upserted_customer AS (
      INSERT INTO customers (business_id, channel, external_user_id, phone_number, display_name)
      SELECT 1, 'whatsapp', ${input.senderId}, ${input.senderId}, ${input.senderName}
      FROM inserted_event
      ON CONFLICT (business_id, channel, external_user_id)
      DO UPDATE SET
        phone_number = COALESCE(EXCLUDED.phone_number, customers.phone_number),
        display_name = COALESCE(EXCLUDED.display_name, customers.display_name),
        updated_at = now()
      RETURNING id
    ), upserted_conversation AS (
      INSERT INTO conversations (business_id, channel, customer_id, last_customer_message_at)
      SELECT 1, 'whatsapp', upserted_customer.id, COALESCE(${input.providerTimestamp ?? null}, now())
      FROM upserted_customer
      ON CONFLICT (business_id, channel, customer_id)
      DO UPDATE SET
        state = 'open',
        response_generation = conversations.response_generation + 1,
        last_customer_message_at = COALESCE(${input.providerTimestamp ?? null}, now()),
        updated_at = now()
      RETURNING id, response_generation
    ), inserted_message AS (
      INSERT INTO messages (
        conversation_id, provider, provider_message_id, sender_role, direction,
        message_type, body, provider_timestamp
      )
      SELECT id, 'meta', ${input.messageId}, 'customer', 'inbound',
        ${input.messageType}, ${input.body}, ${input.providerTimestamp ?? null}
      FROM upserted_conversation
      ON CONFLICT (provider, provider_message_id) DO NOTHING
      RETURNING id, conversation_id
    ), queued_reply AS (
      INSERT INTO outbox_events (event_type, aggregate_id, dedupe_key, payload, available_at)
      SELECT
        'reply_due', inserted_message.conversation_id,
        ${`reply_due:whatsapp:${input.messageId}`},
        jsonb_build_object(
          'conversationId', inserted_message.conversation_id,
          'inboundMessageId', inserted_message.id,
          'generation', upserted_conversation.response_generation
        ),
        now() + make_interval(secs => business_settings.response_delay_seconds)
      FROM inserted_message
      JOIN upserted_conversation ON upserted_conversation.id = inserted_message.conversation_id
      CROSS JOIN business_settings
      WHERE business_settings.business_id = 1
      ON CONFLICT (dedupe_key) DO NOTHING
      RETURNING id
    )
    SELECT id FROM inserted_message
  `);
}

async function persistDeliveryStatus(input: {
  accountId: string;
  messageId: string;
  status: "accepted" | "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errorCode: number | null;
}) {
  const db = getDatabase();
  const eventKey = `status:${input.accountId}:${input.messageId}:${input.status}:${input.timestamp}`;

  await db.execute(sql`
    WITH inserted_event AS (
      INSERT INTO provider_events (
        provider, event_key, event_type, provider_account_id, event_data, processed_at
      )
      VALUES (
        'whatsapp', ${eventKey}, 'message_status', ${input.accountId},
        ${JSON.stringify({
          messageId: input.messageId,
          status: input.status,
          timestamp: input.timestamp,
          errorCode: input.errorCode,
        })}::jsonb,
        now()
      )
      ON CONFLICT (provider, event_key) DO NOTHING
      RETURNING id
    ), updated_message AS (
      UPDATE messages
      SET delivery_status = CASE
            WHEN messages.delivery_status = 'read' THEN 'read'
            WHEN messages.delivery_status = 'delivered' AND ${input.status} <> 'read' THEN 'delivered'
            WHEN messages.delivery_status = 'sent' AND ${input.status} = 'accepted' THEN 'sent'
            ELSE ${input.status}
          END,
          provider_error_code = COALESCE(${input.errorCode}, messages.provider_error_code)
      WHERE provider = 'meta' AND provider_message_id = ${input.messageId}
        AND EXISTS (SELECT 1 FROM inserted_event)
      RETURNING id
    )
    SELECT id FROM updated_message
  `);
}

export async function processWhatsAppWebhook(payload: unknown): Promise<void> {
  if (!isObject(payload) || !Array.isArray(payload.entry)) {
    throw new Error("Invalid WhatsApp webhook payload");
  }

  const configuredAccountId = process.env.WHATSAPP_MESSAGING_ACCOUNT_ID;

  for (const entryValue of payload.entry) {
    if (!isObject(entryValue)) continue;
    const accountId = asString(entryValue.id);
    if (!accountId || !Array.isArray(entryValue.changes)) continue;
    if (configuredAccountId && accountId !== configuredAccountId) continue;

    for (const changeValue of entryValue.changes) {
      if (!isObject(changeValue) || !isObject(changeValue.value)) continue;
      const value = changeValue.value;
      const field = asString(changeValue.field);
      if (field !== "messages") continue;

      const contacts = Array.isArray(value.contacts)
        ? value.contacts.filter(isObject)
        : [];
      const messages = Array.isArray(value.messages)
        ? value.messages.filter(isObject)
        : [];
      for (const message of messages) {
        const messageId = asString(message.id);
        const senderId = asString(message.from);
        if (!messageId || !senderId) continue;
        const contact = contacts.find((item) => item.wa_id === senderId);
        const profile =
          contact && isObject(contact.profile) ? contact.profile : undefined;
        const content = messageBody(message);

        await persistInboundMessage({
          accountId,
          messageId,
          senderId,
          senderName: profile ? (asString(profile.name) ?? null) : null,
          messageType: content.type,
          body: content.body,
          providerTimestamp: providerTime(message.timestamp),
        });
      }

      const statuses = Array.isArray(value.statuses)
        ? value.statuses.filter(isObject)
        : [];
      for (const status of statuses) {
        const messageId = asString(status.id);
        const state = asString(status.status);
        const timestamp = asString(status.timestamp);
        if (!messageId || !timestamp || !state) continue;
        if (
          !["accepted", "sent", "delivered", "read", "failed"].includes(state)
        )
          continue;

        const errors = Array.isArray(status.errors) ? status.errors : [];
        const firstError = errors[0];
        const errorCode =
          isObject(firstError) && typeof firstError.code === "number"
            ? firstError.code
            : null;

        await persistDeliveryStatus({
          accountId,
          messageId,
          status: state as
            | "accepted"
            | "sent"
            | "delivered"
            | "read"
            | "failed",
          timestamp,
          errorCode,
        });
      }
    }
  }
}
