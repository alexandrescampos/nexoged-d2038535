// Registry canônico de MIME types e extensões para o pipeline OCR.
// Cada entrada agrupa o MIME oficial, aliases conhecidos, extensões aceitas e a "família" lógica.

export type FileFamily = "pdf" | "docx" | "spreadsheet" | "csv" | "text" | "image" | "unknown";
export type ResolutionSource = "mime" | "extension" | "magic" | "fallback";

export interface MimeEntry {
  canonical: string;
  aliases: string[];
  extensions: string[];
  family: FileFamily;
}

export interface ResolvedFileType {
  canonicalMime: string;
  family: FileFamily;
  ext: string;
  source: ResolutionSource;
  mimeRaw: string;
}

export const MIME_REGISTRY: MimeEntry[] = [
  {
    canonical: "application/pdf",
    aliases: ["application/x-pdf", "application/acrobat", "applications/vnd.pdf", "text/pdf", "text/x-pdf"],
    extensions: ["pdf"],
    family: "pdf",
  },
  {
    canonical: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    aliases: ["application/msword", "application/x-msword", "application/word"],
    extensions: ["docx", "docm"],
    family: "docx",
  },
  {
    canonical: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    aliases: [
      "application/vnd.ms-excel.sheet.macroenabled.12",
      "application/vnd.ms-excel.sheet.macroEnabled.12",
      "application/x-excel",
      "application/x-msexcel",
      "application/excel",
    ],
    extensions: ["xlsx", "xlsm"],
    family: "spreadsheet",
  },
  {
    canonical: "application/vnd.ms-excel",
    aliases: ["application/msexcel", "application/x-xls"],
    extensions: ["xls"],
    family: "spreadsheet",
  },
  {
    canonical: "text/csv",
    aliases: ["application/csv", "text/x-csv", "application/vnd.ms-excel.csv"],
    extensions: ["csv"],
    family: "csv",
  },
  {
    canonical: "text/plain",
    aliases: ["text/txt", "application/txt"],
    extensions: ["txt", "log"],
    family: "text",
  },
  {
    canonical: "application/xml",
    aliases: ["text/xml", "application/xhtml+xml"],
    extensions: ["xml", "xsd", "xsl", "xslt"],
    family: "text",
  },
  {
    canonical: "image/png",
    aliases: ["image/x-png"],
    extensions: ["png"],
    family: "image",
  },
  {
    canonical: "image/jpeg",
    aliases: ["image/jpg", "image/pjpeg", "image/x-jpeg"],
    extensions: ["jpg", "jpeg", "jpe", "jfif"],
    family: "image",
  },
  {
    canonical: "image/webp",
    aliases: ["image/x-webp"],
    extensions: ["webp"],
    family: "image",
  },
  {
    canonical: "image/gif",
    aliases: [],
    extensions: ["gif"],
    family: "image",
  },
  {
    canonical: "image/bmp",
    aliases: ["image/x-bmp", "image/x-ms-bmp"],
    extensions: ["bmp"],
    family: "image",
  },
  {
    canonical: "image/tiff",
    aliases: ["image/x-tiff"],
    extensions: ["tif", "tiff"],
    family: "image",
  },
  {
    canonical: "image/heic",
    aliases: ["image/heif"],
    extensions: ["heic", "heif"],
    family: "image",
  },
];

export function normalizeMime(mime: string | null | undefined): string {
  return String(mime || "").trim().toLowerCase().split(";")[0].trim();
}

function findByMime(mime: string): MimeEntry | undefined {
  const m = normalizeMime(mime);
  if (!m) return undefined;
  return MIME_REGISTRY.find((e) =>
    e.canonical.toLowerCase() === m || e.aliases.map((a) => a.toLowerCase()).includes(m),
  );
}

function findByExt(ext: string): MimeEntry | undefined {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!e) return undefined;
  return MIME_REGISTRY.find((entry) => entry.extensions.includes(e));
}

function extOf(fname: string): string {
  const i = fname.lastIndexOf(".");
  return i >= 0 ? fname.slice(i + 1).toLowerCase() : "";
}

// Inspeção dos primeiros bytes (magic numbers).
function sniffMagic(buffer: ArrayBuffer | null | undefined): MimeEntry | undefined {
  if (!buffer) return undefined;
  const b = new Uint8Array(buffer.slice(0, 16));
  if (b.length < 4) return undefined;

  // %PDF
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return findByMime("application/pdf");
  }
  // PK\x03\x04 — zip (docx/xlsx). Sem leitura do central directory, distinguimos via heurística:
  // procuramos pelos marcadores "word/" ou "xl/" nos primeiros 4KB.
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    const head = new Uint8Array(buffer.slice(0, 4096));
    const txt = new TextDecoder("latin1").decode(head);
    if (txt.includes("word/")) return findByMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    if (txt.includes("xl/")) return findByMime("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    // zip genérico sem pista → não decidimos.
    return undefined;
  }
  // OLE compound (xls legado): D0 CF 11 E0 A1 B1 1A E1
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) {
    return findByMime("application/vnd.ms-excel");
  }
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return findByMime("image/jpeg");
  }
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return findByMime("image/png");
  }
  // GIF: "GIF8"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
    return findByMime("image/gif");
  }
  // BMP: "BM"
  if (b[0] === 0x42 && b[1] === 0x4d) {
    return findByMime("image/bmp");
  }
  // TIFF: II*\x00 ou MM\x00*
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
      (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)) {
    return findByMime("image/tiff");
  }
  // WEBP: "RIFF"...."WEBP"
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return findByMime("image/webp");
  }
  return undefined;
}

export function resolveFileType(
  fname: string,
  mimeRaw: string,
  buffer?: ArrayBuffer | null,
): ResolvedFileType {
  const normalized = normalizeMime(mimeRaw);
  const ext = extOf(fname || "");

  // 1) MIME explícito conhecido (ignora octet-stream como fonte primária).
  if (normalized && normalized !== "application/octet-stream" && normalized !== "binary/octet-stream") {
    const byMime = findByMime(normalized);
    if (byMime) {
      return { canonicalMime: byMime.canonical, family: byMime.family, ext, source: "mime", mimeRaw: normalized };
    }
  }

  // 2) Extensão do nome do arquivo.
  const byExt = findByExt(ext);
  if (byExt) {
    return { canonicalMime: byExt.canonical, family: byExt.family, ext, source: "extension", mimeRaw: normalized };
  }

  // 3) Magic bytes.
  const byMagic = sniffMagic(buffer);
  if (byMagic) {
    return { canonicalMime: byMagic.canonical, family: byMagic.family, ext, source: "magic", mimeRaw: normalized };
  }

  // 4) Fallback.
  return { canonicalMime: normalized, family: "unknown", ext, source: "fallback", mimeRaw: normalized };
}

// Verifica se um canonicalMime (ou qualquer um de seus aliases) está coberto pela whitelist.
export function isAllowedByWhitelist(canonicalMime: string, whitelist: string[]): boolean {
  const wl = whitelist.map((m) => m.toLowerCase());
  if (wl.includes(canonicalMime.toLowerCase())) return true;
  const entry = MIME_REGISTRY.find((e) => e.canonical.toLowerCase() === canonicalMime.toLowerCase());
  if (!entry) return false;
  return entry.aliases.some((a) => wl.includes(a.toLowerCase()));
}

export const CANONICAL_MIMES = MIME_REGISTRY.map((e) => e.canonical);
