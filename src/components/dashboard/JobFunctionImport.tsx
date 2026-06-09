import { useRef, useState } from "react";
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
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ParsedRow {
  row: number;
  code: string;
  name: string;
  sectorName: string;
  description: string;
  active: boolean;
  errors: string[];
  warnings: string[];
  sectorId?: string;
  needsNewSector?: boolean;
  existingId?: string;
}

function parseActive(v: any): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return true;
  return ["sim", "s", "yes", "y", "true", "1", "ativa", "ativo"].includes(s);
}

export default function JobFunctionImport() {
  const { organization } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number; sectorsCreated: number } | null>(null);
  const [importErrors, setImportErrors] = useState<{ row: number; code: string; message: string }[]>([]);

  const { data: sectors } = useQuery({
    queryKey: ["sectors-import-fn", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors").select("id, name")
        .eq("organization_id", organization!.id).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const { data: existingFns } = useQuery({
    queryKey: ["job-functions-import", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_functions").select("id, code")
        .eq("organization_id", organization!.id);
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
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        if (!rows.length) { toast.error("Planilha vazia."); return; }

        const required = ["CODIGO", "NOME"];
        const headers = Object.keys(rows[0] || {}).map(h => h.toUpperCase());
        const missing = required.filter(r => !headers.includes(r));
        if (missing.length) {
          toast.error(`Colunas obrigatórias ausentes: ${missing.join(", ")}.`);
          return;
        }

        const sectorMap = new Map<string, string>();
        sectors?.forEach(s => sectorMap.set(s.name.toLowerCase().trim(), s.id));
        const codeMap = new Map<string, string>();
        existingFns?.forEach(f => codeMap.set(f.code.toLowerCase(), f.id));

        const seenCodes = new Set<string>();
        const results: ParsedRow[] = rows.map((row: any, idx: number) => {
          const code = String(row["CODIGO"] || "").trim();
          const name = String(row["NOME"] || "").trim();
          const sectorName = String(row["NOME SETOR"] || "").trim();
          const description = String(row["DESCRICAO"] || row["DESCRIÇÃO"] || "").trim();
          const active = parseActive(row["ATIVA"] ?? row["ATIVO"]);
          const errors: string[] = [];
          const warnings: string[] = [];
          let sectorId: string | undefined;
          let needsNewSector = false;

          if (!code) errors.push("Código obrigatório");
          if (!name) errors.push("Nome obrigatório");
          if (code) {
            const lower = code.toLowerCase();
            if (seenCodes.has(lower)) errors.push("Código duplicado na planilha");
            seenCodes.add(lower);
          }
          if (sectorName) {
            const sid = sectorMap.get(sectorName.toLowerCase());
            if (sid) sectorId = sid;
            else { needsNewSector = true; warnings.push(`Setor "${sectorName}" será criado`); }
          }
          const existingId = code ? codeMap.get(code.toLowerCase()) : undefined;
          if (existingId) warnings.push("Será atualizada (código já existe)");

          return { row: idx + 2, code, name, sectorName, description, active, errors, warnings, sectorId, needsNewSector, existingId };
        });

        setParsed(results);
        setResult(null);
        setImportErrors([]);
        setOpen(true);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao ler a planilha.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const validRows = parsed.filter(p => p.errors.length === 0);
  const errorRows = parsed.filter(p => p.errors.length > 0);

  const handleImport = async () => {
    if (!organization || !validRows.length) return;
    setImporting(true);
    setImportErrors([]);
    let success = 0;
    let errors = 0;
    const collected: { row: number; code: string; message: string }[] = [];

    const newSectorNames = [...new Set(validRows.filter(r => r.needsNewSector && r.sectorName).map(r => r.sectorName))];
    const createdSectors = new Map<string, string>();
    for (const name of newSectorNames) {
      try {
        const { data, error } = await supabase
          .from("sectors").insert({ name, organization_id: organization.id })
          .select("id").single();
        if (error) throw error;
        createdSectors.set(name.toLowerCase(), data.id);
      } catch (err) { console.error(`Erro setor "${name}":`, err); }
    }

    for (const row of validRows) {
      try {
        const finalSectorId = row.sectorId
          || (row.sectorName ? createdSectors.get(row.sectorName.toLowerCase()) : null)
          || null;
        const payload: any = {
          code: row.code,
          name: row.name,
          description: row.description || null,
          sector_id: finalSectorId,
          is_active: row.active,
        };
        if (row.existingId) {
          const { error } = await supabase.from("job_functions").update(payload).eq("id", row.existingId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("job_functions").insert({ ...payload, organization_id: organization.id });
          if (error) throw error;
        }
        success++;
      } catch (err: any) {
        console.error(`Erro linha ${row.row}:`, err);
        collected.push({ row: row.row, code: row.code, message: err?.message || "Erro desconhecido" });
        errors++;
      }
    }

    setResult({ success, errors, sectorsCreated: newSectorNames.length });
    setImportErrors(collected);
    setImporting(false);
    qc.invalidateQueries({ queryKey: ["job-functions"] });
    qc.invalidateQueries({ queryKey: ["sectors"] });
    if (success > 0) toast.success(`${success} função(ões) importada(s)!`);
    if (errors > 0) toast.error(`${errors} registro(s) falharam.`);
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFile} />
      <Button variant="outline" onClick={() => fileRef.current?.click()}>
        <Upload className="mr-2 h-4 w-4" /> Importar Planilha
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o && !importing) { setOpen(false); setParsed([]); } }}>
        <DialogContent className="max-w-4xl h-[85vh] !flex !flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Importar Funções
            </DialogTitle>
            <DialogDescription>
              {parsed.length} registro(s) encontrado(s).
              {validRows.length > 0 && (
                <span className="text-primary ml-2">
                  <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />{validRows.length} válido(s)
                </span>
              )}
              {errorRows.length > 0 && (
                <span className="text-destructive ml-2">
                  <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />{errorRows.length} com erro(s)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p><CheckCircle2 className="inline h-4 w-4 text-primary mr-1" /> {result.success} importada(s)</p>
              {result.sectorsCreated > 0 && <p className="text-muted-foreground">+ {result.sectorsCreated} setor(es) criado(s)</p>}
              {result.errors > 0 && <p><AlertTriangle className="inline h-4 w-4 text-destructive mr-1" /> {result.errors} falharam</p>}
            </div>
          )}

          {importErrors.length > 0 && (
            <div className="rounded-md border border-destructive/30 p-3 text-sm space-y-2">
              <p className="font-medium text-destructive">Detalhes dos erros:</p>
              <ScrollArea className="h-[20vh]">
                <div className="space-y-1 pr-4">
                  {importErrors.map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      <span className="font-mono">Linha {e.row}</span> — <span className="font-medium">{e.code}</span>: {e.message}
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
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((p) => (
                      <TableRow key={p.row} className={p.errors.length > 0 ? "bg-destructive/5" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{p.row}</TableCell>
                        <TableCell className="text-xs font-mono">{p.code || "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{p.name || "—"}</TableCell>
                        <TableCell className="text-xs">{p.sectorName || "—"}</TableCell>
                        <TableCell>
                          {p.errors.length === 0 && p.warnings.length === 0 ? (
                            <Badge variant="default" className="text-xs">OK</Badge>
                          ) : (
                            <div className="space-y-1">
                              {p.errors.map((err, i) => (
                                <Badge key={`e${i}`} variant="destructive" className="text-xs block w-fit">{err}</Badge>
                              ))}
                              {p.warnings.map((w, i) => (
                                <Badge key={`w${i}`} variant="outline" className="text-xs block w-fit text-amber-600 border-amber-400">{w}</Badge>
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
            <Button variant="outline" onClick={() => { setOpen(false); setParsed([]); }} disabled={importing}>
              {result ? "Fechar" : "Cancelar"}
            </Button>
            {!result && (
              <Button onClick={handleImport} disabled={importing || validRows.length === 0}>
                {importing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</>) : `Importar ${validRows.length} função(ões)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
