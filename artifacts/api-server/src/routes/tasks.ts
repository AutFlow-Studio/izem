import { Router, type IRouter } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, tasksTable, clientsTable, projectsTable, activityTable } from "@workspace/db";
import { createNotification } from "../lib/createNotification";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function mapTask(t: typeof tasksTable.$inferSelect) {
  const [client] = t.clientId
    ? await db.select().from(clientsTable).where(eq(clientsTable.id, t.clientId))
    : [null];
  const [project] = t.projectId
    ? await db.select().from(projectsTable).where(eq(projectsTable.id, t.projectId))
    : [null];
  return {
    ...t,
    clientName: client?.companyName ?? null,
    projectName: project?.name ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { clientId, projectId, status } = parsed.data;

  const conditions = [];
  if (clientId) conditions.push(eq(tasksTable.clientId, clientId));
  if (projectId) conditions.push(eq(tasksTable.projectId, projectId));
  if (status) conditions.push(eq(tasksTable.status, status));

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${tasksTable.createdAt} DESC`);

  // Batch fetch client and project names
  const clientIds = [...new Set(tasks.map((t) => t.clientId).filter(Boolean) as number[])];
  const projectIds = [...new Set(tasks.map((t) => t.projectId).filter(Boolean) as number[])];

  const [clients, projects] = await Promise.all([
    clientIds.length > 0
      ? db.select().from(clientsTable).where(inArray(clientsTable.id, clientIds))
      : Promise.resolve([]),
    projectIds.length > 0
      ? db.select().from(projectsTable).where(inArray(projectsTable.id, projectIds))
      : Promise.resolve([]),
  ]);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.companyName]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  res.json(
    tasks.map((t) => ({
      ...t,
      clientName: t.clientId ? (clientMap[t.clientId] ?? null) : null,
      projectName: t.projectId ? (projectMap[t.projectId] ?? null) : null,
      createdAt: t.createdAt.toISOString(),
    })),
  );
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db.insert(tasksTable).values(parsed.data).returning();

  await db.insert(activityTable).values({
    type: "task_created",
    entityType: "task",
    entityId: task.id,
    description: `Task "${task.title}" created`,
    clientId: task.clientId ?? null,
  });

  // Notification
  void createNotification({
    type: "task_created",
    title: "Task created",
    message: `Task "${task.title}" (${task.priority} priority) has been added.`,
    entityType: "task",
    entityId: task.id,
    href: `/tasks`,
  });

  res.status(201).json(await mapTask(task));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db
    .update(tasksTable)
    .set(parsed.data)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // Notification when a task is completed
  if (parsed.data.status === "done") {
    void createNotification({
      type: "task_completed",
      title: "Task completed",
      message: `Task "${task.title}" has been marked as done.`,
      entityType: "task",
      entityId: task.id,
      href: `/tasks`,
    });
  }

  res.json(await mapTask(task));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [task] = await db
    .delete(tasksTable)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
