import { ProgressClient } from "@/components/ProgressClient";
import { requireAppSession } from "@/lib/require-app-session";

export default async function ProgressPage() {
  await requireAppSession();
  return <ProgressClient />;
}
