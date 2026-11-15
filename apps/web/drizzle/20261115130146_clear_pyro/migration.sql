ALTER TABLE "conversations" ADD COLUMN "last_read_at" timestamp with time zone;
UPDATE "conversations" SET "last_read_at" = now() WHERE "last_read_at" IS NULL;
