DROP INDEX IF EXISTS products_embedding_hnsw_idx;

ALTER TABLE products
  ALTER COLUMN embedding TYPE vector(1024)
  USING NULL::vector(1024);

UPDATE products
SET embedding_updated_at = NULL;

CREATE INDEX products_embedding_hnsw_idx
  ON products USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
