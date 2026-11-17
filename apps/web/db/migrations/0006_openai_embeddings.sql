-- OpenAI and Gemini embeddings use different vector spaces. Rebuild catalog
-- embeddings with OpenAI before using semantic results again.
UPDATE products
SET embedding = NULL,
    embedding_updated_at = NULL;
