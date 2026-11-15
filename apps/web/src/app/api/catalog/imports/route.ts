import { getDatabase } from "@/lib/db/client";
import { and, desc, eq } from "drizzle-orm";
import { catalogImports } from "@/lib/db/schema";
import { isSameOriginRequest } from "@/lib/http/same-origin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [pending] = await getDatabase().select({ id: catalogImports.id })
      .from(catalogImports)
      .where(and(eq(catalogImports.businessId, 1), eq(catalogImports.status, "review")))
      .orderBy(desc(catalogImports.createdAt))
      .limit(1);
    return Response.json({ importId: pending?.id ?? null });
  } catch {
    return Response.json({ error: "Could not restore the latest catalog review" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid import details" }, { status: 400 });
  }

  const fileName =
    typeof payload === "object" && payload !== null && "fileName" in payload &&
    typeof payload.fileName === "string"
      ? payload.fileName.trim().slice(0, 255)
      : "";
  if (!fileName || !fileName.toLowerCase().endsWith(".csv")) {
    return Response.json({ error: "Choose a CSV file to import" }, { status: 400 });
  }

  try {
    const [created] = await getDatabase()
      .insert(catalogImports)
      .values({ businessId: 1, fileName })
      .returning({ id: catalogImports.id });
    return Response.json({ importId: created.id }, { status: 201 });
  } catch (error) {
    const cause = error as { code?: unknown; message?: unknown };
    const message = typeof cause.message === "string" ? cause.message : "Unknown database error";
    console.error("Catalog import creation failed", {
      code: typeof cause.code === "string" ? cause.code : undefined,
      message: message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database URL redacted]"),
    });
    if (cause.code === "42P01") {
      return Response.json({ error: "Catalog tables are missing. Restart the web server after applying database migrations." }, { status: 500 });
    }
    return Response.json({ error: "Could not start this catalog import" }, { status: 500 });
  }
}
