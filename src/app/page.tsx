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
          <p className="animate-rise text-sm uppercase tracking-[0.22em] text-[var(--color-dawn)]">
            Morning accountability
          </p>
          <h1 className="font-display animate-rise relative mt-3 max-w-3xl text-5xl leading-[1.05] tracking-tight text-white md:text-7xl">
            Dawn
          </h1>
          <p className="animate-rise-delay mt-5 max-w-xl text-lg text-[var(--color-mist)] md:text-xl">
            Wake early. Check in once. See what to do next — habits, reminders,
            and friends on Discord.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="rounded-full bg-[var(--color-dawn)] px-7 py-3.5 text-sm font-semibold text-[var(--color-night)] transition hover:bg-[#f7c46e]"
            >
              Get started
            </Link>
            <p className="text-sm text-[var(--color-mist)]">
              Demo in 10 seconds · Discord optional
            </p>
          </div>
          <ul className="mt-14 grid max-w-2xl gap-4 text-sm text-[var(--color-cloud)] sm:grid-cols-3">
            <li>
              <p className="font-medium text-white">1. Wake</p>
              <p className="mt-1 text-[var(--color-mist)]">
                Hold to log you’re up in your morning window.
              </p>
            </li>
            <li>
              <p className="font-medium text-white">2. Plan</p>
              <p className="mt-1 text-[var(--color-mist)]">
                Add a reminder or a couple of tiny tasks.
              </p>
            </li>
            <li>
              <p className="font-medium text-white">3. Check in</p>
              <p className="mt-1 text-[var(--color-mist)]">
                Mark habits when their time opens — streaks stay honest.
              </p>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
