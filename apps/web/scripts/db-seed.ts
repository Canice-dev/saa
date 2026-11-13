import "dotenv/config";
import { getDatabase } from "@/lib/db/client";
import { businesses, businessSettings } from "@/lib/db/schema";

async function main() {
  const db = getDatabase();

  await db.insert(businesses).values({ id: 1 }).onConflictDoNothing();
  await db.insert(businessSettings).values({ businessId: 1 }).onConflictDoNothing();

  console.log("Business defaults are ready.");
}

void main().catch(() => {
  console.error("Failed to seed business defaults.");
  process.exitCode = 1;
});
