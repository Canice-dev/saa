type WhatsAppMessageResponse = {
  messages?: { id?: unknown }[];
  error?: unknown;
};

type WhatsAppSendDiagnostics = {
  stage: "configuration" | "network" | "provider_rejection" | "invalid_response";
  httpStatus?: number;
  providerCode?: string | number;
  providerSubcode?: string | number;
  providerType?: string;
  providerMessage?: string;
  fbtraceId?: string;
  causeName?: string;
};

export class WhatsAppSendError extends Error {
  readonly diagnostics: WhatsAppSendDiagnostics;

  constructor(message: string, diagnostics: WhatsAppSendDiagnostics) {
    super(message);
    this.name = "WhatsAppSendError";
    this.diagnostics = diagnostics;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function shortString(value: unknown): string | undefined {
  return typeof value === "string" ? value.slice(0, 500) : undefined;
}

function errorCode(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

export async function sendWhatsAppText(to: string, body: string): Promise<string> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v27.0";

  if (!phoneNumberId || !accessToken) {
    throw new WhatsAppSendError("WhatsApp sending is not configured", { stage: "configuration" });
  }
  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    throw new WhatsAppSendError("WhatsApp API version is invalid", { stage: "configuration" });
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
  } catch (error) {
    throw new WhatsAppSendError("WhatsApp could not be reached", {
      stage: "network",
      causeName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  if (!response.ok) {
    let providerError: Record<string, unknown> | null = null;
    try {
      providerError = asRecord((await response.json() as WhatsAppMessageResponse).error);
    } catch {
      // Preserve the HTTP status even when Meta does not return a JSON error body.
    }

    throw new WhatsAppSendError("WhatsApp rejected the message", {
      stage: "provider_rejection",
      httpStatus: response.status,
      providerCode: errorCode(providerError?.code),
      providerSubcode: errorCode(providerError?.error_subcode),
      providerType: shortString(providerError?.type),
      providerMessage: shortString(providerError?.message),
      fbtraceId: shortString(providerError?.fbtrace_id),
    });
  }

  let result: WhatsAppMessageResponse;
  try {
    result = (await response.json()) as WhatsAppMessageResponse;
  } catch {
    throw new WhatsAppSendError("WhatsApp returned an invalid response", {
      stage: "invalid_response",
      httpStatus: response.status,
    });
  }

  const messageId = result.messages?.[0]?.id;
  if (typeof messageId !== "string" || !messageId) {
    throw new WhatsAppSendError("WhatsApp did not return a message ID", {
      stage: "invalid_response",
      httpStatus: response.status,
    });
  }

  return messageId;
}
