import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/utils";
import { formatBrasiliaDateTime } from "@/lib/timezone";

// --- Logo cache (sessionStorage, TTL 10 min) ---
const LOGO_TTL_MS = 10 * 60 * 1000;
const logoDimsCache = new Map<string, { w: number; h: number }>();

async function loadLogoAsDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number }> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject();
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d")?.drawImage(img, 0, 0);
  return { dataUrl: canvas.toDataURL("image/png"), w: img.width, h: img.height };
}

async function getCachedLogoDataUrl(url: string): Promise<string | null> {
  try {
    const key = `epi-logo-cache:${url}`;
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as { dataUrl: string; w: number; h: number; ts: number };
      if (Date.now() - parsed.ts < LOGO_TTL_MS) {
        logoDimsCache.set(url, { w: parsed.w, h: parsed.h });
        return parsed.dataUrl;
      }
    }
    const { dataUrl, w, h } = await loadLogoAsDataUrl(url);
    logoDimsCache.set(url, { w, h });
    try {
      window.sessionStorage.setItem(key, JSON.stringify({ dataUrl, w, h, ts: Date.now() }));
    } catch {
      // quota — ignora
    }
    return dataUrl;
  } catch {
    return null;
  }
}

async function getImageDims(url: string): Promise<{ w: number; h: number }> {
  const cached = logoDimsCache.get(url);
  if (cached) return cached;
  const { w, h } = await loadLogoAsDataUrl(url);
  logoDimsCache.set(url, { w, h });
  return { w, h };
}

export interface TermoItem {
  id: string;
  epi_id: string;
  quantity: number;
  delivery_date: string;
  expiration_date: string | null;
  status: string;
  reason?: string | null;
}

export interface TermoGroup {
  employee_record_id: string | null;
  employee_name: string;
  delivery_date: string;
  items: TermoItem[];
}

export interface TermoOrgInfo {
  id?: string;
  name?: string | null;
  city?: string | null;
  logo_url?: string | null;
  epi_term_text?: string | null;
}

/**
 * Gera o PDF do termo de entrega de EPI.
 * Se signatureDataUrl for fornecido, retorna o jsPDF (sem salvar) para upload.
 * Caso contrário, faz o save() local.
 */
