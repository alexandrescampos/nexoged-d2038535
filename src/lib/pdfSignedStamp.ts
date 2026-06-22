import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface SignatureInfo {
  id: string;
  assinante_id?: string | null;
  signer_name?: string | null;
  signer_email?: string | null;
  tipo_assinatura?: string | null;
  assinado_em?: string | null;
  hash_evidencia?: string | null;
  certificado_info?: any;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

/**
 * Stamps a PDF with a signature footer on every page and appends a
 * "Manifesto de Assinaturas" page listing every signer.
 */
export async function stampSignedPdf(
  originalBytes: ArrayBuffer | Uint8Array,
  signatures: SignatureInfo[],
  documentTitle: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();
  const signerCount = signatures.length;
  const firstHash = signatures[0]?.hash_evidencia?.slice(0, 12) || "";
  const footerText = `Assinado digitalmente • ${signerCount} assinatura(s) • Hash ${firstHash}… • Manifesto na última página`;

  pages.forEach((page, idx) => {
    const { width } = page.getSize();
    // Background strip
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 18,
      color: rgb(0.082, 0.137, 0.255), // sidebar #1A2332
    });
    page.drawText(footerText, {
      x: 10,
      y: 6,
      size: 7,
      font,
      color: rgb(1, 1, 1),
    });
    page.drawText(`Pág. ${idx + 1}/${pages.length}`, {
      x: width - 60,
      y: 6,
      size: 7,
      font,
      color: rgb(1, 1, 1),
    });
  });

  // Manifest page
  const manifest = pdfDoc.addPage();
  const { width, height } = manifest.getSize();
  const primary = rgb(0.082, 0.396, 0.753); // #1565C0
  const dark = rgb(0.082, 0.137, 0.255);

  // Header bar
  manifest.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: dark });
  manifest.drawText("MANIFESTO DE ASSINATURAS DIGITAIS", {
    x: 40, y: height - 38, size: 16, font: fontBold, color: rgb(1, 1, 1),
  });

  let y = height - 90;
  manifest.drawText(`Documento: ${documentTitle}`, { x: 40, y, size: 11, font: fontBold });
  y -= 16;
  manifest.drawText(`Total de assinaturas: ${signerCount}`, { x: 40, y, size: 10, font });
  y -= 14;
  manifest.drawText(
    `Gerado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    { x: 40, y, size: 10, font }
  );
  y -= 24;

  manifest.drawLine({
    start: { x: 40, y }, end: { x: width - 40, y },
    thickness: 1, color: primary,
  });
  y -= 20;

  signatures.forEach((sig, idx) => {
    if (y < 130) {
      // need a new page
      const p = pdfDoc.addPage();
      y = p.getHeight() - 60;
      drawSignatureBlock(p, sig, idx, y, fontBold, font, primary);
      y -= 100;
      return;
    }
    drawSignatureBlock(manifest, sig, idx, y, fontBold, font, primary);
    y -= 100;
  });

  // Footer note
  manifest.drawText(
    "Este manifesto comprova as assinaturas registradas no sistema Nexo GED.",
    { x: 40, y: 30, size: 8, font, color: rgb(0.4, 0.4, 0.4) }
  );

  return await pdfDoc.save();
}

function drawSignatureBlock(
  page: any,
  sig: SignatureInfo,
  idx: number,
  y: number,
  fontBold: any,
  font: any,
  primary: any
) {
  page.drawRectangle({
    x: 40, y: y - 88, width: page.getWidth() - 80, height: 92,
    borderColor: primary, borderWidth: 0.8,
    color: rgb(0.97, 0.98, 1),
  });
  page.drawText(`#${idx + 1} — ${sig.signer_name || sig.assinante_id || "Signatário"}`, {
    x: 50, y: y - 14, size: 11, font: fontBold, color: primary,
  });
  const lines = [
    `E-mail: ${sig.signer_email || "—"}`,
    `Tipo: ${sig.tipo_assinatura || "—"}`,
    `Assinado em: ${formatDate(sig.assinado_em)}`,
    `Hash de evidência: ${sig.hash_evidencia || "—"}`,
    `ID da assinatura: ${sig.id}`,
  ];
  let ly = y - 30;
  lines.forEach((l) => {
    page.drawText(l.length > 110 ? l.slice(0, 107) + "..." : l, {
      x: 50, y: ly, size: 8.5, font,
    });
    ly -= 12;
  });
}
