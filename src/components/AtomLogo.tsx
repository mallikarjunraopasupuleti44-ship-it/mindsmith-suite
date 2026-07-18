import logoUrl from "@/assets/aura-logo.png";

type Props = { size?: number; className?: string };

export function AtomLogo({ size = 40, className }: Props) {
  return (
    <img
      src={logoUrl}
      alt="Aura AI"
      width={size}
      height={size}
      loading="lazy"
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
