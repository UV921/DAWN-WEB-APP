import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="dawn-bg noise relative min-h-screen overflow-hidden">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-6 pb-16 pt-8">
        <header className="flex items-center justify-between animate-rise">
          <p className="font-display text-2xl tracking-tight text-[var(--color-dawn)]">
            Dawn
          </p>
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-[var(--color-cloud)] transition hover:border-[var(--color-dawn)]/50 hover:text-white"
          >
            Sign in
          </Link>
        </header>

        <section className="relative mt-16 flex flex-1 flex-col justify-center md:mt-8">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-[var(--color-dawn)]/30 blur-3xl md:h-56 md:w-56"
          />
          <h1 className="font-display animate-rise relative max-w-3xl text-5xl leading-[1.05] tracking-tight text-white md:text-7xl">
            Dawn
          </h1>
          <p className="animate-rise-delay mt-5 max-w-xl text-lg text-[var(--color-mist)] md:text-xl">
            Sleep early. Put the phone down. Wake up. Gym. Read. Quran. Track
            the streak with a friend on Discord.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-[var(--color-dawn)] px-7 py-3.5 text-sm font-semibold text-[var(--color-night)] transition hover:bg-[#f7c46e]"
            >
              Continue with Discord
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
