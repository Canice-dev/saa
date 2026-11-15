import { eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { businessSettings } from "@/lib/db/schema";
import { isSameOriginRequest } from "@/lib/http/same-origin";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid automation setting" }, { status: 400 });
  }

  const enabled =
    typeof payload === "object" && payload !== null && "enabled" in payload
      ? payload.enabled
      : undefined;
  if (typeof enabled !== "boolean") {
    return Response.json({ error: "Enabled must be true or false" }, { status: 400 });
  }

  try {
    await getDatabase()
      .insert(businessSettings)
      .values({ businessId: 1, automationEnabled: enabled })
      .onConflictDoUpdate({
        target: businessSettings.businessId,
        set: { automationEnabled: enabled, updatedAt: new Date() },
      });

    return Response.json({ automationEnabled: enabled }, { status: 200 });
  } catch {
    return Response.json({ error: "Could not update automatic replies" }, { status: 500 });
  }
}
