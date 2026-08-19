import { TasksClient } from "@/components/TasksClient";
import { requireAppSession } from "@/lib/require-app-session";

export default async function TasksPage() {
  await requireAppSession();
  return <TasksClient />;
}
