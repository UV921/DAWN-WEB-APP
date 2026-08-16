export type TodoPriority = "high" | "medium" | "low";

const PRIORITIES = new Set<TodoPriority>(["high", "medium", "low"]);

export function normalizePriority(raw: unknown): TodoPriority {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (PRIORITIES.has(v as TodoPriority)) return v as TodoPriority;
  return "medium";
}

/** Accept HH:MM or empty → null. */
export function parseRemindAt(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  return null;
}

export function priorityRank(priority: string | null | undefined): number {
  const p = normalizePriority(priority);
  if (p === "high") return 0;
  if (p === "low") return 2;
  return 1;
}
