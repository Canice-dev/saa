type WhatsAppMessageResponse = {
  messages?: { id?: unknown }[];
};

export class WhatsAppSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppSendError";
  }
}

export async function sendWhatsAppText(to: string, body: string): Promise<string> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v27.0";

  if (!phoneNumberId || !accessToken) {
    throw new WhatsAppSendError("WhatsApp sending is not configured");
  }
  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    throw new WhatsAppSendError("WhatsApp API version is invalid");
  }

  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    throw new WhatsAppSendError("WhatsApp could not be reached");
  }

  if (!response.ok) {
    throw new WhatsAppSendError("WhatsApp rejected the message");
  }

  let result: WhatsAppMessageResponse;
  try {
    result = (await response.json()) as WhatsAppMessageResponse;
  } catch {
    throw new WhatsAppSendError("WhatsApp returned an invalid response");
  }

  const messageId = result.messages?.[0]?.id;
  if (typeof messageId !== "string" || !messageId) {
    throw new WhatsAppSendError("WhatsApp did not return a message ID");
  }

  return messageId;
}
