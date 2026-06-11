import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search as SearchIcon, FileText, Loader2, X, Eye } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { formatBrasiliaDate as formatDate } from "@/lib/timezone";
import { gedRepository } from "@/repository/gedRepository";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentPreview } from "@/components/dashboard/ged/DocumentPreview";



const SEARCH_STORAGE_KEY = "ged_advanced_search_state";

type SearchState = {
  query: string;
  submitted: string;
  classificacao: string;
  status: string;
  page: number;
};


type Hit = {
  documento_id: string;
  documento_nome: string;
  classificacao: string | null;
  folder_id: string | null;
  numero_pagina: number;
  trecho: string;
  rank: number;
  created_at: string;
  total_count: number;
};

// Normaliza CPF/CNPJ/valores: gera variantes com e sem máscara
function expandQuery(q: string): string {
  if (!q) return q;
  const cpfRe = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
  const cnpjRe = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
  const out = new Set<string>([q]);
  const tokens = q.match(cpfRe) || [];
  for (const t of tokens) {
    out.add(t.replace(/\D/g, ""));
    out.add(t.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"));
  }
  const ctokens = q.match(cnpjRe) || [];
  for (const t of ctokens) {
    out.add(t.replace(/\D/g, ""));
    out.add(t.replace(/\D/g, "").replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"));
  }
  return Array.from(out).join(" OR ");
}

export default function SearchPage() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [previewDoc, setPreviewDoc] = useState<{ id: string, name: string } | null>(null);

  const [state, setState] = useState<SearchState>(() => {
    const saved = localStorage.getItem(SEARCH_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {
      query: "",
      submitted: "",
      classificacao: "",
      status: "",
      page: 0,
    };
  });


  useEffect(() => {
    localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const { query, submitted, classificacao, status, page } = state;
  const pageSize = 20;

  const updateState = (updates: Partial<SearchState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };
  const handleViewFile = async (documentId: string) => {
    try {
      const { url } = await gedRepository.getDownloadUrl(documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      console.error("Erro ao visualizar arquivo:", error);
      const isPermissionError = 
        error?.message?.includes("JWT") || 
        error?.code === "PGRST301" || 
        error?.message?.includes("permission denied") ||
        error?.status === 403;

      if (isPermissionError) {
        toast.error("Acesso Negado", {
          description: "Você não tem permissão para visualizar este documento.",
        });
      } else {
        toast.error(error?.message || "Erro ao visualizar arquivo.");
      }
    }
  };


  const clearSearch = () => {
    setState({
      query: "",
      submitted: "",
      classificacao: "",
      status: "",
      page: 0,
    });
  };


  const { data, isFetching } = useQuery({
    queryKey: ["fts-search", submitted, classificacao, status, page, organization?.id],
    enabled: !!submitted,
    queryFn: async () => {
      const filters: any = {};
      if (classificacao) filters.classificacao = classificacao;
      if (status) filters.status = status;
      const { data, error } = await supabase.rpc("search_documents_fts", {
        p_query: expandQuery(submitted),
        p_filters: filters,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });
      if (error) throw error;
      // Auditoria (best-effort)
      if (organization?.id) {
        const { data: u } = await supabase.auth.getUser();
        supabase.from("documento_ocr_auditoria").insert({
          organization_id: organization.id,
          user_id: u.user?.id,
          acao: "pesquisa",
          payload: { termo: submitted, filtros: filters, total: (data as Hit[])?.[0]?.total_count ?? 0 },
        }).then(() => {});
      }
      return data as Hit[];
    },
  });

  const totalCount = data?.[0]?.total_count ?? 0;
  const totalPages = Math.ceil(Number(totalCount) / pageSize);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pesquisa Avançada</h1>
        <p className="text-muted-foreground">Localize documentos por conteúdo, página e trecho.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <SearchIcon className="w-5 h-5" /> Filtros
          </CardTitle>
          {(query || submitted || classificacao || status) && (
            <Button variant="ghost" size="sm" onClick={clearSearch} className="h-8 gap-1">
              <X className="w-4 h-4" /> Limpar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => { 
              e.preventDefault(); 
              updateState({ page: 0, submitted: query.trim() }); 
            }}
            className="flex gap-2"
          >
            <Input
              placeholder='Pesquisar palavras, frases ("entre aspas"), CPF, CNPJ, números...'
              value={query}
              onChange={(e) => updateState({ query: e.target.value })}
              className="flex-1"
            />
            <Button type="submit" disabled={!query.trim()}>
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pesquisar"}
            </Button>
          </form>


          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Classificação</label>
              <Select value={classificacao || "all"} onValueChange={(v) => updateState({ page: 0, classificacao: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="PUBLICO">Público</SelectItem>
                  <SelectItem value="INTERNO">Interno</SelectItem>
                  <SelectItem value="SIGILOSO">Sigiloso</SelectItem>
                  <SelectItem value="RESTRITO">Restrito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Status</label>
              <Select value={status || "all"} onValueChange={(v) => updateState({ page: 0, status: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {submitted && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resultados</span>
              <span className="text-sm font-normal text-muted-foreground">
                {totalCount} ocorrência(s)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isFetching ? (
              <div className="py-8 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Pesquisando...
              </div>
            ) : (data?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Nenhuma ocorrência encontrada.</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead className="w-20">Página</TableHead>
                      <TableHead>Trecho</TableHead>
                      <TableHead className="w-32">Data</TableHead>
                      <TableHead className="w-[80px] text-right">Ações</TableHead>

                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.map((h, i) => (
                      <TableRow
                        key={`${h.documento_id}-${h.numero_pagina}-${i}`}
                        className="cursor-pointer"
                        onClick={() => {
                          // Auditoria de abertura
                          if (organization?.id) {
                            supabase.auth.getUser().then(({ data: u }) => {
                              supabase.from("documento_ocr_auditoria").insert({
                                organization_id: organization.id,
                                user_id: u.user?.id,
                                documento_id: h.documento_id,
                                acao: "resultado_aberto",
                                payload: { pagina: h.numero_pagina, termo: submitted },
                              }).then(() => {});
                            });
                          }
                          navigate(`/dashboard/documents?docId=${h.documento_id}&page=${h.numero_pagina}&q=${encodeURIComponent(submitted)}`);
                        }}
                      >
                        <TableCell className="font-medium">
                          <HoverCard openDelay={500}>
                            <HoverCardTrigger asChild>
                              <div className="flex items-center gap-2 hover:underline decoration-primary decoration-2 underline-offset-4">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                {h.documento_nome}
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-[450px] p-0 shadow-2xl border-primary/20" side="right" align="start">
                               <DocumentPreview 
                                 documentId={h.documento_id} 
                                 documentName={h.documento_nome} 
                                 className="border-none shadow-none"
                               />
                            </HoverCardContent>
                          </HoverCard>
                        </TableCell>

                        <TableCell>{h.numero_pagina}</TableCell>
                        <TableCell>
                          <span
                            className="text-sm [&_mark]:bg-yellow-200 [&_mark]:text-foreground [&_mark]:px-0.5 [&_mark]:rounded"
                            dangerouslySetInnerHTML={{ __html: h.trecho || "" }}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(h.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewDoc({ id: h.documento_id, name: h.documento_nome });
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>

                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Visualizar documento</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>

                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-muted-foreground">
                      Página {page + 1} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => updateState({ page: page - 1 })}>Anterior</Button>
                      <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => updateState({ page: page + 1 })}>Próxima</Button>

                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl w-[90vw] h-[85vh] p-0 flex flex-col overflow-hidden border-primary/20 shadow-2xl">
          <DialogHeader className="p-4 border-b bg-muted/30">
            <DialogTitle className="flex items-center gap-2 text-lg truncate pr-8">
              <FileText className="h-5 w-5 text-primary" />
              {previewDoc?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewDoc && (
              <DocumentPreview 
                documentId={previewDoc.id} 
                documentName={previewDoc.name} 
                className="w-full h-full border-none rounded-none shadow-none"
                showDetails={true}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

