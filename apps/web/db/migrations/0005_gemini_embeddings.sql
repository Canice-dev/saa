-- Gemini and NVIDIA embeddings use different vector spaces. Rebuild catalog
-- embeddings with Gemini before using semantic results again.
UPDATE products
SET embedding = NULL,
    embedding_updated_at = NULL;
