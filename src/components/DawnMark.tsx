/** Square mark for the desktop nav — same role as the logo tile in a product bar. */
export function DawnSquare({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      className={className}
      aria-hidden
    >
      <rect width="28" height="28" rx="7" fill="#161c22" />
      <path
        d="M5 20c4.2-1.1 8.4-5.4 11.2-9.8C18.4 6.8 20.2 5.2 23 5"
        fill="none"
        stroke="#f0b45a"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M5 20c5.5.6 11.2.4 18-1.2"
        fill="none"
        stroke="#f0b45a"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function DawnMark({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  const h = size;
  const w = Math.round(size * 3.35);
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 94 28"
      className={className}
      aria-hidden
    >
      <title>Dawn</title>
      <text
        x="0"
        y="21"
        fill="currentColor"
        fontFamily="var(--font-display), Georgia, serif"
        fontSize="17"
        letterSpacing="-0.045em"
      >
        Dawn
      </text>
    </svg>
  );
}
