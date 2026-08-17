/**
 * Per-user control over everything the Discord bot says.
 *
 * Stored as JSON on User.botMessagesJson so adding a message type never needs
 * a migration. Both the Next.js app and the bot process read through here.
 */

export type BotMessageKey = "morningPing" | "nightReview" | "windDown";

export type BotMessage = {
  enabled: boolean;
  /** Empty means "use the built-in text". */
  text: string;
};

/** A recurring nudge the user writes themselves, posted to their channel. */
export type ChannelPing = {
  id: string;
  label: string;
  /** HH:MM local */
  time: string;
  text: string;
  enabled: boolean;
  /** Only send on days the habit is still unchecked. Empty = always send. */
  habitKey: string;
  /** Overrides the default channel for this ping only. Empty = default. */
  channelId: string;
};

export type BotMessages = {
  morningPing: BotMessage;
  nightReview: BotMessage;
  windDown: BotMessage;
  channelPings: ChannelPing[];
  /** Where the task list is posted. Empty = default channel. */
  todosChannelId: string;
  /** Custom ping text when posting the day's tasks. */
  todosPingText: string;
  /** HH:MM local — auto-post the day's tasks. Empty = manual only. */
  todosSendTime: string;
  /** Prevents double-send: YYYY-MM-DD-HH:MM */
  lastTodosSendKey: string;
};

export const BOT_MESSAGE_META: {
  key: BotMessageKey;
  label: string;
  help: string;
  defaultText: string;
}[] = [
  {
    key: "morningPing",
    label: "Morning wake ping",
    help: "DM at your channel's ping time asking if you're awake.",
    defaultText: "Hey {name} — time to check in. Wake goal {wake}.",
  },
  {
    key: "nightReview",
    label: "Night task check",
    help: "DM in the evening asking which tasks you finished.",
    defaultText: "Hey {name} — did you finish today's tasks?",
  },
  {
    key: "windDown",
    label: "Wind-down",
    help: "DM at your sleep goal to plan tomorrow.",
    defaultText:
      "Hey {name} — sleep goal is {sleep}. Plan tomorrow in 30 seconds.",
  },
];

export const MAX_CHANNEL_PINGS = 8;

function normText(raw: unknown, max = 400): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normMessage(raw: unknown, fallbackEnabled: boolean): BotMessage {
  const v = (raw ?? {}) as Partial<BotMessage>;
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : fallbackEnabled,
    text: normText(v.text),
  };
}

function normTime(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return /^\d{2}:\d{2}$/.test(s) ? s : "";
}

const SNOWFLAKE = /^\d{17,20}$/;

/** True for a real Discord snowflake (channel / guild / user / message id). */
export function isDiscordSnowflake(raw: unknown): boolean {
  return SNOWFLAKE.test(String(raw ?? "").trim());
}

/**
 * Pull a channel id out of a snowflake, <#id> mention, or discord.com/channels/... link.
 *
 * Stripping every non-digit used to concatenate guild+channel ids when someone
 * pasted a channel URL, which Discord then rejected with 50001 Missing Access.
 */
