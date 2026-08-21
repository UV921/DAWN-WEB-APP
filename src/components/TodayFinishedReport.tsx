"use client";

import Link from "next/link";
import { IconCheck } from "@/components/icons";
import { ShareCardButton } from "@/components/ShareCardButton";
import { normalizeListTitle } from "@/lib/todo-lists";
import {
  groupTasksByList,
  splitTodayTasks,
  type ReportTodo,
} from "@/lib/today-task-report";

type Loop = {
  label: string;
  value: string;
  done: boolean;
};

type Props = {
  todos: ReportTodo[];
  loops: Loop[];
  onShare: () => Promise<"shared" | "downloaded">;
};

function TaskRow({ text, done, list }: { text: string; done: boolean; list?: string }) {
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
          done
            ? "border-[var(--color-leaf)]/50 bg-[var(--color-leaf)]/15 text-[var(--color-leaf)]"
            : "border-white/20 text-transparent"
        }`}
        aria-hidden
      >
        {done ? <IconCheck size={12} strokeWidth={2.6} /> : null}
      </span>
      <span
        className={`min-w-0 flex-1 text-sm leading-snug ${
          done ? "text-[var(--color-cloud)]" : "text-white"
        }`}
      >
        {text}
      </span>
      {list && list !== "Today" ? (
        <span className="shrink-0 rounded-full border border-white/12 px-2 py-0.5 text-[10px] text-[var(--color-mist)]">
          {list}
        </span>
      ) : null}
    </li>
  );
}

/** Tasks closed today, with a shareable PNG report from Progress / Stats. */
export function TodayFinishedReport({ todos, loops, onShare }: Props) {
  const split = splitTodayTasks(todos);
  const doneGroups = groupTasksByList(split.done);
  const showListNames = doneGroups.length > 1 || split.open.some((t) => {
    const title = normalizeListTitle(t.title);
    return title !== "Today";
  });

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white">Finished today</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            {split.total
              ? `${split.doneCount} of ${split.total} tasks closed · ${split.pct}%. Share a PNG of the full day.`
              : "No tasks on today’s list yet. Add them on Tasks — they’ll show up here when you close them."}
          </p>
        </div>
        <ShareCardButton label="Share today" make={onShare} />
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {loops.map((row) => (
          <li
            key={row.label}
            className={`min-w-0 rounded-xl border px-2 py-2 text-center ${
              row.done
                ? "border-[var(--color-dawn)]/35 bg-[var(--color-dawn)]/10"
                : "border-white/8 bg-black/20"
            }`}
          >
            <p
              className={`text-[9px] uppercase tracking-[0.1em] ${
                row.done ? "text-[var(--color-dawn)]" : "text-[var(--color-mist)]"
              }`}
            >
              {row.label}
            </p>
            <p
              className={`mt-1 truncate font-display text-[15px] tabular-nums leading-none ${
                row.done ? "text-white" : "text-[var(--color-cloud)]"
              }`}
            >
              {row.value}
            </p>
          </li>
        ))}
      </ul>

      {split.total ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {split.doneCount ? (
            <div>
              <div className="flex items-baseline justify-between gap-2 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-leaf)]">
                  Closed
                </p>
                <p className="text-xs tabular-nums text-[var(--color-mist)]">
                  {split.doneCount}
                </p>
              </div>
              <ul className="divide-y divide-white/8 border-t border-white/8">
                {split.done.map((t, i) => (
                  <TaskRow
                    key={t.id || `${t.text}-${t.title || ""}-${i}`}
                    text={t.text}
                    done
                    list={showListNames ? normalizeListTitle(t.title) : undefined}
                  />
                ))}
              </ul>
            </div>
          ) : (
            <p className="px-4 py-4 text-sm text-[var(--color-mist)]">
              Nothing checked off yet. Close one task and this report fills in.
            </p>
          )}

          {split.open.length ? (
            <div className="border-t border-white/10">
              <div className="flex items-baseline justify-between gap-2 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-ember)]">
                  Still open
                </p>
                <p className="text-xs tabular-nums text-[var(--color-mist)]">
                  {split.open.length}
                </p>
              </div>
              <ul className="divide-y divide-white/8 border-t border-white/8">
                {split.open.map((t, i) => (
                  <TaskRow
                    key={t.id || `${t.text}-${t.title || ""}-open-${i}`}
                    text={t.text}
                    done={false}
                    list={showListNames ? normalizeListTitle(t.title) : undefined}
                  />
                ))}
              </ul>
            </div>
          ) : split.doneCount ? (
            <p className="border-t border-white/10 px-4 py-3 text-sm text-[var(--color-leaf)]">
              Today’s list is clear.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-mist)]">
          <Link href="/tasks" className="ui-btn-text">
            Open Tasks
          </Link>{" "}
          to write today’s list.
        </p>
      )}
    </section>
  );
}
