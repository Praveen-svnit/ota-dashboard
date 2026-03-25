import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

interface UserRow {
  id: string; username: string; name: string; role: string;
  ota: string | null; teamLead: string | null; active: number; createdAt: string;
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const db   = getDb();
  const rows = db.prepare("SELECT id,username,name,role,ota,teamLead,active,createdAt FROM Users ORDER BY role,name").all() as UserRow[];
  return Response.json({ users: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { username, password, name, role, ota, teamLead } = await req.json();
  if (!username || !password || !name || !role) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db   = getDb();
  const hash = bcrypt.hashSync(password, 10);
  const id   = "user_" + crypto.randomBytes(8).toString("hex");

  try {
    db.prepare(`
      INSERT INTO Users (id, username, passwordHash, name, role, ota, teamLead, active, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, username, hash, name, role, ota ?? null, teamLead ?? null, new Date().toISOString());
  } catch {
    return Response.json({ error: "Username already exists" }, { status: 409 });
  }

  return Response.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, password, name, role, ota, teamLead, active } = await req.json();
  if (!id) return Response.json({ error: "User id required" }, { status: 400 });

  const db = getDb();

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE Users SET passwordHash = ? WHERE id = ?").run(hash, id);
  }
  if (name     !== undefined) db.prepare("UPDATE Users SET name = ? WHERE id = ?").run(name, id);
  if (role     !== undefined) db.prepare("UPDATE Users SET role = ? WHERE id = ?").run(role, id);
  if (ota      !== undefined) db.prepare("UPDATE Users SET ota = ? WHERE id = ?").run(ota ?? null, id);
  if (teamLead !== undefined) db.prepare("UPDATE Users SET teamLead = ? WHERE id = ?").run(teamLead ?? null, id);
  if (active   !== undefined) db.prepare("UPDATE Users SET active = ? WHERE id = ?").run(active ? 1 : 0, id);

  return Response.json({ ok: true });
}
