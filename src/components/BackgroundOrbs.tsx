export function BackgroundOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="orb-1 absolute -top-40 -left-32 h-[540px] w-[540px] rounded-full"
        style={{ background: "#C7D2FE", opacity: 0.18, filter: "blur(90px)" }}
      />
      <div
        className="orb-2 absolute top-1/3 -right-40 h-[620px] w-[620px] rounded-full"
        style={{ background: "#BBF7D0", opacity: 0.15, filter: "blur(100px)" }}
      />
      <div
        className="orb-3 absolute -bottom-40 left-1/3 h-[560px] w-[560px] rounded-full"
        style={{ background: "#FDE68C", opacity: 0.14, filter: "blur(95px)" }}
      />
    </div>
  );
}