export async function generateEpiTermoPDF(
  group: TermoGroup,
  organization: TermoOrgInfo | null | undefined,
  signatureDataUrl?: string
): Promise<jsPDF | void> {
  // Fetch employee data
  let empData: any = null;
  let sectorName = "—";
  let functionName = "—";
  let companyName = organization?.name || "Empresa";
  let cnpjLogoUrl: string | null = null;

  if (group.employee_record_id) {
    const { data } = await supabase
      .from("employees")
      .select("cpf, ctps_number, admission_date, sector_id, job_function_id, organization_cnpj_id")
      .eq("id", group.employee_record_id)
      .maybeSingle();
    empData = data;

    // 2ª rodada: buscar CNPJ, setor, função e EPIs em paralelo
    const epiIds = [...new Set(group.items.map((it) => it.epi_id))];
    const [cnpjRes, secRes, fnRes, episRes] = await Promise.all([
      data?.organization_cnpj_id
        ? supabase
            .from("organization_cnpjs")
            .select("company_name, logo_url")
            .eq("id", data.organization_cnpj_id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
      data?.sector_id
        ? supabase.from("sectors").select("name").eq("id", data.sector_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      data?.job_function_id
        ? supabase.from("job_functions").select("name").eq("id", data.job_function_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.from("epis").select("id, name, ca_number").in("id", epiIds),
    ]);

    if (cnpjRes.data?.company_name) companyName = cnpjRes.data.company_name;
    if (cnpjRes.data?.logo_url) cnpjLogoUrl = cnpjRes.data.logo_url;
    if (secRes.data?.name) sectorName = secRes.data.name;
    if (fnRes.data?.name) functionName = fnRes.data.name;
    // armazena para uso abaixo
    (group as any).__episData = episRes.data;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  const logoSrc = cnpjLogoUrl || organization?.logo_url;
  if (logoSrc) {
    try {
      const imgData = await getCachedLogoDataUrl(logoSrc);
      if (imgData) {
        // Recupera dimensões originais (do cache ou carrega)
        const dims = await getImageDims(logoSrc);
        const logoH = 18;
        const logoW = (dims.w / dims.h) * logoH;
        doc.addImage(imgData, "PNG", 14, y, logoW, logoH);
      }
    } catch {
      // skip
    }
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, pageWidth / 2, y + 10, { align: "center" });
  y += 25;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA DE CONTROLE DE ENTREGA DE EPI", pageWidth / 2, y, { align: "center" });
  y += 3;
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const infoLeft = 14;
  const infoRight = pageWidth / 2 + 5;
  const lineH = 6;

  const drawField = (label: string, value: string, x: number, row: number) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}: `, x, y + row * lineH);
    const labelW = doc.getTextWidth(`${label}: `);
    doc.setFont("helvetica", "normal");
    doc.text(value, x + labelW, y + row * lineH);
  };

  drawField("Nome", group.employee_name, infoLeft, 0);
  drawField("Função", functionName, infoRight, 0);
  drawField("Setor", sectorName, infoLeft, 1);
  drawField("Data Admissão", empData?.admission_date ? format(parseLocalDate(empData.admission_date), "dd/MM/yyyy") : "—", infoRight, 1);
  drawField("CPF", empData?.cpf || "—", infoLeft, 2);
  drawField("CTPS", empData?.ctps_number || "—", infoRight, 2);

  y += lineH * 3 + 6;

  const episData = (group as any).__episData as Array<{ id: string; name: string; ca_number: string | null }> | undefined;
  const epiMap = new Map(episData?.map((e) => [e.id, e]) || []);

  const tableData = group.items.map((d, idx) => {
    const epi = epiMap.get(d.epi_id);
    // Para entregas retroativas, o "reason" carrega a data histórica
    const dataEntregaLabel = d.reason && d.reason.startsWith("Entrega retroativa referente a ")
      ? d.reason.replace("Entrega retroativa referente a ", "")
      : formatBrasiliaDateTime(d.delivery_date);
    return [
      String(idx + 1),
      epi?.name || "—",
      epi?.ca_number || "—",
      String(d.quantity),
      dataEntregaLabel,
      d.expiration_date ? format(parseLocalDate(d.expiration_date), "dd/MM/yyyy") : "—",
      "",
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "EPI", "C.A.", "Qtd", "Entrega", "Validade", "Assinatura"]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2, minCellHeight: 14 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10 },
      3: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 35 },
    },
    theme: "grid",
    margin: { left: 14, right: 14 },
    didDrawCell: (data) => {
      if (signatureDataUrl && data.section === "body" && data.column.index === 6) {
        const padding = 2;
        const cellW = data.cell.width - padding * 2;
        const cellH = data.cell.height - padding * 2;
        const imgRatio = 60 / 25;
        let imgW = cellW;
        let imgH = imgW / imgRatio;
        if (imgH > cellH) {
          imgH = cellH;
          imgW = imgH * imgRatio;
        }
        const x = data.cell.x + (data.cell.width - imgW) / 2;
        const sigY = data.cell.y + (data.cell.height - imgH) / 2;
        doc.addImage(signatureDataUrl, "PNG", x, sigY, imgW, imgH);
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("TERMO DE RESPONSABILIDADE", pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  const defaultTermoText =
    "Declaro ter recebido gratuitamente os Equipamentos de Proteção Individual (EPIs) acima descritos, " +
    "comprometendo-me a: usá-los apenas para a finalidade a que se destinam; responsabilizar-me pela guarda e " +
    "conservação dos mesmos; comunicar ao empregador qualquer alteração que os torne impróprios para uso; " +
    "devolvê-los ao empregador quando solicitado ou ao final do contrato de trabalho. Estou ciente de que o uso " +
    "dos EPIs é obrigatório conforme a NR-6 e que o descumprimento poderá acarretar sanções disciplinares.";
  const termoText = organization?.epi_term_text || defaultTermoText;
  const splitText = doc.splitTextToSize(termoText, pageWidth - 28);
  doc.text(splitText, 14, y);
  y += splitText.length * 4 + 14;

  const city = organization?.city || "Local";
  const dateStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(group.delivery_date));
  doc.setFontSize(9);
  doc.text(`${city}, ${dateStr}`, pageWidth / 2, y, { align: "center" });
  y += 20;

  if (signatureDataUrl) {
    const sigImgW = 60;
    const sigImgH = 25;
    doc.addImage(signatureDataUrl, "PNG", (pageWidth - sigImgW) / 2, y - 10, sigImgW, sigImgH);
    y += 18;
  } else {
    doc.setLineWidth(0.3);
    const sigW = 70;
    doc.line((pageWidth - sigW) / 2, y, (pageWidth + sigW) / 2, y);
    y += 5;
  }
  doc.setFontSize(8);
  doc.text(group.employee_name, pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.text("Assinatura do Funcionário", pageWidth / 2, y, { align: "center" });

  if (signatureDataUrl) {
    return doc;
  }
  doc.save(`Termo_EPI_${group.employee_name.replace(/\s+/g, "_")}_${group.delivery_date}.pdf`);
}
