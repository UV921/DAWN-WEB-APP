/**
 * Date-wise auto-send of that day's task list to Discord.
 * Mode + time + ping text live on User.botMessagesJson.
 */

import type { PrismaClient } from "@prisma/client";
import { zonedClock } from "../src/lib/clock";
import {
  isDateWiseTodosSend,
  parseBotMessages,
  serializeBotMessages,
} from "../src/lib/bot-messages";
import {
  pingTextForUser,
  postTodosToDiscord,
  userTodoChannelIds,
} from "../src/lib/todo-discord";

export async function postScheduledTodoSends(prisma: PrismaClient) {
  const users = await prisma.user.findMany({
    where: { NOT: { botMessagesJson: "{}" } },
    select: {
      id: true,
      name: true,
      timezone: true,
      discordId: true,
      discordChannelId: true,
      botMessagesJson: true,
      wakeGoal: true,
      sleepGoal: true,
    },
  });

  let sent = 0;
  for (const u of users) {
    const settings = parseBotMessages(u.botMessagesJson);
    if (!isDateWiseTodosSend(settings)) continue;

    const clock = zonedClock(u.timezone);
    if (clock.hhmm !== settings.todosSendTime) continue;
    const key = `${clock.date}-${clock.hhmm}`;
    if (settings.lastTodosSendKey === key) continue;

    const todos = await prisma.todo.findMany({
      where: { userId: u.id, date: clock.date },
      orderBy: { createdAt: "asc" },
    });
    if (!todos.length) {
      settings.lastTodosSendKey = key;
      await prisma.user.update({
        where: { id: u.id },
        data: { botMessagesJson: serializeBotMessages(settings) },
      });
      continue;
    }

    const { channelIds } = await userTodoChannelIds(
      prisma,
      u.id,
      settings,
      u.discordChannelId
    );
    if (!channelIds.length) continue;

    const result = await postTodosToDiscord({
      channelIds,
      name: u.name || "Dawn",
      date: clock.date,
      todos,
      pingText: pingTextForUser(settings, {
        name: u.name || "there",
        wake: u.wakeGoal,
        sleep: u.sleepGoal,
      }),
      mentionUserId: u.discordId,
    });

    settings.lastTodosSendKey = key;
    await prisma.user.update({
      where: { id: u.id },
      data: { botMessagesJson: serializeBotMessages(settings) },
    });
    if (result.ok) sent += 1;
    else console.error("Scheduled todo send failed", u.id, result.error);
  }

  return { sent };
}
