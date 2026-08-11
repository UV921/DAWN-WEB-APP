import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SettingsClient } from "@/components/SettingsClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return (
    <Suspense
      fallback={
        <main className="dawn-bg flex min-h-screen items-center justify-center text-[var(--color-mist)]">
          Loading…
        </main>
      }
    >
      <SettingsClient />
    </Suspense>
  );
}
