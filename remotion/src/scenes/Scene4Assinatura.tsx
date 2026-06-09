import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const epiRows = [
  { epi: "Capacete MSA V-Gard", ca: "12.345", qtd: 1, validade: "12 meses" },
  { epi: "Luva Nitrílica Danny", ca: "34.567", qtd: 2, validade: "6 meses" },
  { epi: "Óculos de Proteção 3M", ca: "56.789", qtd: 1, validade: "12 meses" },
];

const SignatureSvg: React.FC<{ progress: number }> = ({ progress }) => (
  <svg
    viewBox="0 0 200 80"
    preserveAspectRatio="xMidYMid meet"
    style={{ width: "100%", height: "100%" }}
  >
    <path
      d="M 20,50 Q 35,20 50,50 Q 65,75 80,35 Q 95,10 110,45 Q 125,70 140,30 Q 155,10 170,45 Q 180,60 190,40"
      fill="none"
      stroke="#1A2332"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeDasharray="400"
      strokeDashoffset={interpolate(progress, [0, 1], [400, 0])}
    />
  </svg>
);

const thStyle: React.CSSProperties = {
  fontFamily: "sans-serif",
  fontSize: 15,
  fontWeight: 700,
  color: "#fff",
  padding: "10px 12px",
  textAlign: "left",
  background: "#1565C0",
};

const tdStyle: React.CSSProperties = {
  fontFamily: "sans-serif",
  fontSize: 15,
  color: "#1A2332",
  padding: "12px 12px",
  borderBottom: "1px solid #E2E8F0",
};

