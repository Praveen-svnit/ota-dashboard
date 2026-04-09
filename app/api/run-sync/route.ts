import { execFile } from "child_process";
import path from "path";

let running = false;

export async function POST() {
  if (running) return Response.json({ error: "Sync already in progress" }, { status: 409 });
  running = true;

  const syncDir = path.resolve(process.cwd());

  return new Promise<Response>((resolve) => {
    execFile("node", ["sync.js"], { cwd: syncDir, timeout: 300_000 }, (err, stdout, stderr) => {
      running = false;
      const log = [stdout, stderr].filter(Boolean).join('\n');
      if (err) {
        resolve(Response.json({ error: log || err.message }, { status: 500 }));
      } else {
        resolve(Response.json({ ok: true, log }));
      }
    });
  });
}
