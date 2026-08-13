import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLandingSnapshot } from "@/lib/landing-data";
import { LandingPage } from "@/components/LandingPage";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  const snap = await getLandingSnapshot();
  return <LandingPage snap={snap} />;
}
