import type { Response } from "express";
import { db } from "@workspace/db";
import { creatorProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Reject when the buyer/learner is the same user who owns the listing.
 * Returns true if the response was already sent.
 */
export async function rejectIfOwnListing(
  res: Response,
  listingCreatorProfileId: string,
  buyerUserId: string
): Promise<boolean> {
  const [creator] = await db
    .select({ userId: creatorProfilesTable.userId })
    .from(creatorProfilesTable)
    .where(eq(creatorProfilesTable.id, listingCreatorProfileId))
    .limit(1);

  if (creator && creator.userId === buyerUserId) {
    res.status(403).json({
      error: "You cannot purchase or book your own listing",
      code: "CANNOT_PURCHASE_OWN_LISTING",
    });
    return true;
  }
  return false;
}
