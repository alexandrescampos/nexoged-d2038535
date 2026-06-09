import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";

export const Scene2Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleX = interpolate(frame, [0, 20], [-40, 0], { extrapolateRight: "clamp" });

  const imgScale = spring({ frame: frame - 15, fps, config: { damping: 25, stiffness: 100 } });
  const imgOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });

  // Gentle zoom throughout scene
  const slowZoom = interpolate(frame, [0, 210], [1, 1.03], { extrapolateRight: "clamp" });

  // KPI highlights with stagger
  const kpiData = [
    { value: "25", label: "EPIs Cadastrados", color: "#1565C0", delay: 60 },
    { value: "23", label: "Entregas no Mês", color: "#22C55E", delay: 75 },
    { value: "80", label: "Funcionários", color: "#A855F7", delay: 90 },
    { value: "7", label: "Setores", color: "#14B8A6", delay: 105 },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #FAFBFD 0%, #EBF0F7 100%)" }}>
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(200,210,225,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(200,210,225,0.12) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }} />

      {/* Title */}
      <div style={{
        position: "absolute", left: 80, top: 45,
        opacity: titleOpacity,
        transform: `translateX(${titleX}px)`,
      }}>
        <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 36, color: "#1565C0", letterSpacing: 3 }}>
          VISÃO GERAL
        </span>
        <div style={{ width: 240, height: 2, background: "#1565C0", marginTop: 12 }} />
      </div>

      {/* Dashboard screenshot */}
      <div style={{
        position: "absolute",
        left: "50%", top: "55%",
        transform: `translate(-50%, -50%) scale(${interpolate(imgScale, [0, 1], [0.95, 1]) * slowZoom})`,
        opacity: imgOpacity,
      }}>
        <Img src={staticFile("images/nexo-dashboard.png")} style={{
          width: 1500,
          borderRadius: 12,
          boxShadow: "0 25px 80px rgba(21,101,192,0.15)",
        }} />
      </div>

      {/* Floating KPI highlights that appear staggered */}
      {kpiData.map((kpi, i) => {
        const kpiOpacity = interpolate(frame, [kpi.delay, kpi.delay + 15], [0, 1], { extrapolateRight: "clamp" });
        const kpiY = interpolate(frame, [kpi.delay, kpi.delay + 15], [20, 0], { extrapolateRight: "clamp" });
        const positions = [
          { left: 200, top: 860 },
          { left: 620, top: 860 },
          { left: 1040, top: 860 },
          { left: 1460, top: 860 },
        ];
        return (
          <div key={i} style={{
            position: "absolute",
            left: positions[i].left,
            top: positions[i].top,
            opacity: kpiOpacity,
            transform: `translateY(${kpiY}px)`,
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(255,255,255,0.9)",
            padding: "10px 20px",
            borderRadius: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            borderLeft: `4px solid ${kpi.color}`,
          }}>
            <span style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: 32, color: kpi.color }}>{kpi.value}</span>
            <span style={{ fontFamily: "sans-serif", fontSize: 16, color: "#64748B" }}>{kpi.label}</span>
          </div>
        );
      })}

      {/* Bottom caption */}
      <div style={{ position: "absolute", left: 80, bottom: 30, opacity: 0.5 }}>
        <span style={{ fontFamily: "sans-serif", fontSize: 18, color: "#94A3B8" }}>Dashboard — Nexo EPI</span>
      </div>
    </AbsoluteFill>
  );
};
