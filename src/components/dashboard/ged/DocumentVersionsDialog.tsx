import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, RotateCcw, CheckCircle2, XCircle, History as HistoryIcon, GitCompare, Upload } from "lucide-react";
import { useDocumentVersions } from "@/hooks/useDocumentVersions";
import { documentVersionRepository, type VersionStatus } from "@/repository/documentVersionRepository";
import { diffWords } from "diff";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  documentId: string | null;
  documentTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<VersionStatus, string> = {
  RASCUNHO: "bg-muted text-muted-foreground",
  EM_REVISAO: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  APROVADA: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  ASSINADA: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ARQUIVADA: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  CANCELADA: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export function DocumentVersionsDialog({ documentId, documentTitle, open, onOpenChange }: Props) {
  const { versions, isLoading, createVersion, isCreating, restoreVersion, cancelVersion, approveVersion } =
    useDocumentVersions(documentId);

  const [tab, setTab] = useState("historico");
  const [file, setFile] = useState<File | null>(null);
  const [bumpType, setBumpType] = useState<"minor" | "major">("minor");
  const [title, setTitle] = useState("");
  const [changeDescription, setChangeDescription] = useState("");

  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const [diff, setDiff] = useState<{ value: string; added?: boolean; removed?: boolean }[] | null>(null);
  const [comparing, setComparing] = useState(false);

  const handleCreate = async () => {
    if (!file || !changeDescription.trim()) return;
    await createVersion({ bumpType, changeDescription, file, title: title || undefined });
    setFile(null);
    setTitle("");
    setChangeDescription("");
    setBumpType("minor");
    setTab("historico");
  };

  const handleDownload = async (path: string, name: string) => {
    const url = await documentVersionRepository.getDownloadUrl(path);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.click();
  };

  const handleCompare = async () => {
    if (!compareA || !compareB) return;
    setComparing(true);
    try {
      const [a, b] = await Promise.all([
        documentVersionRepository.getVersionText(compareA),
        documentVersionRepository.getVersionText(compareB),
      ]);
      setDiff(diffWords(a || "(sem texto OCR)", b || "(sem texto OCR)"));
    } finally {
      setComparing(false);
    }
  };

  const sortedVersions = useMemo(() => versions, [versions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5" /> Gestão de Versões
          </DialogTitle>
          <DialogDescription className="truncate">{documentTitle}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="nova">Nova Versão</TabsTrigger>
            <TabsTrigger value="comparar">Comparar</TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="mt-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
            ) : sortedVersions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma versão registrada ainda.
              </p>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Versão</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Autor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVersions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono font-semibold">
                          {v.version_label}
                          {v.is_restoration && (
                            <Badge variant="outline" className="ml-1 text-[10px]">restaurada</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={v.change_description}>
                          {v.title || v.change_description}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[v.status]} variant="secondary">
                            {v.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{v.creator_name || "—"}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Baixar"
                              onClick={() => handleDownload(v.file_path, v.file_name)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            {v.status === "EM_REVISAO" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-600"
                                title="Aprovar"
                                onClick={() => approveVersion(v.id)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {v.status !== "ASSINADA" && v.status !== "CANCELADA" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Restaurar como nova versão"
                                onClick={() => restoreVersion(v.id)}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {v.status !== "ASSINADA" && v.status !== "CANCELADA" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                title="Cancelar"
                                onClick={() => {
                                  const reason = window.prompt("Motivo do cancelamento (opcional):") || undefined;
                                  cancelVersion({ versionId: v.id, reason });
                                }}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="nova" className="mt-4 space-y-4">
            <div>
              <Label>Tipo de incremento</Label>
              <RadioGroup
                value={bumpType}
                onValueChange={(v) => setBumpType(v as "minor" | "major")}
                className="flex gap-6 mt-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="minor" id="bump-minor" />
                  <Label htmlFor="bump-minor" className="font-normal cursor-pointer">
                    Minor (1.0 → 1.1) — pequenas alterações
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="major" id="bump-major" />
                  <Label htmlFor="bump-major" className="font-normal cursor-pointer">
                    Major (1.x → 2.0) — alterações significativas
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="v-title">Título da versão (opcional)</Label>
              <Input id="v-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="v-desc">Descrição da alteração *</Label>
              <Textarea
                id="v-desc"
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                placeholder="O que mudou nesta versão?"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="v-file">Arquivo *</Label>
              <Input
                id="v-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-xs text-muted-foreground mt-1">
                  {file.name} — {(file.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setTab("historico")} disabled={isCreating}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={!file || !changeDescription.trim() || isCreating}>
                <Upload className="h-4 w-4" />
                {isCreating ? "Criando..." : "Criar Versão"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="comparar" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Versão A (origem)</Label>
                <Select value={compareA} onValueChange={setCompareA}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.version_label} — {v.title || v.change_description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Versão B (destino)</Label>
                <Select value={compareB} onValueChange={setCompareB}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.version_label} — {v.title || v.change_description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleCompare} disabled={!compareA || !compareB || comparing} className="gap-2">
              <GitCompare className="h-4 w-4" />
              {comparing ? "Comparando..." : "Comparar texto OCR"}
            </Button>

            {diff && (
              <ScrollArea className="max-h-[50vh] border rounded-md p-3 bg-muted/30">
                <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                  {diff.map((part, i) => (
                    <span
                      key={i}
                      className={
                        part.added
                          ? "bg-green-200/60 dark:bg-green-900/40"
                          : part.removed
                          ? "bg-red-200/60 dark:bg-red-900/40 line-through"
                          : ""
                      }
                    >
                      {part.value}
                    </span>
                  ))}
                </pre>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
