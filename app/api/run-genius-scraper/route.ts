import { spawn, execSync, ChildProcess } from "child_process";
import fs from "fs";

const SCRAPER_PATH = "C:\\Users\\cs03778\\genius_scraper.py";
const STATUS_FILE  = "C:\\Users\\cs03778\\genius_status.json";
const SYNC_URL     = "http://localhost:3000/api/sync-genius";

let scraperRunning = false;
let activeChild: ChildProcess | null = null;

function writeStatus(obj: object) {
  try { fs.writeFileSync(STATUS_FILE, JSON.stringify(obj)); } catch {}
}

function findPython(): string | null {
  const candidates = [
    "python", "python3", "py",
    "C:\\Users\\cs03778\\AppData\\Local\\anaconda3\\python.exe",
    "C:\\Users\\cs03778\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe",
    "C:\\Python312\\python.exe", "C:\\Python311\\python.exe", "C:\\Python310\\python.exe",
  ];
  for (const cmd of candidates) {
    try { execSync(`"${cmd}" --version`, { stdio: "ignore", timeout: 3000 }); return cmd; } catch {}
  }
  return null;
}

function killExistingScrapers() {
  // Kill any leftover genius_scraper.py processes (e.g. from a previous server run)
  try { execSync(`wmic process where "CommandLine like '%genius_scraper%'" call terminate`, { stdio: "ignore" }); } catch {}
}

// POST — start scraper
export async function POST() {
  if (scraperRunning) {
    return Response.json({ error: "Scraper already running" }, { status: 409 });
  }
  // Kill any orphaned scraper processes from a previous server session
  killExistingScrapers();


  const pythonCmd = findPython();
  if (!pythonCmd) {
    return Response.json({ error: "Python not found. Make sure Python is installed and in PATH." }, { status: 500 });
  }
  if (!fs.existsSync(SCRAPER_PATH)) {
    return Response.json({ error: `Scraper not found at ${SCRAPER_PATH}` }, { status: 500 });
  }

  writeStatus({ status: "starting", done: 0, total: 0, current: "", log: [`Starting with ${pythonCmd}...`] });

  const child = spawn(pythonCmd, [SCRAPER_PATH], {
    env: { ...process.env, GENIUS_STATUS_FILE: STATUS_FILE, GENIUS_SYNC_URL: SYNC_URL, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
  });

  activeChild    = child;
  scraperRunning = true;

  let stderrBuf = "";
  let stdoutBuf = "";
  child.stderr?.on("data", (chunk: Buffer) => { stderrBuf += chunk.toString(); });
  child.stdout?.on("data", (chunk: Buffer) => { stdoutBuf += chunk.toString(); });

  child.on("close", (code) => {
    scraperRunning = false;
    activeChild    = null;
    if (code !== 0 && code !== null) {
      const errMsg = (stderrBuf || stdoutBuf || `Process exited with code ${code}`).slice(-1000);
      const lines  = errMsg.split("\n").filter(l => l.trim());
      writeStatus({ status: "error", error: errMsg, done: 0, total: 0, current: "", log: lines });
    }
  });

  child.on("error", (err) => {
    scraperRunning = false;
    activeChild    = null;
    writeStatus({ status: "error", error: err.message, done: 0, total: 0, current: "", log: [err.message] });
  });

  return Response.json({ started: true, pid: child.pid, pythonCmd });
}

// DELETE — stop scraper
export async function DELETE() {
  // Kill tracked child process if we have one
  if (activeChild?.pid) {
    try { activeChild.kill("SIGTERM"); } catch {}
    try { execSync(`taskkill /PID ${activeChild.pid} /T /F`, { stdio: "ignore" }); } catch {}
  }
  // Also kill ANY genius_scraper.py Python process (catches orphans from server restarts)
  try { execSync(`wmic process where "CommandLine like '%genius_scraper%'" call terminate`, { stdio: "ignore" }); } catch {}

  scraperRunning = false;
  activeChild    = null;
  writeStatus({ status: "stopped", done: 0, total: 0, current: "", log: ["⛔ Stopped by user"] });
  return Response.json({ stopped: true });
}

// GET — check if running
export async function GET() {
  return Response.json({ running: scraperRunning });
}
