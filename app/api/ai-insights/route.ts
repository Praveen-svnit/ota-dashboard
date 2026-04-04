import { generateProductionDashboard2Answer } from "@/lib/production-dashboard-analytics";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const history = Array.isArray(body.history)
      ? body.history.filter((message: unknown) =>
          typeof message === "object" && message !== null &&
          (((message as { role?: string }).role === "user") || ((message as { role?: string }).role === "assistant")) &&
          typeof (message as { content?: unknown }).content === "string"
        )
      : [];

    if (!question) return Response.json({ error: "Question is required." }, { status: 400 });

    const result = await generateProductionDashboard2Answer(question, history);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to generate the AI answer." }, { status: 500 });
  }
}
