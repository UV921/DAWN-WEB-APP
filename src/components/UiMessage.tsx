"use client";

type Tone = "info" | "success" | "warn" | "error" | "tip";

const TONE: Record<
  Tone,
  { border: string; bg: string; text: string; label: string }
> = {
  info: {
    border: "border-white/15",
    bg: "bg-white/[0.04]",
    text: "text-[var(--color-cloud)]",
    label: "Note",
  },
  success: {
    border: "border-[var(--color-leaf)]/35",
    bg: "bg-[var(--color-leaf)]/10",
    text: "text-[var(--color-leaf)]",
    label: "Done",
  },
  warn: {
    border: "border-[var(--color-dawn)]/40",
    bg: "bg-[var(--color-dawn)]/10",
    text: "text-[var(--color-cloud)]",
    label: "Heads up",
  },
  error: {
    border: "border-red-400/30",
    bg: "bg-red-500/10",
    text: "text-red-200",
    label: "Couldn’t save",
  },
  tip: {
    border: "border-white/12",
    bg: "bg-white/[0.03]",
    text: "text-[var(--color-mist)]",
    label: "Tip",
  },
};

type Props = {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

/** Consistent status / help banners across the app. */
export function UiMessage({
  tone = "info",
  title,
  children,
  action,
  className = "",
}: Props) {
  const t = TONE[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3.5 ${t.border} ${t.bg} ${className}`}
    >
      <p className={`text-[0.65rem] font-medium uppercase tracking-[0.18em] ${t.text}`}>
        {title || t.label}
      </p>
      <div className="mt-1.5 text-sm leading-relaxed text-[var(--color-cloud)]">
        {children}
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

type EmptyProps = {
  kicker?: string;
  title: string;
  body: string;
  action?: React.ReactNode;
};

/** Empty / blocked state with one clear next step. */
export function UiEmpty({ kicker, title, body, action }: EmptyProps) {
  return (
    <section className="py-6 text-center sm:py-10">
      {kicker ? <p className="ui-kicker">{kicker}</p> : null}
      <h2 className="ui-title mt-2 text-[1.75rem] sm:text-3xl">{title}</h2>
      <p className="ui-sub mx-auto mt-3">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </section>
  );
}

type PageHelpProps = {
  kicker: string;
  title: string;
  help: string;
  meta?: React.ReactNode;
};

/** Screen header that always answers: where am I, what should I do? */
export function UiPageHelp({ kicker, title, help, meta }: PageHelpProps) {
  return (
    <header>
      <p className="ui-kicker">{kicker}</p>
      <h1 className="ui-title mt-2">{title}</h1>
      <p className="ui-sub mt-3">{help}</p>
      {meta ? (
        <div className="mt-4 text-sm text-[var(--color-mist)]">{meta}</div>
      ) : null}
    </header>
  );
}
