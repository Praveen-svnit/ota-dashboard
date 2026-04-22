import { parseCSV } from "@/lib/sheets";
import { getSession } from "@/lib/auth";

const CM_SHEET_ID  = "1UaxWeAxPNOgPh3YtwO_SYGy8nOnWFw5YkilEtFEJuIc";
const CM_SHEET_TAB = "SU Raw Data Working";

const CHANNEL_CODE_MAP: Record<string, string> = {
  "105": "GoMMT",
  "9":   "Expedia",
  "351": "Cleartrip",
  "19":  "Booking.com",
  "189": "Agoda",
  "97":  "Yatra",
  "217": "EaseMyTrip",
  "396": "Akbar Travels",
};

export interface MappingRow {
  fhId:         string;
  propertyName: string;
  roomTypeId:   string;
  ratePlanCode: string;
  channelCode:  string;
  otaName:      string;
  crsMatch:     "correct" | "inactive" | "missing";
  crsActive:    boolean | null; // null = not found
}

// Parse CRS CSV text into a lookup set
// key = "property_id|room_type_id|rate_plan_code"  value = is_active
function parseCRS(csv: string): Map<string, boolean> {
  const map = new Map<string, boolean>();
  const { rows } = parseCSV(csv);
  for (const row of rows) {
    // Col A: property_id, B: room_type_id, C: rate_plan_code, D: max_occupancy, E: is_active
    const [propertyId, roomTypeId, ratePlanCode, , isActiveRaw] = row;
    if (!propertyId || !roomTypeId || !ratePlanCode) continue;
    const isActive = (isActiveRaw ?? "").trim().toUpperCase() !== "FALSE";
    const key = `${propertyId.trim()}|${roomTypeId.trim()}|${ratePlanCode.trim().toUpperCase()}`;
    map.set(key, isActive);
  }
  return map;
}

// Parse channel manager sheet: cols A-E (SuID, propertyName, pmsroomid, pmsrateid, channelcode)
// pmsrateid format: FH_ID-RoomType-RatePlan-Random  e.g. "24873-1-CP-OEXISYSXD"
function parseCM(csv: string): { fhId: string; propertyName: string; roomTypeId: string; ratePlanCode: string; channelCode: string }[] {
  const { rows } = parseCSV(csv);
  const result: { fhId: string; propertyName: string; roomTypeId: string; ratePlanCode: string; channelCode: string }[] = [];

  for (const row of rows) {
    const propertyName = (row[1] ?? "").trim();
    const pmsroomid   = (row[2] ?? "").trim();
    const pmsrateid   = (row[3] ?? "").trim();
    const channelCode = (row[4] ?? "").trim();

    if (!pmsrateid || !channelCode) continue;
    if (!CHANNEL_CODE_MAP[channelCode]) continue; // unknown OTA — skip

    // Extract FH_ID from pmsroomid: first segment before "-"
    const fhId = pmsroomid.split("-")[0] ?? "";
    if (!fhId) continue;

    // Extract from pmsrateid: FH_ID-RoomType-RatePlan-Random
    const parts = pmsrateid.split("-");
    if (parts.length < 3) continue;
    const roomTypeId   = parts[1] ?? "";
    const ratePlanCode = (parts[2] ?? "").toUpperCase();

    result.push({ fhId, propertyName, roomTypeId, ratePlanCode, channelCode });
  }
  return result;
}

// GET — fetch channel manager data only (no CRS, used to show the raw feed)
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = `https://docs.google.com/spreadsheets/d/${CM_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CM_SHEET_TAB)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch channel manager sheet: ${res.status}`);
    const csv = await res.text();
    const cmRows = parseCM(csv);

    // Return summary per OTA
    const otaSummary: Record<string, { total: number }> = {};
    for (const r of cmRows) {
      const ota = CHANNEL_CODE_MAP[r.channelCode] ?? r.channelCode;
      otaSummary[ota] = { total: (otaSummary[ota]?.total ?? 0) + 1 };
    }

    return Response.json({ otaSummary, totalRows: cmRows.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST — receive CRS CSV in body, fetch CM sheet, run comparison
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { crsCsv } = await req.json() as { crsCsv: string };
    if (!crsCsv) return Response.json({ error: "crsCsv is required" }, { status: 400 });

    // Fetch channel manager sheet
    const url = `https://docs.google.com/spreadsheets/d/${CM_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CM_SHEET_TAB)}`;
    const cmRes = await fetch(url, { cache: "no-store" });
    if (!cmRes.ok) throw new Error(`Failed to fetch channel manager sheet: ${cmRes.status}`);
    const cmCsv = await cmRes.text();

    const cmRows   = parseCM(cmCsv);
    const crsMap   = parseCRS(crsCsv);

    const rows: MappingRow[] = cmRows.map(r => {
      const key      = `${r.fhId}|${r.roomTypeId}|${r.ratePlanCode}`;
      const isActive = crsMap.get(key);
      const otaName  = CHANNEL_CODE_MAP[r.channelCode] ?? r.channelCode;

      let crsMatch: MappingRow["crsMatch"];
      if (isActive === undefined)    crsMatch = "missing";
      else if (isActive === false)   crsMatch = "inactive";
      else                           crsMatch = "correct";

      return {
        fhId:         r.fhId,
        propertyName: r.propertyName,
        roomTypeId:   r.roomTypeId,
        ratePlanCode: r.ratePlanCode,
        channelCode:  r.channelCode,
        otaName,
        crsMatch,
        crsActive:    isActive ?? null,
      };
    });

    return Response.json({ rows });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
