import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

const BOARD = [
  { name: "Ayesha", wake: "05:48", habits: "5/6", streak: 12, status: "on time" },
  { name: "Omar", wake: "05:52", habits: "4/6", streak: 9, status: "on time" },
  { name: "You", wake: "06:04", habits: "3/6", streak: 7, status: "late", me: true },
  { name: "Priya", wake: "—", habits: "0/6", streak: 0, status: "not up" },
  { name: "Sam", wake: "06:11", habits: "2/6", streak: 4, status: "late" },
];

const COMMANDS = [
  { cmd: "/woke", detail: "Log wake time · optional time:06:05" },
  { cmd: "/checkin", detail: "Mark today’s habits done" },
  { cmd: "/today", detail: "Your morning card — wake, habits, streak" },
  { cmd: "/streak", detail: "Early wake + perfect-day streaks" },
  { cmd: "/track", detail: "Turn this channel into a morning board" },
  { cmd: "/join", detail: "Join the board so /ping reaches you" },
  { cmd: "/ping", detail: "DM everyone: are you awake?" },
  { cmd: "/leaderboard", detail: "Who woke · habit ranks for the room" },
  { cmd: "/week", detail: "Your last 7 days as bars" },
  { cmd: "/grid", detail: "Contribution grid like a habit heatmap" },
  { cmd: "/habit add", detail: "Add a custom habit by name" },
  { cmd: "/todo add", detail: "Add a task for today" },
  { cmd: "/plan", detail: "Set tomorrow before sleep" },
  { cmd: "/setup", detail: "Wake goal, sleep goal, why, focus habit" },
];

