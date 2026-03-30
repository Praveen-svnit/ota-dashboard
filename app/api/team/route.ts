import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();

  const users = await sql`
    SELECT id, name, role, ota, team_lead AS "teamLead", active
    FROM users
    WHERE active = 1
    ORDER BY role, team_lead, name
  ` as { id: string; name: string; role: string; ota: string | null; teamLead: string | null; active: number }[];

  // Group: TLs first, then interns under their TL
  const tls     = users.filter(u => u.role === "tl" || u.role === "head");
  const interns = users.filter(u => u.role === "intern");
  const admins  = users.filter(u => u.role === "admin");

  // Build team groups
  const groups: Record<string, { tl: typeof users[0] | null; members: typeof users }> = {};

  for (const tl of tls) {
    const key = tl.name;
    if (!groups[key]) groups[key] = { tl, members: [] };
    else groups[key].tl = tl;
  }

  for (const intern of interns) {
    const key = intern.teamLead ?? "Unassigned";
    if (!groups[key]) groups[key] = { tl: null, members: [] };
    groups[key].members.push(intern);
  }

  return Response.json({ groups, admins, allUsers: users });
}
