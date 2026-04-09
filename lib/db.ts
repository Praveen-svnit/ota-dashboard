// Neon PostgreSQL only — SQLite fallback removed
export { getSql, initPostgresSchema } from "./db-postgres";
export const isPg = () => true;
