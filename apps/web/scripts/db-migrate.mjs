import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Add it to apps/web/.env before migrating.");
}

const sql = neon(databaseUrl);
await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`;

const migrationDirectory = resolve("db/migrations");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((file) => /^\d+_[a-z0-9_]+\.sql$/i.test(file))
  .sort();

for (const file of migrationFiles) {
  const version = file.replace(/\.sql$/i, "");
  const existing = await sql`SELECT version FROM schema_migrations WHERE version = ${version}`;
  if (existing.length > 0) {
    console.log(`Migration ${version} is already applied.`);
    continue;
  }

  const migrationSql = await readFile(resolve(migrationDirectory, file), "utf8");
  const statements = migrationSql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  await sql.transaction((transactionSql) => [
    ...statements.map((statement) => transactionSql.query(statement, [])),
    transactionSql`INSERT INTO schema_migrations (version) VALUES (${version})`,
  ]);
  console.log(`Applied migration ${version}.`);
}
