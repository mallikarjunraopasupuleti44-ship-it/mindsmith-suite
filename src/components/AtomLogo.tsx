type Props = { size?: number; className?: string };

export function AtomLogo({ size = 40, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="aura-a" x1="8" y1="40" x2="40" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B4FE9" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      {/* Orbits */}
      <ellipse cx="24" cy="24" rx="20" ry="8" stroke="url(#aura-a)" strokeOpacity="0.35" strokeWidth="1.2" transform="rotate(35 24 24)" />
      <ellipse cx="24" cy="24" rx="20" ry="8" stroke="url(#aura-a)" strokeOpacity="0.25" strokeWidth="1.2" transform="rotate(-35 24 24)" />
      {/* Letter A */}
      <path
        d="M15 34 L23 12 h2 L33 34 M18.5 27 h11"
        stroke="url(#aura-a)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Nucleus dot */}
      <circle cx="33" cy="14" r="1.8" fill="#8B5CF6" />
    </svg>
  );
}
