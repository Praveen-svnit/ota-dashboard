import { initPostgresSchema } from "@/lib/db-postgres";

export async function POST() {
  try {
    await initPostgresSchema();
    return Response.json({ ok: true, message: "Postgres schema initialised successfully" });
  } catch (err) {
    console.error("init-db error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
