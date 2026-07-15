import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";

const router: IRouter = Router();

// ── GET /notifications ──────────────────────────────────────────────────────
router.get("/notifications", async (req, res): Promise<void> => {
  const notifications = await db
    .select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  res.json({
    notifications: notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
});

// ── GET /notifications/unread-count ─────────────────────────────────────────
router.get("/notifications/unread-count", async (_req, res): Promise<void> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(eq(notificationsTable.isRead, false));

  res.json({ count: row?.count ?? 0 });
});

// ── PATCH /notifications/:id/read ───────────────────────────────────────────
router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, id))
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json({ ...notification, createdAt: notification.createdAt.toISOString() });
});

// ── POST /notifications/mark-all-read ───────────────────────────────────────
router.post("/notifications/mark-all-read", async (_req, res): Promise<void> => {
  const updated = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.isRead, false))
    .returning();

  res.json({ updated: updated.length });
});

// ── DELETE /notifications/:id ───────────────────────────────────────────────
router.delete("/notifications/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [notification] = await db
    .delete(notificationsTable)
    .where(eq(notificationsTable.id, id))
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
