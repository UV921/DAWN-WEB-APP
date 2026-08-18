/** What someone is doing in a study session — Discord ping + web app. */

export const STUDY_ACTIVITY_PRESETS = [
  { key: "coding", label: "Coding" },
  { key: "studying", label: "Studying" },
  { key: "reading", label: "Reading" },
  { key: "writing", label: "Writing" },
] as const;

export type StudyActivityKey =
  | (typeof STUDY_ACTIVITY_PRESETS)[number]["key"]
  | "custom";

export const WEB_STUDY_GUILD = "web";
export const WEB_STUDY_CHANNEL = "web";

export const STUDY_ACTIVITY_MAX = 80;

export type StudyActivity = {
  key: StudyActivityKey;
  label: string;
};

export function isWebStudySession(session: {
  source?: string | null;
  channelId?: string | null;
  guildId?: string | null;
}): boolean {
  return (
    session.source === "web" ||
    session.channelId === WEB_STUDY_CHANNEL ||
    session.guildId === WEB_STUDY_GUILD
  );
}

export function studyActivityLabel(opts: {
  activityKey?: string | null;
  activity?: string | null;
}): string | null {
  const written = String(opts.activity || "").trim();
  if (written) return written.slice(0, STUDY_ACTIVITY_MAX);
  const preset = STUDY_ACTIVITY_PRESETS.find((p) => p.key === opts.activityKey);
  return preset?.label || null;
}

export function matchStudyActivityPreset(raw: string): StudyActivity | null {
  const needle = raw.trim().toLowerCase();
  if (!needle) return null;
  return (
    STUDY_ACTIVITY_PRESETS.find(
      (p) => p.key === needle || p.label.toLowerCase() === needle
    ) || null
  );
}

/** Button / chip / typed note → stored key + display label. */
export function normalizeStudyActivity(input: {
  key?: string | null;
  text?: string | null;
}): StudyActivity | null {
  const key = String(input.key || "")
    .trim()
    .toLowerCase();
  const text = String(input.text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, STUDY_ACTIVITY_MAX);

  if (key && key !== "custom" && key !== "other") {
    const preset = STUDY_ACTIVITY_PRESETS.find((p) => p.key === key);
    if (preset) return { key: preset.key, label: text || preset.label };
  }

  if (text) {
    const preset = matchStudyActivityPreset(text);
    if (preset) return preset;
    return { key: "custom", label: text };
  }

  return null;
}
