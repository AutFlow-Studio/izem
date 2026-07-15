import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, documentsTable, activityTable, clientsTable } from "@workspace/db";
import { createNotification } from "../lib/createNotification";
import {
  ListDocumentsParams,
  CreateDocumentParams,
  CreateDocumentBody,
  UpdateDocumentParams,
  UpdateDocumentBody,
  DeleteDocumentParams,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const objectStorage = new ObjectStorageService();

const router: IRouter = Router();

function mapDocument(d: typeof documentsTable.$inferSelect) {
  return { ...d, createdAt: d.createdAt.toISOString() };
}

router.get("/documents", async (req, res): Promise<void> => {
  const rows = await db
    .select({ document: documentsTable, clientName: clientsTable.companyName })
    .from(documentsTable)
    .leftJoin(clientsTable, eq(documentsTable.clientId, clientsTable.id))
    .orderBy(documentsTable.createdAt);

  res.json(
    rows.map(({ document, clientName }) => ({
      ...mapDocument(document),
      clientName: clientName ?? "Unknown",
    })),
  );
});

router.get("/clients/:clientId/documents", async (req, res): Promise<void> => {
  const params = ListDocumentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.clientId, params.data.clientId))
    .orderBy(documentsTable.createdAt);

  res.json(docs.map(mapDocument));
});

router.post("/clients/:clientId/documents", async (req, res): Promise<void> => {
  const params = CreateDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [doc] = await db
    .insert(documentsTable)
    .values({ ...parsed.data, clientId: params.data.clientId })
    .returning();

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.clientId));

  await db.insert(activityTable).values({
    type: "document_added",
    entityType: "document",
    entityId: doc.id,
    description: `Document "${doc.title}" added`,
    clientId: doc.clientId,
  });

  // Notification
  void createNotification({
    type: "document_uploaded",
    title: "Document uploaded",
    message: `"${doc.title}" uploaded${client ? ` for ${client.companyName}` : ""}.`,
    entityType: "document",
    entityId: doc.id,
    href: `/documents`,
  });

  res.status(201).json(mapDocument(doc));
});

router.patch("/documents/:id", async (req, res): Promise<void> => {
  const params = UpdateDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [doc] = await db
    .update(documentsTable)
    .set(parsed.data)
    .where(eq(documentsTable.id, params.data.id))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json(mapDocument(doc));
});

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, params.data.id))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // Fire-and-forget GCS cleanup for file-backed documents
  if (doc.url?.startsWith("/objects/")) {
    objectStorage
      .getObjectEntityFile(doc.url)
      .then((file) => file.delete())
      .catch(() => { /* object may already be gone — ignore */ });
  }

  res.sendStatus(204);
});

export default router;
