import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";

export const Scene5Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const lineWidth = interpolate(frame, [20, 50], [0, 510], { extrapolateRight: "clamp" });
  const taglineOpacity = interpolate(frame, [35, 55], [0, 1], { extrapolateRight: "clamp" });
  const urlOpacity = interpolate(frame, [55, 75], [0, 1], { extrapolateRight: "clamp" });

  // Subtle floating circles
  const f1 = Math.sin(frame * 0.04) * 6;
  const f2 = Math.cos(frame * 0.03) * 8;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #1A2332 0%, #1E3048 100%)" }}>
      {/* Dark grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }} />

      {/* Decorative circles */}
      <div style={{
        position: "absolute", left: 60, top: 60 + f1,
        width: 200, height: 200, borderRadius: "50%",
        background: "rgba(21,101,192,0.12)",
      }} />
      <div style={{
        position: "absolute", right: 80, bottom: 80 + f2,
        width: 250, height: 250, borderRadius: "50%",
        background: "rgba(245,158,11,0.08)",
      }} />

      {/* Logo image */}
      <div style={{
        position: "absolute",
        left: "50%", top: 300,
        transform: `translateX(-50%) scale(${interpolate(logoScale, [0, 1], [0.8, 1])})`,
        opacity: logoOpacity,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Img src={staticFile("images/nexo-logo.png")} style={{ height: 180, objectFit: "contain" }} />
      </div>

      {/* Amber rule */}
      <div style={{
        position: "absolute",
        left: "50%", top: 510,
        transform: "translateX(-50%)",
        width: lineWidth, height: 2, background: "#F59E0B",
      }} />

      {/* Tagline */}
      <div style={{
        position: "absolute",
        left: "50%", top: 540,
        transform: "translateX(-50%)",
        opacity: taglineOpacity,
      }}>
        <span style={{ fontFamily: "sans-serif", fontSize: 36, color: "rgba(200,210,225,0.9)", fontWeight: 300 }}>
          Segurança que se comprova.
        </span>
      </div>

      {/* URL */}
      <div style={{
        position: "absolute",
        left: "50%", top: 610,
        transform: "translateX(-50%)",
        opacity: urlOpacity,
      }}>
        <span style={{ fontFamily: "sans-serif", fontSize: 22, color: "rgba(148,163,184,0.7)", letterSpacing: 1 }}>
          www.nexoepi.tecnologianexo.com.br
        </span>
      </div>
    </AbsoluteFill>
  );
};