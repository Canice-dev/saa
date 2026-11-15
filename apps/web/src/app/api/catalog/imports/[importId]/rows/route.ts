import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { catalogImportRows, catalogImports } from "@/lib/db/schema";
import { validateCatalogImportRow } from "@/lib/catalog/import-validation";
import { isSameOriginRequest } from "@/lib/http/same-origin";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ importId: string }> };
type RawRow = { rowNumber: number; values: Record<string, string> };

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed" }, { status: 403 });
  }

  const { importId } = await context.params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid CSV rows" }, { status: 400 });
  }

  const rows =
    typeof payload === "object" && payload !== null && "rows" in payload &&
    Array.isArray(payload.rows)
      ? (payload.rows as RawRow[])
      : null;
  if (!rows || rows.length < 1 || rows.length > 200) {
    return Response.json({ error: "Send between 1 and 200 CSV rows at a time" }, { status: 400 });
  }
  if (rows.some((row) =>
    !Number.isInteger(row?.rowNumber) || row.rowNumber < 2 ||
    !row.values || typeof row.values !== "object" || Array.isArray(row.values) ||
    Object.values(row.values).some((value) => typeof value !== "string") ||
    JSON.stringify(row.values).length > 30000
  )) {
    return Response.json({ error: "A CSV row is invalid or larger than 30,000 characters" }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const [importRecord] = await db
      .select({ id: catalogImports.id, status: catalogImports.status })
      .from(catalogImports)
      .where(and(eq(catalogImports.id, importId), eq(catalogImports.businessId, 1)))
      .limit(1);
    if (!importRecord) return Response.json({ error: "Import not found" }, { status: 404 });
    if (importRecord.status !== "uploading") {
      return Response.json({ error: "This import is no longer receiving rows" }, { status: 409 });
    }

    const normalizedRows = rows.map(({ rowNumber, values }) => {
      const result = validateCatalogImportRow(values);
      return {
        importId,
        rowNumber,
        sku: result.sku,
        raw: values,
        normalized: result.normalized,
        errors: result.errors,
      };
    });
    await db.insert(catalogImportRows)
      .values(normalizedRows)
      .onConflictDoNothing();

    return Response.json({ received: rows.length });
  } catch {
    return Response.json({ error: "Could not save this batch. Retry the upload." }, { status: 500 });
  }
}
