import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";

export const Scene3Entregas: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame, fps, config: { damping: 25, stiffness: 100 } });
  const imgX = interpolate(slideIn, [0, 1], [100, 0]);
  const imgOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });

  // Text reveals
  const titleOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [20, 40], [30, 0], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" });

  // Zoom effect on screenshot
  const slowZoom = interpolate(frame, [0, 240], [1, 1.05], { extrapolateRight: "clamp" });

  // Highlight pulse
  const highlightOpacity = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: "clamp" });
  const pulseAlpha = 0.3 + 0.2 * Math.sin(frame * 0.08);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #FAFBFD 0%, #EBF0F7 100%)" }}>
      {/* Grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(200,210,225,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(200,210,225,0.12) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }} />

      {/* Left blue bar */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 6, height: "100%", background: "#1565C0" }} />

      {/* Screenshot */}
      <div style={{
        position: "absolute",
        left: "50%", top: "50%",
        transform: `translate(-50%, -50%) translateX(${imgX}px) scale(${slowZoom})`,
        opacity: imgOpacity,
      }}>
        <Img src={staticFile("images/nexo-entregas.png")} style={{
          width: 1600,
          borderRadius: 12,
          boxShadow: "0 30px 80px rgba(21,101,192,0.12)",
        }} />
      </div>

      {/* Overlay title */}
      <div style={{
        position: "absolute", left: 100, bottom: 120,
        opacity: titleOpacity,
        transform: `translateY(${titleY}px)`,
        background: "rgba(26,35,50,0.88)",
        padding: "20px 40px",
        borderRadius: 12,
        borderLeft: "4px solid #F59E0B",
      }}>
        <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 36, color: "#fff" }}>
          Controle completo de entregas
        </span>
        <div style={{ opacity: subtitleOpacity, marginTop: 8 }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 22, color: "rgba(255,255,255,0.7)" }}>
            Rastreie cada EPI entregue com assinatura digital integrada
          </span>
        </div>
      </div>

      {/* Pulsing highlight on signature column */}
      <div style={{
        position: "absolute",
        right: 120, top: 180,
        width: 200, height: 450,
        border: `3px solid rgba(245,158,11,${pulseAlpha})`,
        borderRadius: 12,
        opacity: highlightOpacity,
      }} />
    </AbsoluteFill>
  );
};