const HABITS_TODAY = [
  { label: "Wake early", meta: "Done · 05:52", done: true },
  { label: "No phone", meta: "Open · until 08:00", done: false },
  { label: "Gym", meta: "Opens in 1h 12m", done: false, locked: true },
  { label: "Reading", meta: "Opens 18:00–22:00", done: false, locked: true },
  { label: "Sleep early", meta: "Opens 21:00–23:30", done: false, locked: true },
];

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="bg-[#0a0e12] text-[#e8e4dc]">
      {/* Hero — keep photo */}
      <section className="relative min-h-[100dvh] overflow-hidden">
        <Image
          src="/images/landing-dawn.jpg"
          alt="Quiet field at first light"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_60%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#0a0e12] via-[#0a0e12]/55 to-[#0a0e12]/25"
        />

        <div className="relative z-10 flex min-h-[100dvh] flex-col">
          <header className="flex items-center justify-between px-5 pt-6 sm:px-10 sm:pt-8">
            <p className="font-display text-[1.35rem] tracking-tight text-[#f0b45a]">
              Dawn
            </p>
            <Link
              href="/login"
              className="text-[13px] text-[#e8e4dc]/85 transition hover:text-white"
            >
              Sign in
            </Link>
          </header>

          <div className="mt-auto px-5 pb-14 sm:px-10 sm:pb-16 md:pb-20">
            <h1 className="font-display max-w-[11ch] text-[clamp(3.25rem,11vw,6.5rem)] leading-[0.95] tracking-[-0.03em] text-white">
              Dawn
            </h1>
            <p className="mt-4 max-w-[32ch] text-[1.05rem] leading-snug text-[#e8e4dc]/90 sm:text-lg">
              Wake early, check in once, keep habits honest — on the web or with
              Discord slash commands.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center bg-[#f0b45a] px-6 text-[13px] font-semibold tracking-wide text-[#0a0e12] transition hover:bg-[#f5c56e]"
              >
                Open Dawn
              </Link>
              <Link
                href="/login"
                className="text-[13px] text-[#e8e4dc]/70 underline decoration-[#e8e4dc]/25 underline-offset-[5px] transition hover:text-white hover:decoration-white/50"
              >
                Demo login
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Intro + second image */}
      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="font-display text-[1.85rem] leading-tight text-white sm:text-[2.25rem]">
              Built for the first hour after you wake.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-[#9aa6b2]">
              Dawn is a morning check-in app. You set a wake window (for example
              05:30–07:00). Logging wake only counts inside that window. Habits
              like gym, reading, and no-phone open later in the day — so you
              can’t pad a streak at midnight.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-[#9aa6b2]">
              Use the website alone, or connect Discord so your study friends see
              who’s up.
            </p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden bg-[#121820]">
            <Image
              src="/images/landing-phone.jpg"
              alt="Phone in early morning light"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Realistic Today mock */}
      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[1.85rem] text-white sm:text-[2.15rem]">
                Today screen
              </h2>
              <p className="mt-2 max-w-md text-[15px] text-[#9aa6b2]">
                Example for Tuesday · wake goal 06:00 · 7-day challenge running.
              </p>
            </div>
            <p className="font-mono text-[12px] text-[#6b7785]">
              sample data · not your account
            </p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-start">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Early streak" value="7" unit="days" />
                <StatBox label="Habits today" value="1/5" unit="done" />
                <StatBox label="Opened Dawn" value="11" unit="days" />
              </div>
              <div className="border border-white/[0.1] bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8ba3b8]">
                  Challenge
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="font-display text-2xl text-white">
                    Day 4<span className="text-[#8ba3b8]">/7</span>
                  </p>
                  <p className="font-display text-2xl text-[#f0b45a]">57%</p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[57%] bg-[#f0b45a]" />
                </div>
                <p className="mt-2 text-[13px] text-[#8ba3b8]">3 days left</p>
              </div>
              <p className="text-[14px] leading-relaxed text-[#9aa6b2]">
                Start a 7, 14, 21, or 30-day challenge from this same panel. Dawn
                shows which day you’re on every morning.
              </p>
            </div>

            <div className="border border-white/[0.1] bg-[#0d131a]">
              <div className="border-b border-white/[0.08] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#f0b45a]">
                  Wake check-in
                </p>
                <p className="mt-1 text-[13px] text-[#8ba3b8]">
                  Up at 05:52 · window 05:30–07:00
                </p>
              </div>
              <ul className="divide-y divide-white/[0.06]">
                {HABITS_TODAY.map((h) => (
                  <li
                    key={h.label}
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      h.locked ? "opacity-50" : ""
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                        h.done
                          ? "border-[#f0b45a] bg-[#f0b45a] text-[#0a0e12]"
                          : "border-white/25 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] text-white">
                        {h.label}
                      </span>
                      <span className="block text-[12px] text-[#8ba3b8]">
                        {h.meta}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Friend board */}
      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-[1.85rem] text-white sm:text-[2.15rem]">
            Morning board
          </h2>
          <p className="mt-2 max-w-xl text-[15px] text-[#9aa6b2]">
            Example circle “Study Crew” · Aug 11 · 4 of 5 up · 2 on time. Invite
            friends with a code on the Friends page.
          </p>

          <div className="mt-8 overflow-x-auto border border-white/[0.1]">
            <table className="w-full min-w-[32rem] text-left text-[13px]">
              <thead className="border-b border-white/[0.08] bg-white/[0.02] text-[#8ba3b8]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Wake</th>
                  <th className="px-4 py-3 font-medium">Habits</th>
                  <th className="px-4 py-3 font-medium">Early streak</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {BOARD.map((row) => (
                  <tr
                    key={row.name}
                    className={row.me ? "bg-[#f0b45a]/[0.06]" : undefined}
                  >
                    <td className="px-4 py-3 text-white">
                      {row.name}
                      {row.me ? (
                        <span className="ml-2 text-[11px] text-[#f0b45a]">
                          you
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#c5ced6]">
                      {row.wake}
                    </td>
                    <td className="px-4 py-3 text-[#c5ced6]">{row.habits}</td>
                    <td className="px-4 py-3 text-[#6fbf8a]">{row.streak}</td>
                    <td className="px-4 py-3 text-[#8ba3b8]">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Discord commands */}
      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div>
              <h2 className="font-display text-[1.85rem] text-white sm:text-[2.15rem]">
                Discord commands
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#9aa6b2]">
                Optional. Invite the Dawn bot to your study server, run{" "}
                <code className="text-[#f0b45a]">/track</code> in a channel,
                everyone <code className="text-[#f0b45a]">/join</code>, then
                check in with <code className="text-[#f0b45a]">/woke</code>.
              </p>
              <div className="mt-8 border border-white/[0.1] bg-[#0d131a] p-4 font-mono text-[12px] leading-relaxed text-[#c5ced6]">
                <p className="text-[#5865F2]">#morning-board</p>
                <p className="mt-3 text-[#8ba3b8]">you — Today at 5:52 AM</p>
                <p className="mt-1">
                  <span className="text-[#f0b45a]">/woke</span>
                </p>
                <p className="mt-3 text-[#8ba3b8]">dawn BOT — Today at 5:52 AM</p>
                <p className="mt-1 text-white">
                  Logged wake <span className="text-[#6fbf8a]">05:52</span> ·
                  early streak <span className="text-[#6fbf8a]">7</span>
                </p>
                <p className="mt-1 text-[#8ba3b8]">
                  Next: /checkin · /today · /morning
                </p>
              </div>
            </div>

            <div className="border border-white/[0.1]">
              <div className="border-b border-white/[0.08] px-4 py-3 text-[12px] text-[#8ba3b8]">
                Slash commands the bot registers
              </div>
              <ul className="max-h-[28rem] divide-y divide-white/[0.06] overflow-y-auto">
                {COMMANDS.map((c) => (
                  <li
                    key={c.cmd}
                    className="grid gap-1 px-4 py-3 sm:grid-cols-[9.5rem_1fr] sm:gap-4"
                  >
                    <code className="text-[13px] text-[#f0b45a]">{c.cmd}</code>
                    <span className="text-[13px] text-[#9aa6b2]">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Day loop detail */}
      <section className="border-t border-white/[0.08] px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-[1.85rem] text-white sm:text-[2.15rem]">
            Full day loop
          </h2>
          <div className="mt-10 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            <LoopRow
              when="05:30–07:00"
              title="Wake window"
              body="Hold “I’m awake” on the web, or type /woke in Discord. Outside the window it won’t count."
            />
            <LoopRow
              when="After wake"
              title="Reminders & tasks"
              body="Optional: add one reminder (e.g. 09:00 gym bag) and a few tiny tasks, or skip."
            />
            <LoopRow
              when="Daytime"
              title="Habits open on a clock"
              body="Gym, reading, no-phone, sleep — each has a window. Locked rows show when they open."
            />
            <LoopRow
              when="Evening"
              title="Plan tomorrow, then sleep"
              body="Write tomorrow’s wake time + one sentence. Log bedtime. That plan shows on the next morning screen."
            />
            <LoopRow
              when="08:00"
              title="Board / leaderboard"
              body="If you /track a channel, Dawn can auto-post who’s up. Or run /leaderboard anytime."
            />
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="border-t border-white/[0.08] px-5 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-[2.25rem] text-white sm:text-[3rem]">
            Open it before your alarm wins.
          </h2>
          <p className="mt-3 max-w-md text-[15px] text-[#9aa6b2]">
            Demo login works in seconds. Discord login unlocks the friend board
            and slash commands.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center bg-[#f0b45a] px-6 text-[13px] font-semibold tracking-wide text-[#0a0e12] transition hover:bg-[#f5c56e]"
            >
              Open Dawn
            </Link>
            <span className="font-mono text-[12px] text-[#6b7785]">
              /woke · /today · /leaderboard
            </span>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.08] px-5 py-6 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-[13px] text-[#6b7785]">
          <span className="font-display text-[#f0b45a]">Dawn</span>
          <span>Web check-in + Discord morning board</span>
        </div>
      </footer>
    </main>
  );
}

function StatBox({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="border border-white/[0.1] bg-white/[0.03] px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ba3b8]">
        {label}
      </p>
      <p className="font-display mt-1.5 text-2xl text-[#f0b45a]">{value}</p>
      <p className="text-[11px] text-[#6b7785]">{unit}</p>
    </div>
  );
}

function LoopRow({
  when,
  title,
  body,
}: {
  when: string;
  title: string;
  body: string;
}) {
  return (
    <div className="grid gap-2 py-7 sm:grid-cols-[9.5rem_1fr] sm:gap-10">
      <p className="font-mono text-[12px] text-[#f0b45a]">{when}</p>
      <div>
        <p className="text-[15px] text-white">{title}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-[#9aa6b2]">{body}</p>
      </div>
    </div>
  );
}
