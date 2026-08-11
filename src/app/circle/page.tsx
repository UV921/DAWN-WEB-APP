import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { CircleClient } from "@/components/CircleClient";

export default async function CirclePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <CircleClient />;
}
