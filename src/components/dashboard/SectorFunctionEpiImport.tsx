import { useRef, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileText, Loader2, Upload } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface SectorOption {
  id: string;
  name: string;
}

interface JobFunctionOption {
  id: string;
  name: string;
  code: string;
  sector_id: string | null;
}

interface EpiOption {
  id: string;
  code: string;
  name: string;
  ca_number: string | null;
}

interface ExistingAssociation {
  id: string;
  sector_id: string;
  job_function_id: string;
  epi_id: string;
}

interface ParsedAssociationRow {
  row: number;
  sector: string;
  jobFunction: string;
  jobFunctionCode: string;
  epiCode: string;
  quantity: number | null;
  validityMonths: number | null;
  errors: string[];
  sectorId?: string;
  jobFunctionId?: string;
  epiId?: string;
}

interface SectorFunctionEpiImportProps {
  organizationId: string;
  sectors: SectorOption[];
  jobFunctions: JobFunctionOption[];
  epis: EpiOption[];
  associations: ExistingAssociation[];
  onImportComplete: () => void;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim();

const findHeader = (headers: string[], aliases: string[]) => {
  const normalizedHeaders = headers.map(normalize);
  const normalizedAliases = aliases.map(normalize);

  for (const alias of normalizedAliases) {
    const index = normalizedHeaders.indexOf(alias);
    if (index !== -1) return headers[index];
  }

  for (const alias of normalizedAliases) {
    const index = normalizedHeaders.findIndex((header) => header.startsWith(alias));
    if (index !== -1) return headers[index];
  }

  for (const alias of normalizedAliases) {
    if (alias.length < 2) continue;
    const index = normalizedHeaders.findIndex((header) => header.includes(alias));
    if (index !== -1) return headers[index];
  }

  return null;
};

const parsePositiveInteger = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export default function SectorFunctionEpiImport({
  organizationId,
  sectors,
  jobFunctions,
  epis,
  associations,
  onImportComplete,
}: SectorFunctionEpiImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedAssociationRow[]>([]);
  const [importing, setImporting] = useState(false);

  const DUPLICATE_ERROR = "Associação já cadastrada no sistema";
  const DUPLICATE_IMPORT_ERROR = "Associação duplicada na planilha";
  const NON_BLOCKING_ERRORS = [DUPLICATE_ERROR, DUPLICATE_IMPORT_ERROR];

  const hasCriticalErrors = (row: ParsedAssociationRow) =>
    row.errors.some((e) => !NON_BLOCKING_ERRORS.includes(e));

  const importableRows = parsedRows.filter((row) => row.errors.length === 0);
  const skippedRows = parsedRows.filter((row) => row.errors.length > 0 && !hasCriticalErrors(row));
  const blockingErrorRows = parsedRows.filter((row) => hasCriticalErrors(row));
  const errorRows = parsedRows.filter((row) => row.errors.length > 0);
  const canImport = blockingErrorRows.length === 0 && importableRows.length > 0;

  const resetState = () => {
    setDialogOpen(false);
    setParsedRows([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const generateInconsistenciesPdf = () => {
    if (!errorRows.length) return;

    const doc = new jsPDF();
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    doc.setFontSize(16);
    doc.text("Relatório de Inconsistências", 14, 20);
    doc.setFontSize(11);
    doc.text("Importação EPI por Função", 14, 28);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Gerado em: ${dateStr}`, 14, 35);
    doc.text(`Total de inconsistências: ${errorRows.length}`, 14, 41);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 48,
      head: [["Linha", "Setor", "Cód. Função", "Função", "Cód. EPI", "Qtd", "Validade", "Erro(s)"]],
      body: errorRows.map((row) => [
        String(row.row),
        row.sector || "—",
        row.jobFunctionCode || "—",
        row.jobFunction || "—",
        row.epiCode || "—",
        row.quantity != null ? String(row.quantity) : "—",
        row.validityMonths != null ? String(row.validityMonths) : "—",
        row.errors.join("; "),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 14 },
        6: { cellWidth: 50 },
      },
    });

    doc.save("inconsistencias-importacao-epi.pdf");
  };

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      {
        SETOR: "Produção",
        "CÓD FUNÇÃO": "FUN-001",
        "FUNÇÃO": "Operador",
        "CÓD EPI": "EPI-001",
        QTD: 1,
        "VALIDADE (MESES)": 12,
      },
      {
        SETOR: "Produção",
        "CÓD FUNÇÃO": "FUN-002",
        "FUNÇÃO": "Líder de Produção",
        "CÓD EPI": "EPI-002",
        QTD: 2,
        "VALIDADE (MESES)": 6,
      },
    ]);

    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 28 },
      { wch: 18 },
      { wch: 10 },
      { wch: 20 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "template_epi_por_funcao.xlsx");
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawHeaderRow = (XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 })[0] ?? []).map((value) =>
        String(value ?? "").trim(),
      );

      if (!rawHeaderRow.length) {
        toast.error("Planilha vazia ou sem cabeçalho.");
        return;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!rows.length) {
        toast.error("Planilha sem dados.");
        return;
      }

      const headerMap = {
        sector: findHeader(rawHeaderRow, ["setor", "nome setor"]),
        jobFunctionCode: findHeader(rawHeaderRow, ["cód função", "cod funcao", "código função", "codigo funcao", "cód func", "cod func"]),
        jobFunction: findHeader(rawHeaderRow, ["função", "funcao", "nome função", "nome funcao"]),
        epiCode: findHeader(rawHeaderRow, ["cód epi", "cod epi", "código epi", "codigo epi", "epi"]),
        quantity: findHeader(rawHeaderRow, ["qtd", "quantidade", "qtde"]),
        validityMonths: findHeader(rawHeaderRow, ["validade (meses)", "validade meses", "validade", "meses", "validade m"]),
      };

      const missingHeaders = Object.entries(headerMap)
        .filter(([, value]) => !value)
        .map(([key]) => {
          switch (key) {
            case "sector":
              return "SETOR";
            case "jobFunctionCode":
              return "CÓD FUNÇÃO";
            case "jobFunction":
              return "FUNÇÃO";
            case "epiCode":
              return "CÓD EPI";
            case "quantity":
              return "QTD";
            default:
              return "VALIDADE (MESES)";
          }
        });

      if (missingHeaders.length > 0) {
        toast.error(`Colunas obrigatórias não encontradas: ${missingHeaders.join(", ")}.`);
        return;
      }

      const sectorMap = new Map(sectors.map((sector) => [normalize(sector.name), sector.id]));
      const jobFunctionMap = new Map<string, JobFunctionOption[]>();
      const jobFunctionByCode = new Map<string, JobFunctionOption[]>();
      // EPI: agrupar por código normalizado para detectar duplicatas
      const epiByCode = new Map<string, EpiOption[]>();
      epis.forEach((epi) => {
        const key = normalize(epi.code);
        const arr = epiByCode.get(key) ?? [];
        arr.push(epi);
        epiByCode.set(key, arr);
      });
      const existingKeys = new Set(
        associations.map((association) => `${association.sector_id}|${association.job_function_id}|${association.epi_id}`),
      );

      jobFunctions.forEach((jobFunction) => {
        const nameKey = normalize(jobFunction.name);
        const nameArr = jobFunctionMap.get(nameKey) ?? [];
        nameArr.push(jobFunction);
        jobFunctionMap.set(nameKey, nameArr);

        const codeKey = normalize(jobFunction.code);
        const codeArr = jobFunctionByCode.get(codeKey) ?? [];
        codeArr.push(jobFunction);
        jobFunctionByCode.set(codeKey, codeArr);
      });

      const nonEmptyRows = rows.filter((row) =>
        Object.values(row).some((value) => String(value ?? "").trim() !== ""),
      );

      const firstPass = nonEmptyRows.map((row, index) => {
        const parsedRow: ParsedAssociationRow = {
          row: index + 2,
          sector: String(row[headerMap.sector!] ?? "").trim(),
          jobFunctionCode: String(row[headerMap.jobFunctionCode!] ?? "").trim(),
          jobFunction: String(row[headerMap.jobFunction!] ?? "").trim(),
          epiCode: String(row[headerMap.epiCode!] ?? "").trim(),
          quantity: parsePositiveInteger(row[headerMap.quantity!]),
          validityMonths: parsePositiveInteger(row[headerMap.validityMonths!]),
          errors: [],
        };

        if (!parsedRow.sector) parsedRow.errors.push("Setor obrigatório");
        if (!parsedRow.jobFunctionCode) parsedRow.errors.push("Cód. Função obrigatório");
        if (!parsedRow.jobFunction) parsedRow.errors.push("Função obrigatória");
        if (!parsedRow.epiCode) parsedRow.errors.push("Cód. EPI obrigatório");
        if (parsedRow.quantity === null) parsedRow.errors.push("Quantidade inválida");
        if (parsedRow.validityMonths === null) parsedRow.errors.push("Validade inválida");

        const sectorId = parsedRow.sector ? sectorMap.get(normalize(parsedRow.sector)) : undefined;
        if (parsedRow.sector && !sectorId) {
          parsedRow.errors.push(`Setor \"${parsedRow.sector}\" não cadastrado`);
        } else {
          parsedRow.sectorId = sectorId;
        }

        const matchingFunctionsByCode = parsedRow.jobFunctionCode
          ? jobFunctionByCode.get(normalize(parsedRow.jobFunctionCode)) ?? []
          : [];

        if (parsedRow.jobFunctionCode) {
          if (matchingFunctionsByCode.length === 0) {
            parsedRow.errors.push(`Função com código \"${parsedRow.jobFunctionCode}\" não cadastrada`);
          } else if (sectorId) {
            const functionsInSector = matchingFunctionsByCode.filter(
              (jobFunction) => jobFunction.sector_id === sectorId,
            );
            if (functionsInSector.length === 0) {
              parsedRow.errors.push(`A função de código \"${parsedRow.jobFunctionCode}\" não pertence ao setor informado`);
            } else {
              parsedRow.jobFunctionId = functionsInSector[0].id;
              
              // Opcional: Validar se o nome também bate (aproximadamente)
              if (parsedRow.jobFunction && normalize(functionsInSector[0].name) !== normalize(parsedRow.jobFunction)) {
                // Não bloqueia, mas avisa ou apenas usa o ID do código
              }
            }
          }
        } else if (parsedRow.jobFunction) {
          // Fallback para nome se o código não for informado (embora tenhamos validado que é obrigatório acima)
          const matchingFunctions = jobFunctionMap.get(normalize(parsedRow.jobFunction)) ?? [];
          if (matchingFunctions.length === 0) {
            parsedRow.errors.push(`Função \"${parsedRow.jobFunction}\" não cadastrada`);
          } else if (sectorId) {
            const functionsInSector = matchingFunctions.filter(
              (jobFunction) => jobFunction.sector_id === sectorId,
            );
            if (functionsInSector.length === 0) {
              parsedRow.errors.push(`Função \"${parsedRow.jobFunction}\" não pertence ao setor informado`);
            } else if (functionsInSector.length > 1) {
              const variantes = functionsInSector.map((f) => `"${f.name}"`).join(" e ");
              parsedRow.errors.push(
                `Função duplicada no cadastro: ${variantes}. Mescle antes de importar (menu "Funções Duplicadas").`,
              );
            } else {
              parsedRow.jobFunctionId = functionsInSector[0].id;
            }
          }
        }

        const epiCandidates = parsedRow.epiCode ? epiByCode.get(normalize(parsedRow.epiCode)) ?? [] : [];
        if (parsedRow.epiCode) {
          if (epiCandidates.length === 0) {
            parsedRow.errors.push(`EPI \"${parsedRow.epiCode}\" não cadastrado`);
          } else if (epiCandidates.length > 1) {
            parsedRow.errors.push(
              `EPI com código \"${parsedRow.epiCode}\" está duplicado no cadastro. Mescle antes de importar (menu "EPIs Duplicados").`,
            );
          } else {
            parsedRow.epiId = epiCandidates[0].id;
          }
        }

        if (parsedRow.sectorId && parsedRow.jobFunctionId && parsedRow.epiId) {
          const associationKey = `${parsedRow.sectorId}|${parsedRow.jobFunctionId}|${parsedRow.epiId}`;
          if (existingKeys.has(associationKey)) {
            parsedRow.errors.push("Associação já cadastrada no sistema");
          }
        }

        return parsedRow;
      });

      const seenKeys = new Set<string>();
      firstPass.forEach((row) => {
        if (!row.sectorId || !row.jobFunctionId || !row.epiId) return;
        const key = `${row.sectorId}|${row.jobFunctionId}|${row.epiId}`;
        if (seenKeys.has(key)) {
          row.errors.push("Associação duplicada na planilha");
        } else {
          seenKeys.add(key);
        }
      });

      setParsedRows(firstPass);
      setDialogOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao ler a planilha.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!importableRows.length || blockingErrorRows.length > 0) return;

    setImporting(true);
    try {
      const payload = importableRows.map((row) => ({
        organization_id: organizationId,
        sector_id: row.sectorId!,
        job_function_id: row.jobFunctionId!,
        epi_id: row.epiId!,
        quantity: row.quantity!,
        validity_months: row.validityMonths!,
      }));

      const { error } = await supabase.from("sector_function_epis").insert(payload);
      if (error) throw error;

      const skippedCount = skippedRows.length;
      const msg = skippedCount > 0
        ? `${payload.length} associação(ões) importada(s). ${skippedCount} já cadastrada(s) ignorada(s).`
        : `${payload.length} associação(ões) importada(s) com sucesso.`;
      toast.success(msg);
      onImportComplete();
      resetState();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erro ao importar planilha.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx"
        className="hidden"
        onChange={handleFileChange}
      />

      <Button variant="outline" onClick={downloadTemplate}>
        <Download className="mr-2 h-4 w-4" />
        Baixar Template
      </Button>

      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <Upload className="mr-2 h-4 w-4" />
        Importar Planilha
      </Button>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && !importing && resetState()}>
        <DialogContent className="max-w-5xl h-[85vh] !flex !flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar EPI por Função
            </DialogTitle>
            <DialogDescription>
              {parsedRows.length} linha(s) encontrada(s).
              {importableRows.length > 0 && (
                <span className="ml-2 text-primary">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                  {importableRows.length} válida(s)
                </span>
              )}
              {skippedRows.length > 0 && (
                <span className="ml-2 text-yellow-600">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  {skippedRows.length} já cadastrada(s)
                </span>
              )}
              {blockingErrorRows.length > 0 && (
                <span className="ml-2 text-destructive">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  {blockingErrorRows.length} com erro(s)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border p-3 text-sm">
            A importação ignora registros já cadastrados. Só é bloqueada quando há setor, função ou EPI inexistente.
          </div>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full w-full">
              <div className="pr-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Linha</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Cód. Função</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Cód. EPI</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row) => (
                      <TableRow key={row.row} className={row.errors.length > 0 ? "bg-destructive/5" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{row.row}</TableCell>
                        <TableCell className="text-sm">{row.sector || "—"}</TableCell>
                        <TableCell className="text-sm font-mono text-xs">{row.jobFunctionCode || "—"}</TableCell>
                        <TableCell className="text-sm">{row.jobFunction || "—"}</TableCell>
                        <TableCell className="text-sm font-mono text-xs">{row.epiCode || "—"}</TableCell>
                        <TableCell className="text-sm">{row.quantity ?? "—"}</TableCell>
                        <TableCell className="text-sm">{row.validityMonths ?? "—"}</TableCell>
                        <TableCell>
                          {row.errors.length === 0 ? (
                            <Badge variant="default" className="text-xs">
                              OK
                            </Badge>
                          ) : (
                            <div className="space-y-1">
                              {row.errors.map((error, index) => (
                                <Badge
                                  key={`${row.row}-${index}`}
                                  variant={NON_BLOCKING_ERRORS.includes(error) ? "secondary" : "destructive"}
                                  className={`block w-fit text-xs ${NON_BLOCKING_ERRORS.includes(error) ? "bg-yellow-100 text-yellow-800 border-yellow-300" : ""}`}
                                >
                                  {error}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            {errorRows.length > 0 && (
              <Button variant="outline" onClick={generateInconsistenciesPdf} className="mr-auto">
                <FileText className="mr-2 h-4 w-4" />
                Baixar PDF de Inconsistências
              </Button>
            )}
            <Button variant="outline" onClick={resetState} disabled={importing}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importing || !importableRows.length || blockingErrorRows.length > 0}>
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                `Importar ${importableRows.length} associação(ões)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}