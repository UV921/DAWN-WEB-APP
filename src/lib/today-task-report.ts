import { normalizeListTitle } from "@/lib/todo-lists";
import { priorityRank } from "@/lib/todo-weight";

export type ReportTodo = {
  id?: string;
  text: string;
  done: boolean;
  priority?: string | null;
  parentId?: string | null;
  title?: string | null;
};

export type SplitTodayTasks = {
  roots: ReportTodo[];
  done: ReportTodo[];
  open: ReportTodo[];
  doneCount: number;
  total: number;
  pct: number;
};

export type TaskListGroup = {
  title: string;
  items: ReportTodo[];
};

/** Top-level tasks only — subtasks ride with their parent. */
export function splitTodayTasks(todos: ReportTodo[]): SplitTodayTasks {
  const roots = todos.filter((t) => !t.parentId);
  const done = roots.filter((t) => t.done);
  const open = [...roots.filter((t) => !t.done)].sort(
    (a, b) => priorityRank(a.priority) - priorityRank(b.priority)
  );
  const total = roots.length;
  return {
    roots,
    done,
    open,
    doneCount: done.length,
    total,
    pct: total ? Math.round((done.length / total) * 100) : 0,
  };
}

export function groupTasksByList(items: ReportTodo[]): TaskListGroup[] {
  const map = new Map<string, ReportTodo[]>();
  for (const t of items) {
    const title = normalizeListTitle(t.title);
    const arr = map.get(title) || [];
    arr.push(t);
    map.set(title, arr);
  }
  return [...map.entries()].map(([title, grouped]) => ({
    title,
    items: grouped,
  }));
}

export function closedTaskNames(done: ReportTodo[]): string[] {
  return done.map((t) => t.text.trim()).filter(Boolean);
}

/** One line for the written report: names of tasks closed today. */
export function closedTaskLine(done: ReportTodo[], limit = 4): string | null {
  const names = closedTaskNames(done);
  if (!names.length) return null;
  const shown = names.slice(0, limit);
  const extra = names.length - shown.length;
  if (extra > 0) return `${shown.join(", ")} (+${extra} more)`;
  return shown.join(", ");
}
