import { IconCheck } from "@/components/icons";
import { tallyClosedCount, tallyRows, type DayTally } from "@/lib/day-tally";
import { cn } from "@/lib/utils";

type Props = {
  tally: DayTally;
  compact?: boolean;
  className?: string;
};

/** Scoreboard for the day: wake, habits, tasks, study, sleep. */
export function DayTallyCard({ tally, compact, className }: Props) {
  const rows = tallyRows(tally);
  const closed = tallyClosedCount(tally);

  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3",
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-dawn)]">
          Today’s tally
        </p>
        <p className="text-xs tabular-nums text-[var(--color-mist)]">
          {closed.done}/{closed.total} closed
          {tally.streak > 0 ? ` · ${tally.streak}d streak` : ""}
        </p>
      </div>
      <ul
        className={
          compact
            ? "mt-3 grid grid-cols-5 gap-1.5"
            : "mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5"
        }
      >
        {rows.map((row) => (
          <li
            key={row.key}
            className={`min-w-0 rounded-xl border px-1.5 py-2 sm:px-2 ${
              compact ? "text-center sm:text-left" : ""
            } ${
              row.done
                ? "border-[var(--color-dawn)]/35 bg-[var(--color-dawn)]/10"
                : "border-white/8 bg-black/20"
            }`}
          >
            <p
              className={`flex items-center justify-center gap-0.5 text-[9px] uppercase tracking-[0.08em] sm:justify-start sm:text-[10px] sm:tracking-[0.12em] ${
                row.done
                  ? "text-[var(--color-dawn)]"
                  : "text-[var(--color-mist)]"
              }`}
            >
              {row.done ? <IconCheck size={11} className="hidden sm:block" /> : null}
              {row.label}
            </p>
            <p
              className={`mt-1 truncate font-display tabular-nums leading-none ${
                compact ? "text-[15px] sm:text-base" : "text-lg sm:text-xl"
              } ${row.done ? "text-white" : "text-[var(--color-cloud)]"}`}
            >
              {row.value}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
