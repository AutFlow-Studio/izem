import { db, notificationsTable } from "@workspace/db";
import type { InsertNotification } from "@workspace/db";

/**
 * Fire-and-forget helper — inserts a notification and never throws.
 * Use after the primary mutation succeeds.
 */
export async function createNotification(data: InsertNotification): Promise<void> {
  try {
    await db.insert(notificationsTable).values(data);
  } catch (err) {
    // Non-fatal — log but don't propagate so the calling route isn't affected
    console.error("[notifications] failed to create notification:", err);
  }
}
