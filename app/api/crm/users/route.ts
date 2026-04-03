import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

interface UserRow {
  id: string; username: string; name: string; role: string;
  ota: string | null; teamLead: string | null; active: number; createdAt: string;
  email: string | null; phone: string | null; empId: string | null;
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      username,
      name,
      role,
      ota,
      team_lead AS "teamLead",
      active,
      created_at AS "createdAt",
      email,
      phone,
      emp_id AS "empId"
    FROM users
    ORDER BY role, name
  ` as UserRow[];
  return Response.json({ users: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { username, password, name, role, ota, teamLead, email, phone, empId } = await req.json();
  if (!username || !password || !name || !role) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sql  = getSql();
  const hash = bcrypt.hashSync(password, 10);
  const id   = "user_" + crypto.randomBytes(8).toString("hex");

  try {
    await sql`
      INSERT INTO users (id, username, password_hash, name, role, ota, team_lead, active, created_at, email, phone, emp_id)
      VALUES (
        ${id},
        ${username},
        ${hash},
        ${name},
        ${role},
        ${ota ?? null},
        ${teamLead ?? null},
        1,
        ${new Date().toISOString()},
        ${email ?? null},
        ${phone ?? null},
        ${empId ?? null}
      )
    `;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return Response.json({ error: "Username already exists" }, { status: 409 });
    }
    throw err;
  }

  return Response.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, password, name, role, ota, teamLead, active, email, phone, empId } = await req.json();
  if (!id) return Response.json({ error: "User id required" }, { status: 400 });

  const sql = getSql();

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${id}`;
  }
  if (name      !== undefined) await sql`UPDATE users SET name = ${name} WHERE id = ${id}`;
  if (role      !== undefined) await sql`UPDATE users SET role = ${role} WHERE id = ${id}`;
  if (ota       !== undefined) await sql`UPDATE users SET ota = ${ota ?? null} WHERE id = ${id}`;
  if (teamLead  !== undefined) await sql`UPDATE users SET team_lead = ${teamLead ?? null} WHERE id = ${id}`;
  if (active    !== undefined) await sql`UPDATE users SET active = ${active ? 1 : 0} WHERE id = ${id}`;
  if (email     !== undefined) await sql`UPDATE users SET email = ${email ?? null} WHERE id = ${id}`;
  if (phone     !== undefined) await sql`UPDATE users SET phone = ${phone ?? null} WHERE id = ${id}`;
  if (empId     !== undefined) await sql`UPDATE users SET emp_id = ${empId ?? null} WHERE id = ${id}`;

  return Response.json({ ok: true });
}
