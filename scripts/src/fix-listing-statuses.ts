/**
 * One-shot: move stuck listings into the simplified flow.
 *   draft    → submitted  (enter moderation queue)
 *   approved → published  (go live; set published_at if missing)
 *
 * Run: pnpm --filter @workspace/scripts run fix-listing-statuses
 * Docker: docker compose --profile tools run --rm fix-listing-statuses
 */
import "@workspace/db/load-env";
import { db } from "@workspace/db";
import { listingsTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";

async function main() {
  console.log("Fixing listing statuses...\n");

  const submitted = await db
    .update(listingsTable)
    .set({ status: "submitted" })
    .where(eq(listingsTable.status, "draft"))
    .returning({ id: listingsTable.id });

  console.log(`  draft → submitted: ${submitted.length}`);

  const published = await db
    .update(listingsTable)
    .set({
      status: "published",
      publishedAt: new Date(),
    })
    .where(eq(listingsTable.status, "approved"))
    .returning({ id: listingsTable.id });

  console.log(`  approved → published: ${published.length}`);

  const stamped = await db
    .update(listingsTable)
    .set({ publishedAt: new Date() })
    .where(and(eq(listingsTable.status, "published"), isNull(listingsTable.publishedAt)))
    .returning({ id: listingsTable.id });

  if (stamped.length > 0) {
    console.log(`  stamped published_at on published: ${stamped.length}`);
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("fix-listing-statuses failed:", err);
  process.exit(1);
});
