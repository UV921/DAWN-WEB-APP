import { TodoDetailClient } from "@/components/TodoDetailClient";
import { requireAppSession } from "@/lib/require-app-session";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppSession();
  const { id } = await params;
  return <TodoDetailClient id={id} />;
}
