import { and, count, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { catalogImportRows, catalogImports, products } from "@/lib/db/schema";
import { isSameOriginRequest } from "@/lib/http/same-origin";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ importId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { importId } = await context.params;
  try {
    const db = getDatabase();
    const [importRecord] = await db.select({
      id: catalogImports.id,
      fileName: catalogImports.fileName,
      status: catalogImports.status,
      totalRows: catalogImports.totalRows,
      updateExisting: catalogImports.updateExisting,
    })
      .from(catalogImports)
      .where(and(eq(catalogImports.id, importId), eq(catalogImports.businessId, 1)))
      .limit(1);
    if (!importRecord) return Response.json({ error: "Import not found" }, { status: 404 });

    const [counts] = await db.select({
      total: count(),
      invalid: sql<number>`count(*) filter (where cardinality(${catalogImportRows.errors}) > 0)::int`,
      valid: sql<number>`count(*) filter (where cardinality(${catalogImportRows.errors}) = 0)::int`,
    }).from(catalogImportRows).where(eq(catalogImportRows.importId, importId));
    const rows = await db.select({
      rowNumber: catalogImportRows.rowNumber,
      sku: catalogImportRows.sku,
      raw: catalogImportRows.raw,
      normalized: catalogImportRows.normalized,
      errors: catalogImportRows.errors,
    }).from(catalogImportRows)
      .where(eq(catalogImportRows.importId, importId))
      .orderBy(catalogImportRows.rowNumber)
      .limit(100);
    const skus = rows.flatMap((row) => row.sku ? [row.sku] : []);
    const existing = skus.length
      ? await db.select({ sku: products.sku }).from(products)
          .where(and(eq(products.businessId, 1), inArray(products.sku, skus)))
      : [];
    const existingSkus = new Set(existing.map(({ sku }) => sku));

    return Response.json({
      ...importRecord,
      counts: {
        total: Number(counts.total),
        invalid: Number(counts.invalid),
        valid: Number(counts.valid),
      },
      previewLimit: 100,
      rows: rows.map((row) => ({ ...row, exists: row.sku ? existingSkus.has(row.sku) : false })),
    });
  } catch {
    return Response.json({ error: "Could not load the import preview" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed" }, { status: 403 });
  }
  const { importId } = await context.params;
  try {
    const db = getDatabase();
    const removed = await db.delete(catalogImports).where(and(
      eq(catalogImports.id, importId),
      eq(catalogImports.businessId, 1),
      eq(catalogImports.status, "uploading"),
    )).returning({ id: catalogImports.id });
    if (!removed.length) return Response.json({ error: "Only an unfinished upload can be discarded" }, { status: 409 });
    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "Could not discard the unfinished upload" }, { status: 500 });
  }
}
