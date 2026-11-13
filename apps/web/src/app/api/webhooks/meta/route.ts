import { processWhatsAppWebhook, verifyMetaChallenge, verifyMetaSignature } from "@/lib/integrations/meta/whatsapp-webhook";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 1_000_000;

async function readLimitedBody(request: Request): Promise<Buffer | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) return null;
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_WEBHOOK_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), byteLength);
}

export async function GET(request: Request) {
  if (!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return Response.json({ error: "Webhook verification is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const challenge = verifyMetaChallenge(
    url.searchParams.get("hub.mode"),
    url.searchParams.get("hub.verify_token"),
    url.searchParams.get("hub.challenge"),
  );

  return challenge === null
    ? new Response("Forbidden", { status: 403 })
    : new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request) {
  if (!process.env.META_APP_SECRET || !process.env.DATABASE_URL) {
    return Response.json({ error: "Webhook processing is not configured" }, { status: 503 });
  }

  const rawBody = await readLimitedBody(request);
  if (!rawBody) return Response.json({ error: "Payload too large" }, { status: 413 });
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    await processWhatsAppWebhook(payload);
    return Response.json({ received: true });
  } catch (error) {
    // Do not log request bodies or credentials; returning 5xx lets Meta retry.
    console.error("Meta webhook persistence failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Webhook could not be stored" }, { status: 500 });
  }
}
