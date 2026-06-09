import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, Download } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ParsedEmployee {
  row: number;
  nome: string;
  cpf: string;
  matricula: string;
  ctps: string;
  dataAdmissao: string;
  dataDesligamento: string;
  nomeSetor: string;
  codigoFuncao: string;
  nomeFuncao: string;
  cnpj: string;
  errors: string[];
  warnings: string[];
  cnpjId?: string;
  sectorId?: string;
  functionId?: string;
  needsNewSector?: boolean;
}

interface EmployeeImportProps {
  onImportComplete: () => void;
  currentCount: number;
  maxUsers: number | null;
}

function cleanCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function parseExcelDate(value: any): string {
  if (!value) return "";
  // If it's a number (Excel serial date)
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  // If it's a string, try to parse common formats
  const str = String(value).trim();
  // Try DD/MM/YY or D/M/YY format (Brazilian standard)
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dmyMatch) {
    let [, d, m, y] = dmyMatch;
    if (y.length === 2) y = parseInt(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

export default function EmployeeImport({ onImportComplete, currentCount, maxUsers }: EmployeeImportProps) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedEmployee[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number; sectorsCreated?: number; functionsCreated?: number } | null>(null);
  const [importErrors, setImportErrors] = useState<{ row: number; nome: string; message: string }[]>([]);

  const { data: orgCnpjs } = useQuery({
    queryKey: ["organization-cnpjs-all", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_cnpjs")
        .select("id, cnpj, company_name, is_active")
        .eq("organization_id", organization!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const { data: sectors } = useQuery({
    queryKey: ["sectors-all-import", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors").select("id, name")
        .eq("organization_id", organization!.id).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const { data: jobFunctions } = useQuery({
    queryKey: ["job-functions-all-import", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_functions").select("id, code, name, sector_id")
        .eq("organization_id", organization!.id).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

        if (!rows.length) {
          toast.error("Planilha vazia.");
          return;
        }

        // Validate required headers
        const requiredHeaders = ["NOME", "CNPJ", "CODIGO FUNCAO"];
        const expectedHeaders = ["NOME", "CPF", "MATRICULA", "CTPS", "DATA ADMISSÃO", "NOME SETOR", "CODIGO FUNCAO", "NOME FUNCAO", "CNPJ"];
        const actualHeaders = Object.keys(rows[0] || {});
        const hasHeader = (h: string) => actualHeaders.some(ah => {
          const u = ah.toUpperCase();
          if (u === h) return true;
          if (h === "DATA ADMISSÃO" && (u === "DATA ADIMISSÃO" || u === "DATA ADMISSAO")) return true;
          if (h === "CODIGO FUNCAO" && (u === "CÓDIGO FUNÇÃO" || u === "CODIGO FUNÇÃO" || u === "CÓDIGO FUNCAO")) return true;
          return false;
        });
        const missingRequired = requiredHeaders.filter(h => !hasHeader(h));
        const missingOptional = expectedHeaders.filter(h => !requiredHeaders.includes(h) && !hasHeader(h));

        if (missingRequired.length > 0) {
          toast.error(`Colunas obrigatórias não encontradas: ${missingRequired.join(", ")}. Baixe o template para ver o formato correto.`);
          return;
        }
        if (missingOptional.length > 0) {
          toast.warning(`Colunas opcionais não encontradas: ${missingOptional.join(", ")}. Os dados correspondentes serão ignorados.`);
        }

        const cnpjMap = new Map<string, { id: string; is_active: boolean }>();
        orgCnpjs?.forEach(c => cnpjMap.set(cleanCnpj(c.cnpj), { id: c.id, is_active: c.is_active }));

        const sectorMap = new Map<string, string>();
        sectors?.forEach(s => sectorMap.set(s.name.toLowerCase().trim(), s.id));

        const funcByCode = new Map<string, { id: string; name: string }>();
        jobFunctions?.forEach((f: any) => funcByCode.set(String(f.code).toLowerCase().trim(), { id: f.id, name: f.name }));

        const results: ParsedEmployee[] = rows.map((row: any, idx: number) => {
          const nome = String(row["NOME"] || "").trim();
          const cpfRaw = String(row["CPF"] || "").trim();
          const cpf = cleanCpf(cpfRaw);
          const matricula = String(row["MATRICULA"] || "").trim();
          const ctps = String(row["CTPS"] || "").trim();
          const dataAdmissao = parseExcelDate(row["DATA ADIMISSÃO"] || row["DATA ADMISSÃO"] || row["DATA ADMISSAO"] || "");
          const dataDesligamento = parseExcelDate(row["DATA DESLIGAMENTO"] || "");
          const nomeSetor = String(row["NOME SETOR"] || "").trim();
          const codigoFuncao = String(row["CODIGO FUNCAO"] || row["CÓDIGO FUNÇÃO"] || row["CODIGO FUNÇÃO"] || row["CÓDIGO FUNCAO"] || "").trim();
          const nomeFuncaoRaw = String(row["NOME FUNCAO"] || row["NOME FUNÇÃO"] || "").trim();
          const cnpjRaw = String(row["CNPJ"] || "").trim();
          const cnpjClean = cleanCnpj(cnpjRaw);

          const errors: string[] = [];
          const warnings: string[] = [];
          let cnpjId: string | undefined;
          let sectorId: string | undefined;
          let functionId: string | undefined;
          let needsNewSector = false;
          let nomeFuncao = nomeFuncaoRaw;

          if (!nome) errors.push("Nome obrigatório");

          if (!cnpjClean) {
            errors.push("CNPJ obrigatório");
          } else {
            const found = cnpjMap.get(cnpjClean);
            if (!found) errors.push(`CNPJ ${cnpjRaw} não cadastrado na organização`);
            else if (!found.is_active) errors.push(`CNPJ ${cnpjRaw} está inativo`);
            else cnpjId = found.id;
          }

          if (nomeSetor) {
            const sid = sectorMap.get(nomeSetor.toLowerCase());
            if (sid) sectorId = sid;
            else { needsNewSector = true; warnings.push(`Setor "${nomeSetor}" será criado`); }
          }

          if (!codigoFuncao) {
            errors.push("Código da função obrigatório");
          } else {
            const fData = funcByCode.get(codigoFuncao.toLowerCase());
            if (!fData) {
              errors.push(`Função com código "${codigoFuncao}" não cadastrada. Cadastre a função antes de importar.`);
            } else {
              functionId = fData.id;
              if (!nomeFuncao) nomeFuncao = fData.name;
            }
          }

          if (dataDesligamento && dataAdmissao && dataDesligamento <= dataAdmissao) {
            errors.push("Data de desligamento deve ser posterior à admissão");
          }

          return {
            row: idx + 2,
            nome, cpf, matricula, ctps, dataAdmissao, dataDesligamento,
            nomeSetor, codigoFuncao, nomeFuncao,
            cnpj: cnpjClean,
            errors, warnings,
            cnpjId, sectorId, functionId,
            needsNewSector,
          };
        });

        setParsed(results);
        setImportResult(null);
        setImportErrors([]);
        setDialogOpen(true);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao ler a planilha.");
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    if (fileRef.current) fileRef.current.value = "";
  };

  const validRows = parsed.filter(p => p.errors.length === 0);
  const errorRows = parsed.filter(p => p.errors.length > 0);

  // Count new inserts (rows without existing registration_number = new employees)
  const newInsertRows = validRows.filter(r => !r.matricula);
  const isUnlimited = maxUsers === null || maxUsers >= 999999;
  const remainingSlots = isUnlimited ? Infinity : Math.max(0, maxUsers - currentCount);
  const exceedsLimit = !isUnlimited && (currentCount + newInsertRows.length) > maxUsers;

  const handleImport = async () => {
    if (!organization || !validRows.length) return;
    setImporting(true);
    setImportErrors([]);
    let success = 0;
    let errors = 0;
    const collectedErrors: { row: number; nome: string; message: string }[] = [];

    // Auto-create missing sectors
    const newSectorNames = [...new Set(validRows.filter(r => r.needsNewSector && r.nomeSetor).map(r => r.nomeSetor))];
    const createdSectors = new Map<string, string>();
    for (const name of newSectorNames) {
      try {
        const { data, error } = await supabase
          .from("sectors")
          .insert({ name, organization_id: organization.id })
          .select("id")
          .single();
        if (error) throw error;
        createdSectors.set(name.toLowerCase(), data.id);
      } catch (err) {
        console.error(`Erro ao criar setor "${name}":`, err);
      }
    }

    for (const row of validRows) {
      try {
        const finalSectorId = row.sectorId || (row.nomeSetor ? createdSectors.get(row.nomeSetor.toLowerCase()) : null) || null;
        const finalFunctionId = row.functionId || null;

        const payload: any = {
          organization_id: organization.id,
          name: row.nome,
          cpf: row.cpf || null,
          registration_number: row.matricula || null,
          ctps_number: row.ctps || null,
           admission_date: row.dataAdmissao || null,
           termination_date: row.dataDesligamento || null,
          sector_id: finalSectorId,
          job_function_id: finalFunctionId,
          organization_cnpj_id: row.cnpjId || null,
          is_active: true,
        };

        if (row.matricula) {
          const { data: existing } = await supabase
            .from("employees")
            .select("id")
            .eq("organization_id", organization.id)
            .eq("registration_number", row.matricula)
            .maybeSingle();

          if (existing) {
            const { organization_id, ...updatePayload } = payload;
            const { error } = await supabase.from("employees").update(updatePayload).eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("employees").insert(payload);
            if (error) throw error;
          }
        } else {
          const { error } = await supabase.from("employees").insert(payload);
          if (error) throw error;
        }
        success++;
      } catch (err: any) {
        console.error(`Erro na linha ${row.row}:`, err);
        collectedErrors.push({ row: row.row, nome: row.nome || "N/A", message: err?.message || "Erro desconhecido" });
        errors++;
      }
    }

    setImportResult({ success, errors, sectorsCreated: newSectorNames.length, functionsCreated: 0 });
    setImportErrors(collectedErrors);
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    queryClient.invalidateQueries({ queryKey: ["sectors"] });
    queryClient.invalidateQueries({ queryKey: ["job-functions"] });
    if (success > 0) {
      toast.success(`${success} funcionário(s) importado(s) com sucesso!`);
      onImportComplete();
    }
    if (errors > 0) {
      toast.error(`${errors} registro(s) falharam ao importar.`);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xls,.xlsx"
        className="hidden"
        onChange={handleFile}
      />
      <Button variant="outline" onClick={() => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([
          { "NOME": "João da Silva", "CPF": "123.456.789-00", "MATRICULA": "MAT-001", "CTPS": "00001", "DATA ADMISSÃO": "13/01/2024", "DATA DESLIGAMENTO": "", "NOME SETOR": "Produção", "CODIGO FUNCAO": "FUN-0001", "NOME FUNCAO": "Operador", "CNPJ": "12.345.678/0001-90" },
        ], { header: ["NOME", "CPF", "MATRICULA", "CTPS", "DATA ADMISSÃO", "DATA DESLIGAMENTO", "NOME SETOR", "CODIGO FUNCAO", "NOME FUNCAO", "CNPJ"] });
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "template_funcionarios.xlsx");
      }}>
        <Download className="mr-2 h-4 w-4" /> Baixar Template
      </Button>
      <Button variant="outline" onClick={() => fileRef.current?.click()}>
        <Upload className="mr-2 h-4 w-4" /> Importar Planilha
      </Button>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !importing) { setDialogOpen(false); setParsed([]); } }}>
        <DialogContent className="max-w-4xl h-[85vh] !flex !flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Importar Funcionários
            </DialogTitle>
            <DialogDescription>
              {parsed.length} registro(s) encontrado(s) na planilha.
              {validRows.length > 0 && (
                <span className="text-primary ml-2">
                  <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
                  {validRows.length} válido(s)
                </span>
              )}
              {errorRows.length > 0 && (
                <span className="text-destructive ml-2">
                  <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                  {errorRows.length} com erro(s)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {exceedsLimit && !importResult && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              A importação adicionaria {newInsertRows.length} funcionário(s), mas só restam {remainingSlots} vaga(s) no plano.
            </div>
          )}

          {!isUnlimited && !importResult && !exceedsLimit && (
            <div className="text-sm text-muted-foreground">
              Vagas disponíveis: {remainingSlots} | Novos funcionários na planilha: {newInsertRows.length}
            </div>
          )}

          {importResult && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p><CheckCircle2 className="inline h-4 w-4 text-primary mr-1" /> {importResult.success} importado(s) com sucesso</p>
              {(importResult.sectorsCreated ?? 0) > 0 && (
                <p className="text-muted-foreground">+ {importResult.sectorsCreated} setor(es) criado(s)</p>
              )}
              {(importResult.functionsCreated ?? 0) > 0 && (
                <p className="text-muted-foreground">+ {importResult.functionsCreated} função(ões) criada(s)</p>
              )}
              {importResult.errors > 0 && (
                <p><AlertTriangle className="inline h-4 w-4 text-destructive mr-1" /> {importResult.errors} falharam</p>
              )}
            </div>
          )}

          {importErrors.length > 0 && (
            <div className="rounded-md border border-destructive/30 p-3 text-sm space-y-2">
              <p className="font-medium text-destructive">Detalhes dos erros:</p>
              <ScrollArea className="h-[20vh]">
                <div className="space-y-1 pr-4">
                  {importErrors.map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      <span className="font-mono">Linha {e.row}</span> — <span className="font-medium">{e.nome}</span>: {e.message}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="flex-1 min-h-0">
          <ScrollArea className="h-full w-full">
            <div className="pr-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Linha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Desligamento</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.map((p) => (
                  <TableRow key={p.row} className={p.errors.length > 0 ? "bg-destructive/5" : ""}>
                    <TableCell className="text-xs text-muted-foreground">{p.row}</TableCell>
                    <TableCell className="text-sm font-medium">{p.nome || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{p.cpf || "—"}</TableCell>
                    <TableCell className="text-xs">{p.matricula || "—"}</TableCell>
                    <TableCell className="text-xs">{p.dataDesligamento ? format(parseLocalDate(p.dataDesligamento), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="text-xs">{p.nomeSetor || "—"}</TableCell>
                    <TableCell className="text-xs"><span className="font-mono">{p.codigoFuncao || "—"}</span>{p.nomeFuncao ? <span className="ml-1 text-muted-foreground">{p.nomeFuncao}</span> : null}</TableCell>
                    <TableCell className="text-xs font-mono">{p.cnpj || "—"}</TableCell>
                    <TableCell>
                      {p.errors.length === 0 && p.warnings.length === 0 ? (
                        <Badge variant="default" className="text-xs">OK</Badge>
                      ) : (
                        <div className="space-y-1">
                          {p.errors.map((err, i) => (
                            <Badge key={`e${i}`} variant="destructive" className="text-xs block w-fit">
                              {err}
                            </Badge>
                          ))}
                          {p.warnings.map((w, i) => (
                            <Badge key={`w${i}`} variant="outline" className="text-xs block w-fit text-amber-600 border-amber-400">
                              {w}
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
            <Button variant="outline" onClick={() => { setDialogOpen(false); setParsed([]); }} disabled={importing}>
              {importResult ? "Fechar" : "Cancelar"}
            </Button>
            {!importResult && (
              <Button onClick={handleImport} disabled={importing || validRows.length === 0 || exceedsLimit}>
                {importing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</>
                ) : (
                  `Importar ${validRows.length} funcionário(s)`
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
