import { buildProductionDashboard2Snapshot } from "@/lib/production-dashboard-analytics";

export async function GET() {
  try {
    return Response.json(await buildProductionDashboard2Snapshot());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to build OTA Analytics snapshot." },
      { status: 500 }
    );
  }
}
