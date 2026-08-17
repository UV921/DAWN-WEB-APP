import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AuthScreen } from "@/components/AuthScreen";

export const metadata = { title: "Create account — Dawn" };

export default async function SignupPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) redirect("/dashboard");
  return <AuthScreen mode="signup" />;
}
