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
