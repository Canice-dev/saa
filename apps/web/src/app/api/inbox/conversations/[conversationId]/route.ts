import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { conversations } from "@/lib/db/schema";
import { isSameOriginRequest } from "@/lib/http/same-origin";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ conversationId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed" }, { status: 403 });
  }

  const { conversationId } = await params;
  if (!UUID_PATTERN.test(conversationId)) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid conversation update" }, { status: 400 });
  }

  const state =
    typeof payload === "object" && payload !== null && "state" in payload
      ? payload.state
      : undefined;
  if (state !== "open" && state !== "closed") {
    return Response.json({ error: "State must be open or closed" }, { status: 400 });
  }

  try {
    const [updated] = await getDatabase()
      .update(conversations)
      .set({ state, updatedAt: new Date() })
      .where(and(eq(conversations.id, conversationId), eq(conversations.businessId, 1)))
      .returning({ id: conversations.id });

    if (!updated) return Response.json({ error: "Conversation not found" }, { status: 404 });
    return Response.json({ state }, { status: 200 });
  } catch {
    return Response.json({ error: "Could not update the conversation" }, { status: 500 });
  }
}
