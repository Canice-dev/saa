import { and, asc, eq, getDatabase, sql } from "../../web/src/lib/db/client.js";
import { products } from "../../web/src/lib/db/schema.js";
import { createEmbeddings, type ProductFact } from "./ai.js";

type CatalogRow = ProductFact & { id: string };

function productText(product: {
  name: string;
  description: string | null;
  category: string | null;
  searchTerms: string | null;
}) {
  return [
    `Product: ${product.name}`,
    product.category ? `Category: ${product.category}` : "",
    product.description ? `Details: ${product.description}` : "",
    product.searchTerms ? `Also known as: ${product.searchTerms}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

export async function indexPendingProducts() {
  const db = getDatabase();
  const pending = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category: products.category,
      searchTerms: products.searchTerms,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(sql`embedding_updated_at IS NULL OR embedding_updated_at < ${products.updatedAt}`)
    .orderBy(asc(products.updatedAt))
    .limit(32);

  if (pending.length === 0) return 0;

  const embeddings = await createEmbeddings(pending.map(productText));
  for (const [index, product] of pending.entries()) {
    const embedding = embeddings[index];
    if (!embedding) continue;
    await db
      .update(products)
      .set({ embedding, embeddingUpdatedAt: product.updatedAt })
      .where(
        and(
          eq(products.id, product.id),
          eq(products.updatedAt, product.updatedAt),
        ),
      );
  }

  return pending.length;
}

type SearchRow = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category: string | null;
  price: string | number;
  currency: string;
  stock_quantity: number;
  similarity?: string | number;
};

export async function findRelevantProducts(query: string): Promise<ProductFact[]> {
  const [queryEmbedding] = await createEmbeddings([query]);
  if (!queryEmbedding) return [];

  const db = getDatabase();
  const vector = JSON.stringify(queryEmbedding);
  const [semanticResult, keywordResult] = await Promise.all([
    db.execute(sql`
      SELECT id, name, sku, description, category, price, currency,
             stock_quantity, 1 - (embedding <=> ${vector}::vector) AS similarity
      FROM products
      WHERE business_id = 1 AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vector}::vector
      LIMIT 12
    `),
    db.execute(sql`
      SELECT id, name, sku, description, category, price, currency, stock_quantity
      FROM products
      WHERE business_id = 1
        AND to_tsvector(
          'simple',
          coalesce(name, '') || ' ' || coalesce(description, '') || ' ' ||
            coalesce(category, '') || ' ' || coalesce(search_terms, '')
        )
          @@ websearch_to_tsquery('simple', ${query})
      ORDER BY ts_rank_cd(
        to_tsvector(
          'simple',
          coalesce(name, '') || ' ' || coalesce(description, '') || ' ' ||
            coalesce(category, '') || ' ' || coalesce(search_terms, '')
        ),
        websearch_to_tsquery('simple', ${query})
      ) DESC
      LIMIT 12
    `),
  ]);

  const ranked = new Map<string, { product: SearchRow; score: number }>();
  const addRanked = (rows: SearchRow[], weight: number, semantic = false) => {
    rows.forEach((product, index) => {
      const similarity = Number(product.similarity ?? 0);
      if (semantic && similarity < 0.3) return;
      const existing = ranked.get(product.id);
      const score = weight / (60 + index + 1);
      if (existing) existing.score += score;
      else ranked.set(product.id, { product, score });
    });
  };

  addRanked(semanticResult.rows as SearchRow[], 1.4, true);
  addRanked(keywordResult.rows as SearchRow[], 1);

  return [...ranked.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ product }) => ({
      name: product.name,
      sku: product.sku,
      description: product.description,
      category: product.category,
      price: Number(product.price),
      currency: product.currency.trim(),
      stockQuantity: Number(product.stock_quantity),
    }));
}
