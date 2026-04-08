import { getSql } from "@/lib/db-postgres";
import { getSession } from "@/lib/auth";
import { createHash, randomBytes } from "crypto";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function ensureTable() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      key_hash    TEXT NOT NULL UNIQUE,
      created_by  TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used   TIMESTAMPTZ,
      revoked     BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;
}

// GET — list all keys
export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureTable();
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, created_by, created_at, last_used, revoked
    FROM api_keys
    ORDER BY created_at DESC
  `;
  return Response.json({ keys: rows });
}

// POST — generate a new key
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await req.json();
  if (!name?.trim()) return Response.json({ error: "Name is required" }, { status: 400 });

  await ensureTable();
  const raw  = "ota_" + randomBytes(32).toString("hex");
  const hash = hashKey(raw);
  const id   = "key_" + randomBytes(8).toString("hex");

  const sql = getSql();
  await sql`
    INSERT INTO api_keys (id, name, key_hash, created_by)
    VALUES (${id}, ${name.trim()}, ${hash}, ${session.id})
  `;

  return Response.json({ id, name: name.trim(), key: raw });
}

// DELETE — revoke a key
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const sql = getSql();
  await sql`UPDATE api_keys SET revoked = TRUE WHERE id = ${id}`;
  return Response.json({ ok: true });
}
