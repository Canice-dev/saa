import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { validateCatalogImportRow } from "@/lib/catalog/import-validation";
import { isSameOriginRequest } from "@/lib/http/same-origin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const db = getDatabase();
  const searchFilter = query
    ? or(ilike(products.name, `%${query}%`), ilike(products.sku, `%${query}%`), ilike(products.category, `%${query}%`))
    : undefined;

  try {
    const [totalResult] = await db.select({ total: count() }).from(products).where(eq(products.businessId, 1));
    const rows = await db.select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      description: products.description,
      price: products.price,
      currency: products.currency,
      stockQuantity: products.stockQuantity,
      searchTerms: products.searchTerms,
      updatedAt: products.updatedAt,
    }).from(products)
      .where(and(eq(products.businessId, 1), searchFilter))
      .orderBy(asc(products.name))
      .limit(100);

    return Response.json({ products: rows, total: Number(totalResult.total), shown: rows.length });
  } catch {
    return Response.json({ error: "Could not load the product catalog" }, { status: 500 });
  }
}

function parseProductPayload(payload: unknown) {
  if (typeof payload !== "object" || payload === null || !("values" in payload) ||
    typeof payload.values !== "object" || payload.values === null || Array.isArray(payload.values)) {
    return null;
  }
  const entries = Object.entries(payload.values);
  if (entries.some(([, value]) => typeof value !== "string")) return null;
  return validateCatalogImportRow(payload.values as Record<string, string>);
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Request origin is not allowed" }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return Response.json({ error: "Enter valid product details" }, { status: 400 }); }
  const parsed = parseProductPayload(payload);
  if (!parsed) return Response.json({ error: "Enter valid product details" }, { status: 400 });
  if (parsed.errors.length) return Response.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });
  try {
    const [created] = await getDatabase().insert(products).values({ businessId: 1, ...parsed.normalized }).returning();
    return Response.json({ product: created }, { status: 201 });
  } catch {
    return Response.json({ error: "A product with this SKU already exists, or the product could not be saved" }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Request origin is not allowed" }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return Response.json({ error: "Enter valid product details" }, { status: 400 }); }
  if (typeof payload !== "object" || payload === null || !("productId" in payload) || typeof payload.productId !== "string") {
    return Response.json({ error: "Product not found" }, { status: 400 });
  }
  const parsed = parseProductPayload(payload);
  if (!parsed) return Response.json({ error: "Enter valid product details" }, { status: 400 });
  if (parsed.errors.length) return Response.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });
  try {
    const [updated] = await getDatabase().update(products).set({ ...parsed.normalized, updatedAt: new Date() })
      .where(and(eq(products.id, payload.productId), eq(products.businessId, 1))).returning();
    if (!updated) return Response.json({ error: "Product not found" }, { status: 404 });
    return Response.json({ product: updated });
  } catch {
    return Response.json({ error: "A product with this SKU already exists, or the product could not be saved" }, { status: 409 });
  }
}
