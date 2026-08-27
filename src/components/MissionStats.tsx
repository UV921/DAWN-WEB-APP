"use client";

import Link from "next/link";
import {
  missionCompactStat,
  type MissionPublic,
} from "@/lib/missions";
import { formatLocalDate } from "@/lib/habits";
import type { ReportRange } from "@/lib/progress-brief";

type Props = {
  missions: MissionPublic[];
  history?: MissionPublic[];
  range: ReportRange;
  today?: string;
};

export function MissionStats({
  missions,
  history = [],
  today,
}: Props) {
  const live = missions.filter((m) => m.active);
  const past = history.filter((m) => !m.active).slice(0, 6);
  const day = today || formatLocalDate(new Date());

  if (!live.length && !past.length) {
    return (
      <div>
        <h2 className="font-display text-2xl text-white">Missions</h2>
        <p className="mt-1 text-sm text-[var(--color-mist)]">
          No missions on this report yet.{" "}
          <Link href="/settings?tab=mission" className="ui-btn-text">
            Start one
          </Link>{" "}
          and they show up here as finished or not.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-white">Missions</h2>
      <p className="mt-1 text-sm text-[var(--color-mist)]">
        Name, finished or not, and a little of how they went.
      </p>
      {live.length ? (
        <ul className="mt-3 space-y-2">
          {live.map((m) => (
            <MissionStatRow key={m.id} mission={m} today={day} />
          ))}
        </ul>
      ) : null}
      {past.length ? (
        <div className={live.length ? "mt-4" : "mt-3"}>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
            Ended
          </p>
          <ul className="mt-2 space-y-2">
            {past.map((m) => (
              <MissionStatRow key={m.id} mission={m} today={day} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MissionStatRow({
  mission,
  today,
}: {
  mission: MissionPublic;
  today: string;
}) {
  const stat = missionCompactStat(mission, today);
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{mission.title}</p>
        {stat.detail ? (
          <p className="mt-0.5 text-xs text-[var(--color-mist)]">{stat.detail}</p>
        ) : null}
      </div>
      <span
        className={`shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] ${
          stat.finished
            ? "text-[var(--color-leaf)]"
            : "text-[var(--color-ember)]"
        }`}
      >
        {stat.status}
      </span>
    </li>
  );
}
