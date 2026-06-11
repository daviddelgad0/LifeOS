/**
 * Fixed gradient mesh behind all content. Felt, not seen —
 * if you notice it immediately, lower the opacities.
 */
export function Atmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute rounded-full"
        style={{
          top: -200,
          right: -160,
          width: 700,
          height: 700,
          background: "var(--accent)",
          opacity: 0.07,
          filter: "blur(120px)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          bottom: -240,
          left: -200,
          width: 800,
          height: 800,
          background: "#1a1a4e",
          opacity: 0.14,
          filter: "blur(120px)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: "40%",
          right: -240,
          width: 600,
          height: 600,
          background: "#2d1b4e",
          opacity: 0.12,
          filter: "blur(120px)",
        }}
      />
    </div>
  );
}
