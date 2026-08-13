/** Progress XP — earned only inside habit time windows (honest logging). */

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 80 + (level - 2) * 40;
}

export function totalXpToReach(level: number): number {
  let sum = 0;
  for (let l = 2; l <= level; l++) sum += xpForLevel(l);
  return sum;
}

export function levelFromXp(xp: number): {
  level: number;
  intoLevel: number;
  need: number;
  progress: number;
} {
  let level = 1;
  let remaining = Math.max(0, xp);
  while (true) {
    const need = xpForLevel(level + 1);
    if (remaining < need) {
      return {
        level,
        intoLevel: remaining,
        need,
        progress: need === 0 ? 1 : remaining / need,
      };
    }
    remaining -= need;
    level += 1;
    if (level > 99) {
      return { level: 99, intoLevel: remaining, need: 999, progress: 1 };
    }
  }
}

export function awardCheckInXp(opts: {
  wakeLogged: boolean;
  wakeOnTime: boolean;
  wakeStreak: number;
  habitsNewlyDone: number;
  focusDone: boolean;
  allDone: boolean;
  nightClosed?: boolean;
  loopComplete?: boolean;
}): { xp: number; labels: string[] } {
  let xp = 0;
  const labels: string[] = [];

  if (opts.wakeLogged) {
    xp += 12;
    labels.push("+12 wake logged in window");
  }
  if (opts.wakeOnTime) {
    const streakBonus = Math.min(opts.wakeStreak, 10) * 5;
    xp += 25 + streakBonus;
    labels.push(`+25 on-time wake`);
    if (streakBonus > 0) labels.push(`+${streakBonus} streak`);
  }
  if (opts.habitsNewlyDone > 0) {
    const h = opts.habitsNewlyDone * 10;
    xp += h;
    labels.push(`+${h} habit${opts.habitsNewlyDone > 1 ? "s" : ""} in window`);
  }
  if (opts.focusDone) {
    xp += 20;
    labels.push("+20 focus habit");
  }
  if (opts.allDone) {
    xp += 30;
    labels.push("+30 full morning");
  }
  if (opts.nightClosed) {
    xp += 22;
    labels.push("+22 night closed");
  }
  if (opts.loopComplete) {
    xp += 40;
    labels.push("+40 daily loop");
  }
  return { xp, labels };
}

/** @deprecated use awardCheckInXp */
export function awardWakeXp(opts: {
  wakeEarly: boolean;
  wakeStreak: number;
  focusDone: boolean;
  perfect: boolean;
  firstWakeToday: boolean;
}): { xp: number; labels: string[] } {
  return awardCheckInXp({
    wakeLogged: opts.firstWakeToday,
    wakeOnTime: opts.wakeEarly,
    wakeStreak: opts.wakeStreak,
    habitsNewlyDone: 0,
    focusDone: opts.focusDone,
    allDone: opts.perfect,
  });
}
