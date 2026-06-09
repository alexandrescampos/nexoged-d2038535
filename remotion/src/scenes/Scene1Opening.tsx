import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";

export const Scene1Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const taglineOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });
  const taglineY = interpolate(frame, [30, 55], [30, 0], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [55, 80], [0, 1], { extrapolateRight: "clamp" });
  const lineWidth = interpolate(frame, [45, 75], [0, 540], { extrapolateRight: "clamp" });

  // Gentle float for decorative circles
  const circleFloat = Math.sin(frame * 0.03) * 8;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #FAFBFD 0%, #F0F5FA 100%)" }}>
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(200,210,225,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(200,210,225,0.15) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }} />

      {/* Left blue accent bar */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 8, height: "100%", background: "#1565C0" }} />

      {/* Decorative circles */}
      <div style={{
        position: "absolute", right: 200, top: 80 + circleFloat,
        width: 260, height: 260, borderRadius: "50%",
        background: "rgba(21,101,192,0.06)",
      }} />
      <div style={{
        position: "absolute", right: 50, top: 350 - circleFloat,
        width: 180, height: 180, borderRadius: "50%",
        background: "rgba(21,101,192,0.08)",
      }} />
      <div style={{
        position: "absolute", right: 250, top: 550 + circleFloat * 0.5,
        width: 130, height: 130, borderRadius: "50%",
        background: "rgba(21,101,192,0.05)",
      }} />

      {/* Logo image */}
      <div style={{
        position: "absolute", left: 160, top: 280,
        opacity: logoOpacity,
        transform: `scale(${interpolate(logoScale, [0, 1], [0.8, 1])})`,
        display: "flex", alignItems: "center", justifyContent: "flex-start",
      }}>
        <Img src={staticFile("images/nexo-logo.png")} style={{ height: 200, objectFit: "contain" }} />
      </div>

      {/* Tagline */}
      <div style={{
        position: "absolute", left: 160, top: 520,
        opacity: taglineOpacity,
        transform: `translateY(${taglineY}px)`,
      }}>
        <span style={{ fontFamily: "sans-serif", fontSize: 42, color: "#94A3B8", fontWeight: 300 }}>
          Gestão de EPI Digital
        </span>
      </div>

      {/* Thin horizontal rule */}
      <div style={{
        position: "absolute", left: 160, top: 600,
        width: lineWidth, height: 2, background: "#1565C0",
      }} />

      {/* Subtitle */}
      <div style={{
        position: "absolute", left: 160, top: 630,
        opacity: subtitleOpacity,
      }}>
        <span style={{ fontFamily: "sans-serif", fontSize: 28, color: "#94A3B8", letterSpacing: 2 }}>
          Controle · Rastreabilidade · Conformidade
        </span>
      </div>
    </AbsoluteFill>
  );
};