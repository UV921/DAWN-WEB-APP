import type { PrismaClient, Reminder, Todo } from "@prisma/client";
import { parseRemindAt } from "./todo-weight";

type TodoLike = Pick<
  Todo,
  "id" | "text" | "date" | "done" | "remindAt" | "reminderId"
>;

function discordPrefs(user: {
  discordNotifyDefault: string;
} | null) {
  const mode = user?.discordNotifyDefault || "channel";
  const off = mode === "off";
  return {
    notifyBrowser: true,
    notifyDiscord: !off,
    discordTarget: off ? "channel" : mode,
  };
}

/** Create/update/disable the 1:1 Reminder for a todo. Keeps reminderId in sync. */
export async function syncTodoReminder(
  prisma: PrismaClient,
  opts: {
    userId: string;
    todo: TodoLike;
    remindAt?: string | null;
    done?: boolean;
  }
): Promise<Reminder | null> {
  const remindAt =
    opts.remindAt !== undefined
      ? parseRemindAt(opts.remindAt)
      : parseRemindAt(opts.todo.remindAt);
  const done = opts.done !== undefined ? opts.done : opts.todo.done;

  const existing = opts.todo.reminderId
    ? await prisma.reminder.findFirst({
        where: { id: opts.todo.reminderId, userId: opts.userId },
      })
    : await prisma.reminder.findFirst({
        where: { todoId: opts.todo.id, userId: opts.userId },
      });

  if (!remindAt) {
    if (existing) {
      await prisma.reminder.delete({ where: { id: existing.id } });
    }
    if (opts.todo.reminderId || existing || opts.todo.remindAt) {
      await prisma.todo.update({
        where: { id: opts.todo.id },
        data: { reminderId: null, remindAt: null },
      });
    }
    return null;
  }

  if (done) {
    if (existing) {
      const reminder = await prisma.reminder.update({
        where: { id: existing.id },
        data: {
          enabled: false,
          time: remindAt,
          title: opts.todo.text.slice(0, 80) || "Task reminder",
        },
      });
      if (opts.todo.reminderId !== reminder.id) {
        await prisma.todo.update({
          where: { id: opts.todo.id },
          data: { reminderId: reminder.id, remindAt },
        });
      }
      return reminder;
    }
    await prisma.todo.update({
      where: { id: opts.todo.id },
      data: { remindAt, reminderId: null },
    });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { discordNotifyDefault: true },
  });
  const prefs = discordPrefs(user);
  const data = {
    title: opts.todo.text.slice(0, 80) || "Task reminder",
    message: `Task · ${opts.todo.date}: ${opts.todo.text}`.slice(0, 240),
    time: remindAt,
    enabled: true,
    notifyBrowser: prefs.notifyBrowser,
    notifyDiscord: prefs.notifyDiscord,
    discordTarget: prefs.discordTarget,
    todoId: opts.todo.id,
  };

  const reminder = existing
    ? await prisma.reminder.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.reminder.create({
        data: { userId: opts.userId, ...data },
      });

  if (
    opts.todo.reminderId !== reminder.id ||
    opts.todo.remindAt !== remindAt
  ) {
    await prisma.todo.update({
      where: { id: opts.todo.id },
      data: { reminderId: reminder.id, remindAt },
    });
  }

  return reminder;
}