export const Scene4Assinatura: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 100 } });
  const titleOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });

  const features = [
    { text: "Validade jurídica", delay: 80 },
    { text: "Armazenamento seguro", delay: 100 },
    { text: "Acesso instantâneo", delay: 120 },
  ];

  const sigProgress = interpolate(frame, [40, 150], [0, 1], { extrapolateRight: "clamp" });

  const btnOpacity = interpolate(frame, [160, 180], [0, 1], { extrapolateRight: "clamp" });
  const btnScale = spring({ frame: frame - 160, fps, config: { damping: 15, stiffness: 200 } });

  const checkOpacity = interpolate(frame, [200, 220], [0, 1], { extrapolateRight: "clamp" });
  const checkScale = spring({ frame: frame - 200, fps, config: { damping: 8, stiffness: 200 } });

  const floatY = Math.sin(frame * 0.025) * 5;

  const tableOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #F0F5FA 0%, #FAFBFD 50%, #F0F5FA 100%)" }}>
      {/* Grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(200,210,225,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(200,210,225,0.1) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }} />

      {/* Left amber accent */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 6, height: "100%", background: "#F59E0B" }} />

      {/* Left side text */}
      <div style={{
        position: "absolute", left: 100, top: 200,
        opacity: titleOpacity,
        transform: `scale(${interpolate(titleScale, [0, 1], [0.9, 1])})`,
      }}>
        <div style={{ fontFamily: "sans-serif", fontWeight: 900, fontSize: 64, color: "#1A2332", lineHeight: 1.1 }}>
          Assinatura<br />Digital
        </div>
      </div>

      <div style={{ position: "absolute", left: 100, top: 390, opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" }) }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 26, color: "#94A3B8", lineHeight: 1.6 }}>
          Termo de entrega assinado<br />diretamente no dispositivo.
        </div>
      </div>

      {/* Amber rule */}
      <div style={{
        position: "absolute", left: 100, top: 510,
        width: interpolate(frame, [55, 85], [0, 400], { extrapolateRight: "clamp" }),
        height: 3, background: "#F59E0B",
      }} />

      {/* Feature bullets */}
      {features.map((feat, i) => {
        const fOpacity = interpolate(frame, [feat.delay, feat.delay + 15], [0, 1], { extrapolateRight: "clamp" });
        const fX = interpolate(frame, [feat.delay, feat.delay + 15], [-20, 0], { extrapolateRight: "clamp" });
        return (
          <div key={i} style={{
            position: "absolute", left: 100, top: 550 + i * 50,
            opacity: fOpacity, transform: `translateX(${fX}px)`,
          }}>
            <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 24, color: "#1565C0" }}>
              ✓ {feat.text}
            </span>
          </div>
        );
      })}

      {/* Right side: Signature card */}
      <div style={{
        position: "absolute", right: 80, top: 100 + floatY,
        width: 900, height: 860,
        background: "#fff",
        borderRadius: 20,
        boxShadow: "0 30px 80px rgba(21,101,192,0.12)",
        border: "1px solid #E2E8F0",
        overflow: "hidden",
        opacity: bgOpacity,
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          background: "#1565C0", height: 60,
          display: "flex", alignItems: "center", paddingLeft: 30,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 22, color: "#fff" }}>
            ✏ Termo de Responsabilidade — Assinatura Digital
          </span>
        </div>

        {/* Employee info */}
        <div style={{ padding: "18px 30px 10px", flexShrink: 0 }}>
          <div style={{ fontFamily: "sans-serif", fontSize: 17, color: "#1A2332", marginBottom: 4, fontWeight: 600 }}>
            Funcionário: Amanda Rodrigues da Silva
          </div>
          <div style={{ fontFamily: "sans-serif", fontSize: 15, color: "#94A3B8" }}>
            Setor: Produção &nbsp;·&nbsp; Função: Operador de Máquinas &nbsp;·&nbsp; Data: 22/03/2026 14:30
          </div>
        </div>

        {/* EPI Table */}
        <div style={{ padding: "10px 30px", flex: 1, opacity: tableOpacity }}>
          <table style={{ width: "100%", borderCollapse: "collapse", borderRadius: 10, overflow: "hidden" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: "30%", borderTopLeftRadius: 10 }}>EPI</th>
                <th style={{ ...thStyle, width: "12%", textAlign: "center" }}>C.A.</th>
                <th style={{ ...thStyle, width: "8%", textAlign: "center" }}>Qtd</th>
                <th style={{ ...thStyle, width: "15%", textAlign: "center" }}>Validade</th>
                <th style={{ ...thStyle, width: "35%", textAlign: "center", borderTopRightRadius: 10 }}>Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {epiRows.map((row, i) => {
                const rowDelay = 35 + i * 12;
                const rowOpacity = interpolate(frame, [rowDelay, rowDelay + 15], [0, 1], { extrapolateRight: "clamp" });
                const rowY = interpolate(frame, [rowDelay, rowDelay + 15], [10, 0], { extrapolateRight: "clamp" });
                return (
                  <tr key={i} style={{ opacity: rowOpacity, transform: `translateY(${rowY}px)` }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{row.epi}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{row.ca}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{row.qtd}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{row.validade}</td>
                    <td style={{ ...tdStyle, textAlign: "center", height: 70, padding: "6px 10px" }}>
                      <div style={{ width: "100%", height: 58, border: "1px dashed #CBD5E1", borderRadius: 6, background: "#FAFBFD", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        <SignatureSvg progress={sigProgress} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Legal text */}
          <div style={{
            marginTop: 18,
            fontFamily: "sans-serif",
            fontSize: 13,
            color: "#94A3B8",
            lineHeight: 1.5,
            opacity: interpolate(frame, [70, 90], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            Declaro ter recebido os EPIs acima em perfeitas condições de uso, comprometendo-me a utilizá-los exclusivamente para a finalidade a que se destinam.
          </div>
        </div>

        {/* Buttons */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 15,
          padding: "15px 30px",
          flexShrink: 0,
        }}>
          <div style={{
            padding: "12px 28px", borderRadius: 8,
            border: "1px solid #E2E8F0", background: "#F8FAFC",
          }}>
            <span style={{ fontFamily: "sans-serif", fontSize: 18, color: "#94A3B8" }}>Cancelar</span>
          </div>
          <div style={{
            padding: "12px 28px", borderRadius: 8,
            background: "#1565C0",
            opacity: btnOpacity,
            transform: `scale(${interpolate(btnScale, [0, 1], [0.8, 1])})`,
          }}>
            <span style={{ fontFamily: "sans-serif", fontSize: 18, color: "#fff", fontWeight: 600 }}>
              ✓ Confirmar Assinatura
            </span>
          </div>
        </div>

        {/* Success checkmark overlay */}
        {frame >= 200 && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(255,255,255,0.92)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            opacity: checkOpacity,
          }}>
            <div style={{
              width: 100, height: 100, borderRadius: "50%",
              background: "#22C55E",
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: `scale(${interpolate(checkScale, [0, 1], [0.3, 1])})`,
            }}>
              <span style={{ fontSize: 52, color: "#fff" }}>✓</span>
            </div>
            <div style={{ marginTop: 20, opacity: interpolate(frame, [220, 240], [0, 1], { extrapolateRight: "clamp" }) }}>
              <span style={{ fontFamily: "sans-serif", fontSize: 26, fontWeight: 700, color: "#1A2332" }}>
                Assinatura confirmada!
              </span>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
