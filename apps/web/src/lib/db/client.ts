import { drizzle } from "drizzle-orm/neon-http";

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  return drizzle(connectionString);
}

type Database = ReturnType<typeof createDatabase>;
let cachedDatabase: Database | undefined;

export function getDatabase(): Database {
  cachedDatabase ??= createDatabase();
  return cachedDatabase;
}
