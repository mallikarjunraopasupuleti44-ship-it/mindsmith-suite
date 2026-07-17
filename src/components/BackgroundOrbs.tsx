export function BackgroundOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Soft periwinkle */}
      <div
        className="orb-1 absolute -top-40 -left-32 h-[560px] w-[560px] rounded-full"
        style={{ background: "#E0E7FF", opacity: 0.16, filter: "blur(90px)" }}
      />
      {/* Soft blush pink */}
      <div
        className="orb-2 absolute top-1/3 -right-40 h-[640px] w-[640px] rounded-full"
        style={{ background: "#FBCFE8", opacity: 0.14, filter: "blur(100px)" }}
      />
      {/* Soft mint */}
      <div
        className="orb-3 absolute -bottom-40 left-1/3 h-[560px] w-[560px] rounded-full"
        style={{ background: "#D1FAE5", opacity: 0.13, filter: "blur(95px)" }}
      />
    </div>
  );
}
