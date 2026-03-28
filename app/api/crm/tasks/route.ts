import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { enrichTaskRecord } from "@/lib/dashboard-task-analytics";
import { findTeamMemberByName } from "@/lib/team-directory";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  if (!propertyId) return Response.json({ error: "propertyId required" }, { status: 400 });

  const db = getDb();
  const tasks = db.prepare(`
    SELECT t.*, COALESCE(NULLIF(t.assignedName, ''), u.name) as assignedName, c.name as createdByName
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
  const { propertyId, title, description, priority, assignedTo, assignedName, dueDate, followUpAt } = body;

  if (!propertyId || !title?.trim()) {
    return Response.json({ error: "propertyId and title are required" }, { status: 400 });
  }

  const resolvedAssignedName = typeof assignedName === "string" && assignedName.trim() ? assignedName.trim() : null;
  const member = findTeamMemberByName(resolvedAssignedName);
  const enriched = enrichTaskRecord({
    title: title.trim(),
    description: description?.trim() || "",
    priority: priority || "medium",
    relatedOta: null,
    assignedName: resolvedAssignedName,
    sourceLabel: `Property ${propertyId}`,
    sourceSection: "Property CRM task panel",
    sourcePage: "Property CRM",
  });

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO Tasks (
      propertyId, taskType, title, description, priority, assignedTo, assignedName,
      assignedRole, assignedTeamLead, createdBy, dueDate, followUpAt, taskDate,
      sourceRoute, sourceLabel, sourcePage, sourceSection, bucket, aiSummary, aiInsight,
      createdAt, updatedAt
    )
    VALUES (?, 'property', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now','localtime'), ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    propertyId,
    title.trim(),
    description?.trim() || null,
    priority || "medium",
    assignedTo || null,
    resolvedAssignedName,
    member?.role ?? null,
    member?.teamLead ?? null,
    session.id,
    dueDate || null,
    followUpAt || null,
    `/crm/${propertyId}`,
    `Property ${propertyId}`,
    "Property CRM",
    "Property CRM task panel",
    enriched.bucket,
    enriched.aiSummary,
    enriched.aiInsight,
  );

  return Response.json({ id: result.lastInsertRowid });
}
