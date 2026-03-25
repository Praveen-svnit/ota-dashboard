import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { signSession, sessionCookieOptions, SessionUser } from "@/lib/auth";

interface UserRow {
  id: string; username: string; passwordHash: string;
  name: string; role: string; ota: string | null;
  teamLead: string | null; active: number;
}

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return Response.json({ error: "Username and password required" }, { status: 400 });
  }

  const db  = getDb();
  const row = db.prepare("SELECT * FROM Users WHERE username = ? AND active = 1").get(username) as UserRow | undefined;

  if (!row || !bcrypt.compareSync(password, row.passwordHash)) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const user: SessionUser = {
    id:       row.id,
    username: row.username,
    name:     row.name,
    role:     row.role as SessionUser["role"],
    ota:      row.ota ?? null,
    teamLead: row.teamLead ?? null,
  };

  const token = await signSession(user);
  const jar   = await cookies();
  jar.set(sessionCookieOptions(token));

  return Response.json({ ok: true, user });
}
