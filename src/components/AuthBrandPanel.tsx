import { DawnMark } from "@/components/DawnMark";

const PILLS = ["Wake", "Habits", "Study hours", "Friend board"];

export function AuthBrandPanel() {
  return (
    <aside className="auth-brand relative isolate flex min-h-[38vh] flex-col justify-between overflow-hidden px-7 py-8 sm:min-h-[42vh] sm:px-10 sm:py-10 lg:min-h-screen lg:px-12 lg:py-12">
      <div aria-hidden className="auth-brand-sky" />
      <div aria-hidden className="auth-brand-sun" />
      <div aria-hidden className="auth-brand-horizon" />
      <div aria-hidden className="auth-brand-grain" />

      <div className="relative z-10">
        <p className="text-[var(--color-dawn)]">
          <DawnMark size={32} />
        </p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-dawn)]">
          Morning accountability
        </p>
      </div>

      <div className="relative z-10 mt-10 max-w-md lg:mt-0">
        <h2 className="font-display text-[clamp(2.4rem,6vw,4.25rem)] leading-[0.95] tracking-[-0.03em] text-white">
          Show up
          <br />
          before the day
          <br />
          asks you to.
        </h2>
        <p className="mt-5 max-w-[34ch] text-[0.95rem] leading-relaxed text-[#c5ced6] sm:text-base">
          Wake, habits, study hours, and a friend circle that ranks who stayed
          consistent — not who talked about it.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {PILLS.map((p) => (
            <li
              key={p}
              className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#e8e4dc] backdrop-blur-sm"
            >
              {p}
            </li>
          ))}
        </ul>

        <div className="mt-8 hidden max-w-sm grid-cols-2 gap-3 sm:grid">
          <div className="steel-plate rounded-2xl bg-black/30 px-4 py-4 backdrop-blur-md">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
              Habits · 7d
            </p>
            <p className="font-display mt-1 text-3xl text-[var(--color-dawn)]">
              86%
            </p>
            <p className="mt-1 text-xs text-[var(--color-mist)]">consistency</p>
          </div>
          <div className="steel-plate rounded-2xl bg-black/30 px-4 py-4 backdrop-blur-md">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
              Study · week
            </p>
            <p className="font-display mt-1 text-3xl text-white">12h</p>
            <p className="mt-1 text-xs text-[var(--color-mist)]">voice rooms</p>
          </div>
        </div>
      </div>

      <p className="relative z-10 mt-10 hidden text-xs text-white/45 lg:block">
        Dawn · wake · lists · study · night
      </p>
    </aside>
  );
}
