"use client";

import Link from "next/link";

export type FriendSuggestion = {
  id: string;
  name: string | null;
  image: string | null;
  discordId: string | null;
  reason: "same-server" | "on-discord";
  reasonLabel: string;
};

export type DiscordGroupInfo = {
  circleId: string | null;
  name: string;
  inviteCode: string | null;
  memberCount: number;
  inGroup: boolean;
  hasGuild: boolean;
};

export type AddCircle = {
  id: string;
  name: string;
  members: { userId: string }[];
};

function Avatar({
  name,
  image,
  size = 9,
}: {
  name: string | null;
  image: string | null;
  size?: number;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className="rounded-full border border-white/20 object-cover"
        style={{ height: size * 4, width: size * 4 }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-white/10 text-sm text-white"
      style={{ height: size * 4, width: size * 4 }}
    >
      {(name || "?").slice(0, 1)}
    </div>
  );
}

export function CircleAddFriends({
  inviteCode,
  onInviteCode,
  onJoin,
  circleName,
  onCircleName,
  onCreate,
  busy,
  hasDiscord,
  discordGroup,
  onJoinDiscordGroup,
  suggestions,
  circles,
  addTargetId,
  onAddTarget,
  onAddMember,
  searchQ,
  onSearchQ,
  onSearch,
  searchHits,
}: {
  inviteCode: string;
  onInviteCode: (v: string) => void;
  onJoin: () => void;
  circleName: string;
  onCircleName: (v: string) => void;
  onCreate: () => void;
  busy: boolean;
  hasDiscord: boolean;
  discordGroup: DiscordGroupInfo | null;
  onJoinDiscordGroup: () => void;
  suggestions: FriendSuggestion[];
  circles: AddCircle[];
  addTargetId: string;
  onAddTarget: (id: string) => void;
  onAddMember: (userId: string) => void;
  searchQ: string;
  onSearchQ: (v: string) => void;
  onSearch: () => void;
  searchHits: FriendSuggestion[];
}) {
  const defaultCircleId = addTargetId || circles[0]?.id || "";
  const targetCircle = circles.find((c) => c.id === defaultCircleId);
  const memberIds = new Set(targetCircle?.members.map((m) => m.userId) || []);
  const addable = suggestions.filter((s) => !memberIds.has(s.id));
  const sameServer = addable.filter((s) => s.reason === "same-server");
  const onDiscord = addable.filter((s) => s.reason === "on-discord");
  const hits = searchHits.filter((s) => !memberIds.has(s.id));

  return (
    <div className="mt-8 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-mist)]">
            Join with a code
          </p>
          <p className="mt-2 text-sm text-[var(--color-mist)]">
            Paste a code, a Dawn invite link, or even a messy message — we’ll
            read the code.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={inviteCode}
              onChange={(e) => onInviteCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inviteCode.trim()) onJoin();
              }}
              placeholder="CODE or invite link"
              className="w-full flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono tracking-widest text-white outline-none focus:border-[var(--color-dawn)]"
            />
            <button
              type="button"
              disabled={busy || !inviteCode.trim()}
              onClick={onJoin}
              className="rounded-full bg-[var(--color-dawn)] px-6 py-3 text-sm font-semibold text-[var(--color-night)] disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-dawn)]/25 bg-[var(--color-dawn)]/[0.06] px-5 py-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-dawn)]">
            Start a circle
          </p>
          <p className="mt-2 text-sm text-[var(--color-mist)]">
            You’re the owner. Share a code, or add Discord friends below.
          </p>
          <input
            value={circleName}
            onChange={(e) => onCircleName(e.target.value)}
            placeholder="Circle name"
            className="mt-4 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-dawn)]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={onCreate}
            className="mt-3 rounded-full border border-white/20 px-6 py-3 text-sm text-white disabled:opacity-50"
          >
            Create circle
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-mist)]">
          Discord · same server
        </p>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          If they’re already on Dawn with Discord — or in your study server —
          add them in one tap. No code needed.
        </p>

        {!hasDiscord ? (
          <Link
            href="/settings?tab=discord"
            className="mt-4 inline-flex rounded-full border border-[var(--color-dawn)]/40 bg-[var(--color-dawn)]/10 px-4 py-2 text-sm text-[var(--color-dawn)]"
          >
            Link Discord so same-server friends show up
          </Link>
        ) : discordGroup && !discordGroup.inGroup && discordGroup.hasGuild ? (
          <button
            type="button"
            disabled={busy}
            onClick={onJoinDiscordGroup}
            className="mt-4 rounded-full bg-[var(--color-dawn)] px-5 py-2.5 text-sm font-semibold text-[var(--color-night)] disabled:opacity-50"
          >
            Join Discord server group
            {discordGroup.memberCount > 0
              ? ` · ${discordGroup.memberCount} people`
              : ""}
          </button>
        ) : discordGroup?.inGroup ? (
          <p className="mt-3 text-sm text-[var(--color-leaf)]">
            You’re in {discordGroup.name}
            {discordGroup.memberCount
              ? ` · ${discordGroup.memberCount} on the board`
              : ""}
            .
          </p>
        ) : null}

        {circles.length > 1 ? (
          <label className="mt-4 block text-xs text-[var(--color-mist)]">
            Add to circle
            <select
              value={defaultCircleId}
              onChange={(e) => onAddTarget(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              {circles.map((c) => (
                <option key={c.id} value={c.id} className="bg-[var(--color-night)]">
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
        >
          <input
            value={searchQ}
            onChange={(e) => onSearchQ(e.target.value)}
            placeholder="Search a Discord name or ID"
            className="w-full flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-dawn)]"
          />
          <button
            type="submit"
            disabled={busy || !searchQ.trim()}
            className="rounded-full border border-white/20 px-5 py-3 text-sm text-white disabled:opacity-40"
          >
            Find
          </button>
        </form>

        {hits.length > 0 ? (
          <SuggestList
            title="Search"
            people={hits}
            busy={busy}
            canAdd={Boolean(targetCircle)}
            onAdd={onAddMember}
          />
        ) : null}

        {sameServer.length > 0 ? (
          <SuggestList
            title="Same Discord server"
            people={sameServer}
            busy={busy}
            canAdd={Boolean(targetCircle)}
            onAdd={onAddMember}
          />
        ) : null}

        {onDiscord.length > 0 ? (
          <SuggestList
            title="On Discord · Dawn"
            people={onDiscord}
            busy={busy}
            canAdd={Boolean(targetCircle)}
            onAdd={onAddMember}
          />
        ) : null}

        {hasDiscord &&
        addable.length === 0 &&
        hits.length === 0 &&
        circles.length > 0 ? (
          <p className="mt-4 text-sm text-[var(--color-mist)]">
            Nobody new from Discord right now. Share the invite code, or ask
            them to log into Dawn with Discord.
          </p>
        ) : null}

        {circles.length === 0 && (sameServer.length > 0 || onDiscord.length > 0) ? (
          <p className="mt-4 text-sm text-[var(--color-mist)]">
            Create a circle above, then tap Add next to a friend.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SuggestList({
  title,
  people,
  busy,
  canAdd,
  onAdd,
}: {
  title: string;
  people: FriendSuggestion[];
  busy: boolean;
  canAdd: boolean;
  onAdd: (userId: string) => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-mist)]">
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {people.slice(0, 12).map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
          >
            <Avatar name={p.name} image={p.image} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {p.name || "Dawn user"}
              </p>
              <p className="text-[11px] text-[var(--color-mist)]">
                {p.reasonLabel}
              </p>
            </div>
            <button
              type="button"
              disabled={busy || !canAdd}
              onClick={() => onAdd(p.id)}
              className="shrink-0 rounded-full bg-[var(--color-dawn)] px-3 py-1.5 text-xs font-semibold text-[var(--color-night)] disabled:opacity-40"
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
