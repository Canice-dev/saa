import { and, count, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { catalogImportRows, catalogImports } from "@/lib/db/schema";
import { isSameOriginRequest } from "@/lib/http/same-origin";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ importId: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed" }, { status: 403 });
  }

  const { importId } = await context.params;
  try {
    const db = getDatabase();
    const [importRecord] = await db.select({ id: catalogImports.id, status: catalogImports.status })
      .from(catalogImports)
      .where(and(eq(catalogImports.id, importId), eq(catalogImports.businessId, 1)))
      .limit(1);
    if (!importRecord) return Response.json({ error: "Import not found" }, { status: 404 });
    if (importRecord.status !== "uploading") {
      return Response.json({ importId, status: importRecord.status }, { status: 200 });
    }
    const [rowCount] = await db.select({ total: count() }).from(catalogImportRows).where(eq(catalogImportRows.importId, importId));
    if (Number(rowCount.total) === 0) {
      return Response.json({ error: "The CSV has no product rows" }, { status: 400 });
    }

    await db.execute(sql`
      UPDATE catalog_import_rows AS staged
      SET errors = array_append(staged.errors, 'SKU appears more than once in this file')
      WHERE staged.import_id = ${importId}
        AND staged.sku IN (
          SELECT sku FROM catalog_import_rows
          WHERE import_id = ${importId} AND sku IS NOT NULL
          GROUP BY sku HAVING count(*) > 1
        )
        AND NOT ('SKU appears more than once in this file' = ANY(staged.errors))
    `);
    await db.update(catalogImports)
      .set({ status: "review", totalRows: Number(rowCount.total) })
      .where(eq(catalogImports.id, importId));
    return Response.json({ importId, status: "review" });
  } catch {
    return Response.json({ error: "Could not finish validating this CSV" }, { status: 500 });
  }
}
