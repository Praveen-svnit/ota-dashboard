import Anthropic from "@anthropic-ai/sdk";
import { findTeamMemberByName } from "@/lib/team-directory";

export type DashboardTaskStatus = "open" | "in_progress" | "pending" | "supervisor_attention" | "done";
export type DashboardTaskPriority = "low" | "medium" | "high" | "critical";
export type DashboardTaskBucket =
  | "Supply Activation"
  | "Pricing Yield"
  | "Content Quality"
  | "OTA Follow-up"
  | "Data Issue"
  | "Escalation"
  | "General";

export interface DashboardTaskComment {
  id: number;
  taskId: number;
  comment: string;
  commentType: "update" | "completion" | "follow_up";
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface DashboardTaskRecord {
  id: number;
  propertyId: string;
  taskType: "property" | "dashboard" | "adhoc";
  title: string;
  description: string | null;
  status: DashboardTaskStatus;
  priority: DashboardTaskPriority;
  assignedTo: string | null;
  assignedName: string | null;
  assignedRole: string | null;
  assignedTeamLead: string | null;
  createdBy: string | null;
  createdByName: string | null;
  dueDate: string | null;
  followUpAt: string | null;
  taskDate: string | null;
  sourceRoute: string | null;
  sourceLabel: string | null;
  sourceAnchor: string | null;
  sourcePage: string | null;
  sourceSection: string | null;
  relatedOta: string | null;
  relatedCity: string | null;
  completionComment: string | null;
  completedAt: string | null;
  bucket: DashboardTaskBucket | null;
  aiSummary: string | null;
  aiInsight: string | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
  comments: DashboardTaskComment[];
}

export interface DashboardTaskInsightSummary {
  totalActive: number;
  createdToday: number;
  dueToday: number;
  overdue: number;
  blocked: number;
  supervisorAttention: number;
  highPriority: number;
  followUpsPending: number;
  bucketCounts: Array<{ bucket: DashboardTaskBucket; count: number }>;
  assigneeLoad: Array<{ assignee: string; count: number }>;
  otaHotspots: Array<{ ota: string; count: number }>;
  pageHotspots: Array<{ page: string; count: number }>;
  narrative: string;
  recommendations: string[];
}

type TaskCopilotMessage = { role: "user" | "assistant"; content: string };

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function startsWithToday(value: string | null | undefined) {
  return Boolean(value && value.slice(0, 10) === todayKey());
}

function normalizeText(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function inferBucket(task: Pick<DashboardTaskRecord, "title" | "description" | "relatedOta" | "sourceSection" | "sourcePage">): DashboardTaskBucket {
  const text = normalizeText(task.title, task.description, task.relatedOta, task.sourceSection, task.sourcePage);

  if (/(price|pricing|yield|adr|revenue|discount|rate|parity)/.test(text)) return "Pricing Yield";
  if (/(content|image|photo|description|copy|listing quality|genius|preferred|review)/.test(text)) return "Content Quality";
  if (/(activate|live|supply|listing|inventory|onboard|go live|coverage)/.test(text)) return "Supply Activation";
  if (/(follow up|follow-up|call|owner|agoda|booking|expedia|yatra|ixigo|cleartrip|gommt|emt|akbar)/.test(text)) return "OTA Follow-up";
  if (/(data|dashboard|metric|kpi|bug|query|report|sync|wrong|mismatch)/.test(text)) return "Data Issue";
  if (/(urgent|critical|escalat|block|blocked|priority)/.test(text)) return "Escalation";
  return "General";
}

function buildAiSummary(task: Pick<DashboardTaskRecord, "title" | "description" | "priority" | "relatedOta" | "assignedName" | "sourceLabel" | "bucket">) {
  const owner = task.assignedName ?? "Unassigned owner";
  const otaLine = task.relatedOta ? ` on ${task.relatedOta}` : "";
  const sourceLine = task.sourceLabel ? ` from ${task.sourceLabel}` : "";
  return `${owner} needs to action "${task.title}"${otaLine}${sourceLine}. Priority is ${task.priority}${task.description ? ` and the brief says ${task.description}` : ""}.`;
}

function buildAiInsight(task: Pick<DashboardTaskRecord, "bucket" | "priority" | "assignedName" | "followUpAt" | "status">) {
  const followUp = task.followUpAt ? ` Follow-up is expected by ${task.followUpAt.slice(0, 10)}.` : "";
  if (task.status === "supervisor_attention") {
    return `This task is waiting for supervisor attention. Keep the escalation comment visible for admin review.${followUp}`;
  }
  if (task.status === "pending") {
    return `This task is pending follow-up or approval. It still needs a comment trail before closure.${followUp}`;
  }
  if (task.priority === "critical" || task.priority === "high") {
    return `This is a fast-response task in the ${task.bucket ?? "General"} bucket. Owner ${task.assignedName ?? "TBD"} should post progress updates before closure.${followUp}`;
  }
  return `This task belongs to the ${task.bucket ?? "General"} bucket and should stay visible until the owner posts a completion note.${followUp}`;
}

export function enrichTaskRecord<T extends Pick<DashboardTaskRecord, "title" | "description" | "priority" | "relatedOta" | "assignedName" | "sourceLabel" | "sourceSection" | "sourcePage">>(
  input: T
) {
  const bucket = inferBucket(input);
  return {
    bucket,
    aiSummary: buildAiSummary({ ...input, bucket }),
    aiInsight: buildAiInsight({ bucket, priority: input.priority as DashboardTaskPriority, assignedName: input.assignedName ?? null, followUpAt: null, status: "open" }),
  };
}

export function withDerivedTaskFields(task: DashboardTaskRecord): DashboardTaskRecord {
  const member = findTeamMemberByName(task.assignedName);
  const bucket = task.bucket ?? inferBucket(task);
  return {
    ...task,
    bucket,
    assignedRole: task.assignedRole ?? member?.role ?? null,
    assignedTeamLead: task.assignedTeamLead ?? member?.teamLead ?? null,
    aiSummary: task.aiSummary ?? buildAiSummary({ ...task, bucket }),
    aiInsight: task.aiInsight ?? buildAiInsight({ ...task, bucket }),
  };
}

export function buildDashboardTaskInsights(tasks: DashboardTaskRecord[]): DashboardTaskInsightSummary {
  const activeTasks = tasks.filter((task) => task.status !== "done");
  const overdue = activeTasks.filter((task) => task.dueDate && task.dueDate < todayKey()).length;
  const dueToday = activeTasks.filter((task) => startsWithToday(task.dueDate)).length;
  const createdToday = tasks.filter((task) => startsWithToday(task.createdAt) || startsWithToday(task.taskDate)).length;
  const blocked = activeTasks.filter((task) => task.status === "pending").length;
  const supervisorAttention = activeTasks.filter((task) => task.status === "supervisor_attention").length;
  const highPriority = activeTasks.filter((task) => task.priority === "high" || task.priority === "critical").length;
  const followUpsPending = activeTasks.filter((task) => task.followUpAt && task.followUpAt.slice(0, 10) <= todayKey()).length;

  const bucketMap = new Map<DashboardTaskBucket, number>();
  const assigneeMap = new Map<string, number>();
  const otaMap = new Map<string, number>();
  const pageMap = new Map<string, number>();

  for (const task of activeTasks) {
    const bucket = task.bucket ?? inferBucket(task);
    bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + 1);
    assigneeMap.set(task.assignedName ?? "Unassigned", (assigneeMap.get(task.assignedName ?? "Unassigned") ?? 0) + 1);
    if (task.relatedOta) otaMap.set(task.relatedOta, (otaMap.get(task.relatedOta) ?? 0) + 1);
    if (task.sourcePage) pageMap.set(task.sourcePage, (pageMap.get(task.sourcePage) ?? 0) + 1);
  }

  const bucketCounts = [...bucketMap.entries()]
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => b.count - a.count);
  const assigneeLoad = [...assigneeMap.entries()]
    .map(([assignee, count]) => ({ assignee, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const otaHotspots = [...otaMap.entries()]
    .map(([ota, count]) => ({ ota, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const pageHotspots = [...pageMap.entries()]
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const biggestBucket = bucketCounts[0];
  const heaviestAssignee = assigneeLoad[0];
  const hottestOta = otaHotspots[0];

  const narrative = [
    `${activeTasks.length} active tasks are on the board right now.`,
    biggestBucket ? `${biggestBucket.bucket} is the biggest workload bucket with ${biggestBucket.count} tasks.` : "No dominant workload bucket yet.",
    heaviestAssignee ? `${heaviestAssignee.assignee} carries the highest active load at ${heaviestAssignee.count} tasks.` : "No assignee bottleneck is visible yet.",
    hottestOta ? `${hottestOta.ota} is the strongest OTA hotspot with ${hottestOta.count} linked tasks.` : "No OTA hotspot is visible yet.",
  ].join(" ");

  const recommendations = [
    highPriority > 0 ? `Work the ${highPriority} high-priority tasks first and demand comment-backed updates before closure.` : "Keep using comment-backed updates so closures remain auditable.",
    blocked > 0 ? `Resolve the ${blocked} pending tasks before adding more work to the same owners.` : "No pending tasks are visible right now, so the board can stay execution-focused.",
    heaviestAssignee ? `Balance load around ${heaviestAssignee.assignee} if the owner is carrying too many parallel asks.` : "Distribute new tasks across the team list to avoid silent overload.",
  ];

  return {
    totalActive: activeTasks.length,
    createdToday,
    dueToday,
    overdue,
    blocked,
    supervisorAttention,
    highPriority,
    followUpsPending,
    bucketCounts,
    assigneeLoad,
    otaHotspots,
    pageHotspots,
    narrative,
    recommendations,
  };
}

function detectTaskQuestionIntent(question: string) {
  const q = question.toLowerCase();
  if (/(owner|assignee|who|gaurav|gourav|aman|ajeet|vipul|jyoti|abhijeet|rudra|mohit)/.test(q)) return "assignee";
  if (/(ota|agoda|booking|yatra|ixigo|cleartrip|expedia|gommt|emt|akbar)/.test(q)) return "ota";
  if (/(overdue|late|delay|stuck|blocked|pending|supervisor|attention|escalat)/.test(q)) return "risk";
  if (/(bucket|type|theme|summary|summarise|summarize)/.test(q)) return "summary";
  if (/(follow up|follow-up|next|today|due)/.test(q)) return "followup";
  return "overview";
}

function buildDeterministicTaskCopilot(question: string, tasks: DashboardTaskRecord[]) {
  const activeTasks = tasks.filter((task) => task.status !== "done");
  const insights = buildDashboardTaskInsights(tasks);
  const intent = detectTaskQuestionIntent(question);
  const lower = question.toLowerCase();
  const matchingAssignee = activeTasks.filter((task) => (task.assignedName ?? "").toLowerCase().includes(lower) || lower.includes((task.assignedName ?? "").toLowerCase()));
  const matchingOta = activeTasks.filter((task) => (task.relatedOta ?? "").toLowerCase().includes(lower) || lower.includes((task.relatedOta ?? "").toLowerCase()));
  const blockedTasks = activeTasks.filter((task) => task.status === "pending" || task.status === "supervisor_attention" || (task.dueDate && task.dueDate < todayKey()));
  const dueTasks = activeTasks.filter((task) => (task.followUpAt && task.followUpAt.slice(0, 10) <= todayKey()) || startsWithToday(task.dueDate));

  let direct = insights.narrative;
  let what = activeTasks.slice(0, 4).map((task) => `- ${task.title} (${task.priority})${task.assignedName ? ` owned by ${task.assignedName}` : ""}.`).join("\n");
  let why = `- ${insights.bucketCounts[0]?.bucket ?? "General"} is the largest task bucket right now.\n- ${insights.overdue} tasks are overdue, ${insights.blocked} are pending, and ${insights.supervisorAttention} need supervisor attention.`;
  let how = `- Work is clustering around ${insights.assigneeLoad[0]?.assignee ?? "the available team"} and ${insights.otaHotspots[0]?.ota ?? "mixed OTA asks"}.\n- Tasks stay open when follow-up dates and completion comments are missing.`;
  let fix = insights.recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n");
  let followUps = [
    "Who is overloaded today and what should I reassign?",
    "Which OTA has the highest task concentration today?",
    "Show me the pending, escalated, and overdue tasks first.",
  ];

  if (intent === "assignee" && matchingAssignee.length > 0) {
    const owner = matchingAssignee[0].assignedName ?? "This owner";
    direct = `${owner} currently has ${matchingAssignee.length} active linked tasks.`;
    what = matchingAssignee.map((task) => `- ${task.title} (${task.priority}) from ${task.sourceLabel ?? task.sourcePage ?? "dashboard"}.`).join("\n");
    why = `- ${owner} is carrying work mainly across ${[...new Set(matchingAssignee.map((task) => task.bucket ?? "General"))].join(", ")}.\n- ${matchingAssignee.filter((task) => task.status === "pending" || task.status === "supervisor_attention").length} of these tasks are pending or escalated.`;
    how = `- The owner's queue is accumulating across ${[...new Set(matchingAssignee.map((task) => task.relatedOta).filter(Boolean))].join(", ") || "mixed asks"}.\n- Any close action still requires a comment-backed update.`;
    fix = `1. Review ${owner}'s high-priority tasks first.\n2. Reassign lower-priority asks if the load is above capacity.\n3. Ask for one detailed update comment before each closure.`;
    followUps = [
      `Which of ${owner}'s tasks are overdue?`,
      `What should ${owner} do first today?`,
      `Which tasks assigned to ${owner} are tied to one OTA?`,
    ];
  } else if (intent === "ota" && matchingOta.length > 0) {
    const ota = matchingOta[0].relatedOta ?? "This OTA";
    direct = `${ota} has ${matchingOta.length} active tasks linked to it right now.`;
    what = matchingOta.map((task) => `- ${task.title} (${task.priority})${task.assignedName ? ` with ${task.assignedName}` : ""}.`).join("\n");
    why = `- ${ota} is drawing task volume because it appears repeatedly across source sections and owner updates.\n- ${matchingOta.filter((task) => task.status === "pending" || task.status === "supervisor_attention").length} linked tasks are pending or escalated.`;
    how = `- The workload is spread across ${[...new Set(matchingOta.map((task) => task.assignedName).filter(Boolean))].join(", ") || "multiple owners"}.\n- Tasks are clustering mostly inside ${[...new Set(matchingOta.map((task) => task.bucket ?? "General"))].join(", ")}.`;
    fix = `1. Make ${ota} the first OTA review in the stand-up.\n2. Clear pending and escalated items before raising more asks on ${ota}.\n3. Force end-of-day comments on every high-priority ${ota} task.`;
    followUps = [
      `Who owns the most ${ota} tasks?`,
      `Which ${ota} tasks are pending today?`,
      `Summarise the ${ota} task themes for leadership.`,
    ];
  } else if (intent === "risk") {
    direct = `${blockedTasks.length} tasks are currently pending, escalated, or overdue.`;
    what = blockedTasks.slice(0, 6).map((task) => `- ${task.title} (${task.status})${task.assignedName ? ` with ${task.assignedName}` : ""}.`).join("\n") || "- No pending, escalated, or overdue tasks right now.";
    why = `- These tasks are missing closure momentum because due dates, blockers, or follow-up loops are not fully cleared.\n- ${insights.followUpsPending} tasks also need follow-up today.`;
    how = `- Work is aging mostly inside ${insights.bucketCounts[0]?.bucket ?? "General"} and on ${insights.otaHotspots[0]?.ota ?? "mixed OTAs"}.\n- Owners can move work to in progress without a comment, but pending, supervisor attention, and completion still require a comment trail.`;
    fix = `1. Review pending and supervisor-attention tasks first.\n2. Ask each owner for a clear comment and next step.\n3. Reassign or escalate anything still aging after the follow-up date.`;
    followUps = [
      "Which escalated tasks belong to the highest-priority bucket?",
      "Who needs follow-up first today?",
      "Show me the overdue tasks by owner.",
    ];
  } else if (intent === "followup") {
    direct = `${dueTasks.length} tasks need a follow-up touch today.`;
    what = dueTasks.slice(0, 6).map((task) => `- ${task.title}${task.assignedName ? ` with ${task.assignedName}` : ""}${task.followUpAt ? ` follow-up ${task.followUpAt.slice(0, 10)}` : ""}.`).join("\n") || "- No follow-up tasks are due today.";
    why = `- Follow-up items are time-sensitive because they usually sit inside active execution loops.\n- Missed follow-up creates stale task boards and weak accountability.`;
    how = `- These tasks are being surfaced from due dates and follow-up dates, not only from creation date.\n- That keeps yesterday's unfinished work visible inside Today's Assigned Tasks.`;
    fix = `1. Message each owner for a progress comment.\n2. Move truly stalled work to pending or supervisor attention.\n3. Re-baseline due dates only after a real status note is posted.`;
    followUps = [
      "Who should I chase first for follow-up updates?",
      "Which follow-up tasks are high priority?",
      "Summarise today's follow-up workload by OTA.",
    ];
  } else if (intent === "summary") {
    direct = insights.narrative;
  }

  return {
    answer: [
      `Question: ${question}`,
      "",
      "## Direct Answer",
      direct,
      "",
      "## What Went Wrong",
      what,
      "",
      "## Why It Went Wrong",
      why,
      "",
      "## How It Went Wrong",
      how,
      "",
      "## How To Fix",
      fix,
    ].join("\n"),
    followUps,
  };
}

export async function generateDashboardTaskCopilotAnswer(
  question: string,
  tasks: DashboardTaskRecord[],
  history: TaskCopilotMessage[] = []
) {
  const deterministic = buildDeterministicTaskCopilot(question, tasks);

  if (!process.env.ANTHROPIC_API_KEY) {
    return { answer: deterministic.answer, mode: "deterministic" as const, followUps: deterministic.followUps };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1400,
      system: [
        "You are a task command-center analyst for OTA operations.",
        "Ground every answer in the task snapshot.",
        "Always include the sections What Went Wrong, Why It Went Wrong, How It Went Wrong, How To Fix.",
        "Be specific about owners, priorities, overdue work, follow-up dates, OTA hotspots, and workload balance.",
      ].join(" "),
      messages: [
        ...history.slice(-6).map((message) => ({ role: message.role, content: message.content })),
        {
          role: "user",
          content: `Question: ${question}\n\nTask snapshot:\n${JSON.stringify(tasks, null, 2)}`,
        },
      ],
    });

    const answer = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return {
      answer: answer || deterministic.answer,
      mode: answer ? ("anthropic" as const) : ("deterministic" as const),
      followUps: deterministic.followUps,
    };
  } catch {
    return { answer: deterministic.answer, mode: "deterministic" as const, followUps: deterministic.followUps };
  }
}
