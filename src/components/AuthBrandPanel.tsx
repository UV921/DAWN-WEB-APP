import { DawnMark } from "@/components/DawnMark";

export function AuthBrandPanel() {
  return (
    <aside className="relative hidden min-h-screen overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12">
      <div aria-hidden className="hero-photo hero-photo-still hero-photo-auth-side">
        <img
          className="hero-photo-img"
          src="/images/landing-hero.jpg"
          alt=""
          width={1800}
          height={1467}
          decoding="async"
        />
        <div className="hero-photo-vignette" />
      </div>

      <p className="relative z-10 text-[var(--color-dawn)]">
        <DawnMark size={28} />
      </p>

      <p className="relative z-10 max-w-[16ch] font-display text-[2.15rem] leading-[1.05] tracking-[-0.03em] text-white">
        Wake. Lists. Study. Night.
      </p>
    </aside>
  );
}