export function normChannelId(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  const fromUrl = s.match(
    /(?:https?:\/\/)?(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(?:@me|\d{17,20})\/(\d{17,20})/i
  );
  if (fromUrl) return fromUrl[1];

  const fromDesktop = s.match(
    /discord:\/\/-\/channels\/(?:@me|\d{17,20})\/(\d{17,20})/i
  );
  if (fromDesktop) return fromDesktop[1];

  const mention = s.match(/<#(\d{17,20})>/);
  if (mention) return mention[1];

  if (SNOWFLAKE.test(s)) return s;

  const digits = s.replace(/\D/g, "");
  if (SNOWFLAKE.test(digits)) return digits;

  // URL that was digit-stripped: guildId + channelId (and maybe messageId).
  for (const n of [19, 18, 17, 20]) {
    if (digits.length === n * 2 && SNOWFLAKE.test(digits.slice(n))) {
      return digits.slice(n);
    }
    if (digits.length === n * 3) {
      const channel = digits.slice(n, n * 2);
      if (SNOWFLAKE.test(channel)) return channel;
    }
  }

  return "";
}

/** Live input helper: snap a pasted link/mention to the id, otherwise keep digits. */
export function channelIdFromInput(raw: unknown): string {
  const s = String(raw ?? "");
  const parsed = normChannelId(s);
  if (parsed) return parsed;
  return s.replace(/\D/g, "").slice(0, 20);
}

/** Unique valid channel ids, first-seen order. */
export function collectChannelIds(
  ...candidates: (string | null | undefined)[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of candidates) {
    const id = normChannelId(raw);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** First non-empty of: per-message override, the user's channel, the env default. */
export function resolveChannelId(
  override: string | null | undefined,
  userChannelId: string | null | undefined
): string {
  return (
    collectChannelIds(
      override,
      userChannelId,
      process.env.DISCORD_CHANNEL_ID
    )[0] || ""
  );
}

function normPing(raw: unknown, index: number): ChannelPing | null {
  const v = (raw ?? {}) as Partial<ChannelPing>;
  const time = normTime(v.time);
  const text = normText(v.text);
  if (!time || !text) return null;
  return {
    id: normText(v.id, 40) || `ping-${index}`,
    label: normText(v.label, 60) || "Channel ping",
    time,
    text,
    enabled: v.enabled !== false,
    habitKey: normText(v.habitKey, 40),
    channelId: normChannelId(v.channelId),
  };
}

export function defaultBotMessages(): BotMessages {
  return {
    morningPing: { enabled: true, text: "" },
    nightReview: { enabled: true, text: "" },
    windDown: { enabled: true, text: "" },
    channelPings: [],
    todosChannelId: "",
    todosPingText: "",
    todosSendTime: "",
    lastTodosSendKey: "",
  };
}

/** Never throws — bad JSON falls back to defaults. */
export function parseBotMessages(json: unknown): BotMessages {
  let raw: unknown = json;
  if (typeof json === "string") {
    try {
      raw = JSON.parse(json || "{}");
    } catch {
      raw = {};
    }
  }
  const v = (raw ?? {}) as Partial<BotMessages>;
  return {
    morningPing: normMessage(v.morningPing, true),
    nightReview: normMessage(v.nightReview, true),
    windDown: normMessage(v.windDown, true),
    channelPings: Array.isArray(v.channelPings)
      ? v.channelPings
          .slice(0, MAX_CHANNEL_PINGS)
          .map((p, i) => normPing(p, i))
          .filter((p): p is ChannelPing => p !== null)
      : [],
    todosChannelId: normChannelId(v.todosChannelId),
    todosPingText: normText(v.todosPingText, 300),
    todosSendTime: normTime(v.todosSendTime),
    lastTodosSendKey: /^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}$/.test(
      String(v.lastTodosSendKey || "")
    )
      ? String(v.lastTodosSendKey)
      : "",
  };
}

export function serializeBotMessages(value: BotMessages): string {
  return JSON.stringify(parseBotMessages(value));
}

export type TemplateVars = {
  name?: string;
  wake?: string;
  sleep?: string;
  goal?: string;
  streak?: string | number;
  todos?: string;
};

/** Replaces {name}, {wake}, {sleep}, {goal}, {streak}, {todos}. */
export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key as keyof TemplateVars];
    return value === undefined || value === null || value === ""
      ? match
      : String(value);
  });
}

/** Custom text when the user wrote one, else the built-in default. */
export function messageText(
  settings: BotMessages,
  key: BotMessageKey,
  vars: TemplateVars
): string {
  const meta = BOT_MESSAGE_META.find((m) => m.key === key);
  const raw = settings[key].text || meta?.defaultText || "";
  return renderTemplate(raw, vars);
}

export function isMessageEnabled(
  settings: BotMessages,
  key: BotMessageKey
): boolean {
  return settings[key].enabled;
}
