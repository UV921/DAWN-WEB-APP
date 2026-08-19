import { DayReportClient } from "@/components/DayReportClient";
import { requireAppSession } from "@/lib/require-app-session";

export default async function DayReportPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  await requireAppSession();
  const { date } = await params;
  return <DayReportClient date={date} />;
}
