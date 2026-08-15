export const LIST_PRESETS = ["Today", "Buy", "Share on X", "Errands"] as const;

export function normalizeListTitle(raw: unknown): string {
  const t = String(raw || "").trim().replace(/\s+/g, " ").slice(0, 40);
  return t || "Today";
}

export function slugListTitle(title: string): string {
  return (
    normalizeListTitle(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "list"
  );
}
