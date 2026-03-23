import fs from "fs";
import path from "path";

const STATUS_FILE = path.join("C:\\", "Users", "cs03778", "hygiene_status.json");

export async function GET() {
  try {
    if (!fs.existsSync(STATUS_FILE)) {
      return Response.json({ status: "idle", done: 0, total: 0, current: "", log: [] });
    }
    const raw = fs.readFileSync(STATUS_FILE, "utf-8");
    return Response.json(JSON.parse(raw));
  } catch {
    return Response.json({ status: "idle", done: 0, total: 0, current: "", log: [] });
  }
}
