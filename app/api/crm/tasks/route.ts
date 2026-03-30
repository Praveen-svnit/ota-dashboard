import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { enrichTaskRecord } from "@/lib/dashboard-task-analytics";
import { findTeamMemberByName } from "@/lib/team-directory";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  if (!propertyId) return Response.json({ error: "propertyId required" }, { status: 400 });

  const sql = await getSql();
  const tasks = await sql`
    SELECT
      t.*,
      COALESCE(NULLIF(t.assigned_name, ''), u.name) AS "assignedName",
      c.name AS "createdByName"
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.property_id = ${propertyId}
    ORDER BY t.created_at DESC
  `;

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

  const sql = await getSql();
  const rows = await sql`
    INSERT INTO tasks (
      property_id, task_type, title, description, priority, assigned_to, assigned_name,
      assigned_role, assigned_team_lead, created_by, due_date, follow_up_at, task_date,
      source_route, source_label, source_page, source_section, bucket, ai_summary, ai_insight,
      created_at, updated_at
    )
    VALUES (
      ${propertyId}, 'property', ${title.trim()}, ${description?.trim() || null},
      ${priority || "medium"}, ${assignedTo || null}, ${resolvedAssignedName},
      ${member?.role ?? null}, ${member?.teamLead ?? null}, ${session.id},
      ${dueDate || null}, ${followUpAt || null}, CURRENT_DATE,
      ${`/crm/${propertyId}`}, ${`Property ${propertyId}`}, ${"Property CRM"},
      ${"Property CRM task panel"}, ${enriched.bucket}, ${enriched.aiSummary}, ${enriched.aiInsight},
      NOW(), NOW()
    )
    RETURNING id
  ` as Array<{ id: number }>;

  return Response.json({ id: rows[0].id });
}
