import { Router, type IRouter } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { db, clientsTable, projectsTable, paymentsTable, activityTable } from "@workspace/db";
import { createNotification } from "../lib/createNotification";
import {
  ListClientsQueryParams,
  CreateClientBody,
  GetClientParams,
  UpdateClientParams,
  UpdateClientBody,
  DeleteClientParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/clients", async (req, res): Promise<void> => {
  const parsed = ListClientsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { status, search } = parsed.data;

  const conditions = [];
  if (status) conditions.push(eq(clientsTable.status, status));
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(${ilike(clientsTable.companyName, pattern)} OR ${ilike(clientsTable.industry, pattern)} OR ${ilike(clientsTable.email, pattern)})`,
    );
  }

  const clients = await db
    .select()
    .from(clientsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(clientsTable.companyName);

  res.json(
    clients.map((c) => ({
      ...c,
      contractValue: c.contractValue ? Number(c.contractValue) : null,
      monthlyRetainer: c.monthlyRetainer ? Number(c.monthlyRetainer) : null,
      tags: c.tags ?? [],
      updatedAt: c.updatedAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [client] = await db
    .insert(clientsTable)
    .values({
      ...parsed.data,
      tags: parsed.data.tags ?? [],
      contractValue: parsed.data.contractValue != null ? String(parsed.data.contractValue) : undefined,
      monthlyRetainer: parsed.data.monthlyRetainer != null ? String(parsed.data.monthlyRetainer) : undefined,
    })
    .returning();

  // Log activity
  await db.insert(activityTable).values({
    type: "client_created",
    entityType: "client",
    entityId: client.id,
    description: `Client "${client.companyName}" created`,
    clientId: client.id,
  });

  // Notification
  void createNotification({
    type: "client_created",
    title: "New client added",
    message: `"${client.companyName}" has been added as a client.`,
    entityType: "client",
    entityId: client.id,
    href: `/clients/${client.id}`,
  });

  res.status(201).json({
    ...client,
    contractValue: client.contractValue ? Number(client.contractValue) : null,
    monthlyRetainer: client.monthlyRetainer
      ? Number(client.monthlyRetainer)
      : null,
    tags: client.tags ?? [],
    updatedAt: client.updatedAt.toISOString(),
    createdAt: client.createdAt.toISOString(),
  });
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, params.data.id));

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.clientId, client.id))
    .orderBy(projectsTable.createdAt);

  const openPayments = await db
    .select()
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.clientId, client.id),
        sql`${paymentsTable.status} IN ('pending', 'overdue')`,
      ),
    );

  const allPayments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.clientId, client.id));

  const totalRevenue = allPayments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const outstandingBalance = allPayments
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const recentActivity = await db
    .select()
    .from(activityTable)
    .where(eq(activityTable.clientId, client.id))
    .orderBy(sql`${activityTable.createdAt} DESC`)
    .limit(10);

  res.json({
    ...client,
    contractValue: client.contractValue ? Number(client.contractValue) : null,
    monthlyRetainer: client.monthlyRetainer
      ? Number(client.monthlyRetainer)
      : null,
    tags: client.tags ?? [],
    updatedAt: client.updatedAt.toISOString(),
    createdAt: client.createdAt.toISOString(),
    projects: projects.map((p) => ({
      ...p,
      clientName: client.companyName,
      estimatedBudget: p.estimatedBudget ? Number(p.estimatedBudget) : null,
      actualCost: p.actualCost ? Number(p.actualCost) : null,
      revenue: p.revenue ? Number(p.revenue) : null,
      profit: p.revenue && p.actualCost
        ? Number(p.revenue) - Number(p.actualCost)
        : null,
      updatedAt: p.updatedAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    openPayments: openPayments.map((p) => ({
      ...p,
      clientName: client.companyName,
      amount: Number(p.amount),
      remainingBalance: p.remainingBalance ? Number(p.remainingBalance) : null,
      createdAt: p.createdAt.toISOString(),
    })),
    totalRevenue,
    outstandingBalance,
    recentActivity: recentActivity.map((a) => ({
      ...a,
      clientName: client.companyName,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

router.patch("/clients/:id", async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [client] = await db
    .update(clientsTable)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
      contractValue: parsed.data.contractValue != null ? String(parsed.data.contractValue) : undefined,
      monthlyRetainer: parsed.data.monthlyRetainer != null ? String(parsed.data.monthlyRetainer) : undefined,
    })
    .where(eq(clientsTable.id, params.data.id))
    .returning();

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  await db.insert(activityTable).values({
    type: "client_updated",
    entityType: "client",
    entityId: client.id,
    description: `Client "${client.companyName}" updated`,
    clientId: client.id,
  });

  res.json({
    ...client,
    contractValue: client.contractValue ? Number(client.contractValue) : null,
    monthlyRetainer: client.monthlyRetainer
      ? Number(client.monthlyRetainer)
      : null,
    tags: client.tags ?? [],
    updatedAt: client.updatedAt.toISOString(),
    createdAt: client.createdAt.toISOString(),
  });
});

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [client] = await db
    .delete(clientsTable)
    .where(eq(clientsTable.id, params.data.id))
    .returning();

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
