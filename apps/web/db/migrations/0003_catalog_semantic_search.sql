CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE products
  ADD COLUMN embedding vector(1536),
  ADD COLUMN embedding_updated_at timestamptz;

CREATE INDEX products_embedding_hnsw_idx
  ON products USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX products_search_fts_idx
  ON products USING gin (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(search_terms, '')
    )
  );
