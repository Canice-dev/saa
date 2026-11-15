import { and, asc, eq, gt, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { catalogImportRows, catalogImports, products } from "@/lib/db/schema";
import type { CatalogImportValues } from "@/lib/catalog/import-validation";
import { isSameOriginRequest } from "@/lib/http/same-origin";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ importId: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed" }, { status: 403 });
  }
  const { importId } = await context.params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Choose whether matching SKUs should be updated" }, { status: 400 });
  }
  const requestedUpdateExisting =
    typeof payload === "object" && payload !== null && "updateExisting" in payload
      ? payload.updateExisting
      : undefined;
  if (typeof requestedUpdateExisting !== "boolean") {
    return Response.json({ error: "Choose whether matching SKUs should be updated" }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const [importRecord] = await db.select({
      id: catalogImports.id,
      status: catalogImports.status,
      updateExisting: catalogImports.updateExisting,
      appliedThroughRowNumber: catalogImports.appliedThroughRowNumber,
    }).from(catalogImports)
      .where(and(eq(catalogImports.id, importId), eq(catalogImports.businessId, 1)))
      .limit(1);
    if (!importRecord) return Response.json({ error: "Import not found" }, { status: 404 });
    if (importRecord.status === "imported") return Response.json({ done: true, applied: 0 });
    if (importRecord.status !== "review") {
      return Response.json({ error: "Finish reviewing this import first" }, { status: 409 });
    }
    if (importRecord.appliedThroughRowNumber > 1 && requestedUpdateExisting !== importRecord.updateExisting) {
      return Response.json({ error: "The update choice cannot change after importing has started" }, { status: 409 });
    }

    if (importRecord.appliedThroughRowNumber === 1) {
      await db.update(catalogImports)
        .set({ updateExisting: requestedUpdateExisting })
        .where(eq(catalogImports.id, importId));
    }

    const batch = await db.select({
      rowNumber: catalogImportRows.rowNumber,
      normalized: catalogImportRows.normalized,
    }).from(catalogImportRows)
      .where(and(
        eq(catalogImportRows.importId, importId),
        gt(catalogImportRows.rowNumber, importRecord.appliedThroughRowNumber),
        sql`cardinality(${catalogImportRows.errors}) = 0`,
      ))
      .orderBy(asc(catalogImportRows.rowNumber))
      .limit(100);

    if (batch.length === 0) {
      await db.update(catalogImports)
        .set({ status: "imported", completedAt: new Date() })
        .where(eq(catalogImports.id, importId));
      return Response.json({ done: true, applied: 0 });
    }

    const values = batch.map(({ normalized }) => {
      const product = normalized as CatalogImportValues;
      return { businessId: 1, ...product };
    });
    const insert = db.insert(products).values(values);
    const written = requestedUpdateExisting
      ? await insert.onConflictDoUpdate({
          target: [products.businessId, products.sku],
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            category: sql`excluded.category`,
            price: sql`excluded.price`,
            currency: sql`excluded.currency`,
            stockQuantity: sql`excluded.stock_quantity`,
            searchTerms: sql`excluded.search_terms`,
            updatedAt: new Date(),
          },
        }).returning({ id: products.id })
      : await insert.onConflictDoNothing({ target: [products.businessId, products.sku] }).returning({ id: products.id });

    const lastRowNumber = batch[batch.length - 1].rowNumber;
    await db.update(catalogImports)
      .set({ appliedThroughRowNumber: lastRowNumber })
      .where(eq(catalogImports.id, importId));

    return Response.json({ done: false, applied: written.length, processed: batch.length });
  } catch {
    return Response.json({ error: "Could not import this batch. You can safely resume." }, { status: 500 });
  }
}
