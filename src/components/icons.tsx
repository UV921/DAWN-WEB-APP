import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, className, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
    ...rest,
  };
}

/** Inline chevron for links / flow steps (replaces →) */
export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
    </svg>
  );
}

export function IconChart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15v-4M12 15V8M16 15v-6" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 19c0-2.2-1.6-4-4-4" />
    </svg>
  );
}

export function IconMoreVertical(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3" />
      <path d="M12 11v4M9 20h6M10 20v-3h4v3" />
    </svg>
  );
}

export function IconShare(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v10" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

/** Discord glyph — filled, so it ignores the shared stroke setup */
export function IconDiscord({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...rest}
    >
      <path d="M19.54 5.34A16.1 16.1 0 0 0 15.5 4.1l-.2.37c1.32.32 2.44.85 3.47 1.62a12.6 12.6 0 0 0-4.2-1.02 13.8 13.8 0 0 0-5.15 0A12.6 12.6 0 0 0 5.23 6.1c1.03-.77 2.15-1.3 3.47-1.62L8.5 4.1a16.1 16.1 0 0 0-4.04 1.24C1.9 9.2 1.2 12.96 1.55 16.67a16.3 16.3 0 0 0 4.94 2.5c.4-.54.75-1.12 1.05-1.73-.58-.22-1.13-.49-1.65-.8.14-.1.28-.21.41-.32a11.6 11.6 0 0 0 9.9 0c.13.11.27.22.41.32-.52.31-1.07.58-1.65.8.3.61.65 1.19 1.05 1.73a16.3 16.3 0 0 0 4.94-2.5c.42-4.3-.7-8.03-2.41-11.33ZM8.52 14.46c-.97 0-1.77-.89-1.77-1.98s.78-1.98 1.77-1.98 1.79.89 1.77 1.98c0 1.09-.78 1.98-1.77 1.98Zm6.96 0c-.97 0-1.77-.89-1.77-1.98s.78-1.98 1.77-1.98 1.79.89 1.77 1.98c0 1.09-.78 1.98-1.77 1.98Z" />
    </svg>
  );
}

/** Lucide flag — priority */
export function IconFlag(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22V15" />
    </svg>
  );
}

/** Lucide clock — reminder time */
export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Lucide panel-left-close */
export function IconPanelClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </svg>
  );
}

/** Lucide panel-left-open */
export function IconPanelOpen(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </svg>
  );
}

/** Small inline flow: A · B · C with chevrons between */
export function FlowSteps({ steps }: { steps: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => (
        <span key={`${s}-${i}`} className="inline-flex items-center gap-1.5">
          {i > 0 ? (
            <IconChevronRight
              size={14}
              className="shrink-0 text-[var(--color-dawn)]/80"
            />
          ) : null}
          <span>{s}</span>
        </span>
      ))}
    </span>
  );
}
