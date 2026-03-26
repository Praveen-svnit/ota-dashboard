import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  if (!propertyId) return Response.json({ error: "propertyId required" }, { status: 400 });

  const db = getDb();
  const tasks = db.prepare(`
    SELECT t.*, u.name as assignedName, c.name as createdByName
    FROM Tasks t
    LEFT JOIN Users u ON u.id = t.assignedTo
    LEFT JOIN Users c ON c.id = t.createdBy
    WHERE t.propertyId = ?
    ORDER BY t.createdAt DESC
  `).all(propertyId);

  return Response.json({ tasks });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { propertyId, title, description, priority, assignedTo, dueDate } = body;

  if (!propertyId || !title?.trim()) {
    return Response.json({ error: "propertyId and title are required" }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO Tasks (propertyId, title, description, priority, assignedTo, createdBy, dueDate, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    propertyId,
    title.trim(),
    description?.trim() || null,
    priority || "medium",
    assignedTo || null,
    session.userId,
    dueDate || null,
  );

  return Response.json({ id: result.lastInsertRowid });
}
