import TodaysAssignedTasksView from "@/components/tasks/TodaysAssignedTasksView";

export default async function TodaysAssignedTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ sourceAnchor?: string }>;
}) {
  const params = await searchParams;
  return <TodaysAssignedTasksView initialSourceAnchor={params.sourceAnchor ?? null} />;
}
