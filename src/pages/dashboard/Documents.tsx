import { useState, useEffect, useRef } from "react";
import { useGEDSettings } from "@/hooks/useGEDSettings";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { formatBrazilianNumber } from "@/utils/formatters";
import {
  Select,

  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSearchParams } from "react-router-dom";
import { useGED } from "@/hooks/useGED";
import { useAuth } from "@/hooks/useAuth";
import { UsageIndicator } from "@/components/dashboard/UsageIndicator";
import { GedTreeView } from "@/components/dashboard/ged/GedTreeView";
import { useOrganizationStructure } from "@/hooks/useOrganizationStructure";
import { useQuery } from "@tanstack/react-query";
import { useDocumentPermissions } from "@/hooks/useDocumentPermissions";
import { supabase } from "@/integrations/supabase/client";
import { MultiFileUploader } from "@/components/dashboard/ged/MultiFileUploader";
import { Files, AlertCircle } from "lucide-react";
import { 
  FileText, 
  Upload, 
  Search, 
  Filter, 
  MoreVertical, 
  Star, 
  Folder, 
  Plus,
  LayoutGrid,
  List,
  ChevronRight,
  Download,
  Eye,
  Trash2,
  History,
  FileCode,
  FileSpreadsheet,
  FileImage,
  Loader2,
  X,
  Tag as TagIcon,
  ChevronLeft
} from "lucide-react";
import { CustomFieldsForm } from "@/components/dashboard/ged/CustomFieldsForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "@/components/SortableTableHead";
import { useTableSort } from "@/hooks/useTableSort";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function getFileTypeLabel(mime?: string, name?: string): string {
  const ext = (name?.split(".").pop() || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf") || ext === "pdf") return "PDF";
  if (m.includes("wordprocessingml") || m.includes("msword") || ["doc", "docx"].includes(ext)) return "WORD";
  if (m.includes("spreadsheetml") || m.includes("excel") || ["xls", "xlsx", "csv"].includes(ext)) return "EXCEL";
  if (m.includes("presentationml") || m.includes("powerpoint") || ["ppt", "pptx"].includes(ext)) return "PPT";
  if (m.includes("image/")) {
    if (m.includes("jpeg") || ext === "jpg" || ext === "jpeg") return "JPG";
    if (m.includes("png") || ext === "png") return "PNG";
    if (m.includes("gif") || ext === "gif") return "GIF";
    return "IMG";
  }
  if (m.includes("zip") || ["zip", "rar", "7z"].includes(ext)) return "ZIP";
  if (m.includes("text/") || ["txt", "md"].includes(ext)) return "TXT";
  if (ext) return ext.toUpperCase();
  return "ARQUIVO";
}


function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

function TagsInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const addTag = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t) return;
    if (value.some(v => v.toLowerCase() === t.toLowerCase())) return;
    if (value.length >= 20) return;
    onChange([...value, t]);
  };
  const removeTag = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
      {value.map((tag, i) => (
        <Badge key={`${tag}-${i}`} variant="secondary" className="gap-1 pl-2 pr-1 font-normal">
          {tag}
          <button
            type="button"
            aria-label={`Remover tag ${tag}`}
            className="rounded-sm opacity-60 hover:opacity-100"
            onClick={() => removeTag(i)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(draft);
            setDraft("");
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            removeTag(value.length - 1);
          }
        }}
        onBlur={() => {
          if (draft.trim()) {
            addTag(draft);
            setDraft("");
          }
        }}
        placeholder={value.length === 0 ? "Digite e pressione Enter para adicionar..." : ""}
        className="flex-1 min-w-[140px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        maxLength={40}
      />
    </div>
  );
}





const SIGILO_DESCRIPTIONS: Record<string, string> = {
  PUBLICO: "Documento visível para todos os usuários da organização.",
  INTERNO: "Acesso limitado a colaboradores da organização, sem permissões especiais.",
  RESTRITO: "Requer permissão de acesso à pasta ou perfil específico para visualização.",
  CONFIDENCIAL: "Acesso restrito a gestores e usuários com permissão explícita.",
  SIGILOSO: "Nível máximo de segurança. Acesso monitorado e restrito a administradores ou perfis de alta confiança.",
};

export default function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<any | null>(null);
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({});
  const [uploadData, setUploadData] = useState({
    title: "",
    document_type_id: "",
    page_count: 1,
    description: "",
    expiration_date: "",
    document_creation_date: "",
    tags: [] as string[],
    sigilo: "PUBLICO" as any,
  });
  const [editData, setEditData] = useState({
    title: "",
    document_type_id: "",
    page_count: 1,
    description: "",
    expiration_date: "",
    document_creation_date: "",
    tags: [] as string[],
    sigilo: "PUBLICO" as any,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { 
    documents, 
    folders: allFolders, 
    isLoading, 
    searchTerm, 
    setSearchTerm,
    selectedTags,
    setSelectedTags,
    status,
    setStatus,
    uploadDocument,
    uploadDocuments,
    isUploading,
    deleteDocument,
    toggleFavorite,
    getDownloadUrl,
    updateDocument,
    isUpdatingDoc,
    totalCount,
    page,
    setPage,
    pageSize,
    setPageSize
  } = useGED(currentFolder, false, false, searchParams.get("status"));
  const isSearching = (searchTerm ?? "").trim().length > 0;
  const isFiltering = isSearching || selectedTags.length > 0;
  // Hide folder rows while searching/filtering so results are documents-only across all folders
  const folders = isFiltering ? [] : allFolders;

  const { documentTypes } = useGEDSettings();
  const { organization, user, isSuperAdmin, isOrgAdmin } = useAuth();
  const { moveItem } = useOrganizationStructure();
  const { canUserDownload, canUserDelete, canUserEdit } = useDocumentPermissions();




  // Enriquece documentos com rótulo de tipo de arquivo p/ ordenação
  const enrichedDocuments = (documents || []).map((d: any) => ({
    ...d,
    file_type_label: getFileTypeLabel(d.mime_type, d.file_name),
  }));
  const { sortedItems: sortedDocuments, sortField, sortDirection, handleSort } = useTableSort(enrichedDocuments);

  const { data: totalDocuments = 0 } = useQuery({
    queryKey: ["ged-documents-total", organization?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ged_documents")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization!.id)
        .neq("status", "deleted");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!organization?.id,
  });

  // Tags disponíveis na organização para uso no filtro
  const { data: availableTags = [] } = useQuery({
    queryKey: ["ged-tags", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ged_documents")
        .select("tags")
        .eq("organization_id", organization!.id)
        .neq("status", "deleted");
      if (error) throw error;
      const set = new Set<string>();
      (data || []).forEach((row: any) => {
        (row.tags || []).forEach((t: string) => {
          if (typeof t === "string" && t.trim()) set.add(t.trim());
        });
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
    enabled: !!organization?.id,
  });

  
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "new") {
      setIsUploadOpen(true);
      // Limpar o param para não reabrir ao dar refresh ou navegar
      searchParams.delete("action");
      setSearchParams(searchParams);
    } else if (action === "search") {
      searchInputRef.current?.focus();
      searchParams.delete("action");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const getFileIcon = (mime: string) => {
    if (mime?.includes("pdf")) return <FileText className="h-6 w-6 text-red-500" />;
    if (mime?.includes("spreadsheet") || mime?.includes("excel")) return <FileSpreadsheet className="h-6 w-6 text-green-600" />;
    if (mime?.includes("image")) return <FileImage className="h-6 w-6 text-blue-500" />;
    return <FileCode className="h-6 w-6 text-gray-500" />;
  };

  const handleViewFile = async (documentId: string) => {
    try {
      const { url } = await getDownloadUrl(documentId);
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
          description: "Você não tem permissão para visualizar este documento devido ao nível de sigilo ou restrições de pasta.",
          duration: 5000,
        });
      } else {
        toast.error(error?.message || "Erro ao visualizar arquivo.");
      }
    }
  };

  const handleDownloadFile = async (doc: any) => {
    try {
      const { url, fileName } = await getDownloadUrl(doc.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || doc.file_name || doc.title;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error("Erro ao baixar arquivo:", error);
      const isPermissionError = 
        error?.message?.includes("JWT") || 
        error?.code === "PGRST301" || 
        error?.message?.includes("permission denied") ||
        error?.status === 403;

      if (isPermissionError) {
        toast.error("Acesso Negado", {
          description: "Seu perfil não possui permissão para baixar este documento.",
          duration: 5000,
        });
      } else {
        toast.error(error?.message || "Erro ao baixar arquivo.");
      }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
      {/* Header Profissional */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Documentos</h1>
          <div className="flex items-center flex-wrap text-sm text-muted-foreground mt-1">
            <span
              className="hover:text-primary cursor-pointer"
              onClick={() => { setCurrentFolder(null); setFolderPath([]); }}
            >
              Nexo GED
            </span>
            {folderPath.map((f, idx) => (
              <span key={f.id} className="flex items-center">
                <ChevronRight className="h-4 w-4 mx-1" />
                <span
                  className={idx === folderPath.length - 1 ? "font-medium text-foreground" : "hover:text-primary cursor-pointer"}
                  onClick={() => {
                    if (idx === folderPath.length - 1) return;
                    const newPath = folderPath.slice(0, idx + 1);
                    setFolderPath(newPath);
                    setCurrentFolder(newPath[newPath.length - 1].id);
                  }}
                >
                  {f.name}
                </span>
              </span>
            ))}
            {folderPath.length === 0 && (
              <>
                <ChevronRight className="h-4 w-4 mx-1" />
                <span className="font-medium text-foreground">Explorar</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {folderPath.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newPath = folderPath.slice(0, -1);
                setFolderPath(newPath);
                setCurrentFolder(newPath.length ? newPath[newPath.length - 1].id : null);
              }}
            >
              ← Voltar
            </Button>
          )}
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <History className="mr-2 h-4 w-4" /> Histórico
          </Button>
          <Button size="sm" onClick={() => setIsUploadOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Documentos</CardTitle>
            <Files className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(totalCount ?? 0).toLocaleString()}
              <span className="text-base font-normal text-muted-foreground"> / {totalDocuments.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {currentFolder
                ? `Nesta pasta · ${totalDocuments.toLocaleString()} no total da organização`
                : "Documentos na raiz · total da organização"}
            </p>
          </CardContent>
        </Card>
        <div className="md:col-span-2">
          <UsageIndicator />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
        {/* Sidebar Structure */}
        <aside className="w-full lg:w-72 flex-shrink-0 bg-card border rounded-lg p-4 h-full overflow-y-auto hidden lg:block">
          <GedTreeView 
            currentFolderId={currentFolder} 
            onSelectFolder={(id, name, path) => {
              setCurrentFolder(id);
              // O path vindo do TreeView já inclui a hierarquia de pastas
              setFolderPath(path);
            }} 
          />
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Toolbar com Filtros */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-3 rounded-lg border shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                ref={searchInputRef}
                placeholder="Pesquisar em documentos, tags, conteúdos..." 
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-auto">
                <TabsList className="h-9">
                  <TabsTrigger value="list" className="h-7 px-3"><List className="h-4 w-4" /></TabsTrigger>
                  <TabsTrigger value="grid" className="h-7 px-3"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
                </TabsList>
              </Tabs>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Filter className="mr-2 h-4 w-4" /> Filtros
                    {selectedTags.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                        {selectedTags.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-0">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TagIcon className="h-4 w-4" /> Filtrar por tag
                    </div>
                    {selectedTags.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setSelectedTags([])}
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="max-h-64">
                    <div className="p-2">
                      {availableTags.length === 0 ? (
                        <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma tag cadastrada ainda.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {availableTags.map((tag) => {
                            const active = selectedTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  setSelectedTags(
                                    active
                                      ? selectedTags.filter((t) => t !== tag)
                                      : [...selectedTags, tag]
                                  );
                                }}
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                                  active
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-input bg-background hover:bg-accent"
                                )}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </div>

            {/* Filtros Ativos */}
            {(status || searchTerm || selectedTags.length > 0) && (
              <div className="flex flex-wrap gap-2 items-center bg-muted/30 p-2 rounded-md border border-dashed w-full">
                <span className="text-xs text-muted-foreground font-medium">Filtros ativos:</span>
                {status === 'expired' && (
                  <Badge variant="destructive" className="gap-1 pr-1 cursor-pointer" onClick={() => {
                    setStatus(null);
                    const newParams = new URLSearchParams(searchParams);
                    newParams.delete("status");
                    setSearchParams(newParams);
                  }}>
                    Vencidos <X className="h-3 w-3" />
                  </Badge>
                )}
                {status === 'near_expiry' && (
                  <Badge variant="outline" className="gap-1 pr-1 bg-amber-500/10 text-amber-600 border-amber-500/20 cursor-pointer" onClick={() => {
                    setStatus(null);
                    const newParams = new URLSearchParams(searchParams);
                    newParams.delete("status");
                    setSearchParams(newParams);
                  }}>
                    A Vencer <X className="h-3 w-3" />
                  </Badge>
                )}
                {status === 'pending' && (
                  <Badge variant="outline" className="gap-1 pr-1 bg-orange-500/10 text-orange-600 border-orange-500/20 cursor-pointer" onClick={() => {
                    setStatus(null);
                    const newParams = new URLSearchParams(searchParams);
                    newParams.delete("status");
                    setSearchParams(newParams);
                  }}>
                    Pendentes <X className="h-3 w-3" />
                  </Badge>
                )}
                {searchTerm && (
                  <Badge variant="secondary" className="gap-1 pr-1 cursor-pointer" onClick={() => setSearchTerm("")}>
                    Busca: {searchTerm} <X className="h-3 w-3" />
                  </Badge>
                )}
                {selectedTags.map(tag => (
                   <Badge key={tag} variant="secondary" className="gap-1 pr-1 cursor-pointer" onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}>
                    Tag: {tag} <X className="h-3 w-3" />
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 ml-auto" onClick={() => {
                  setStatus(null);
                  setSearchTerm("");
                  setSelectedTags([]);
                  setSearchParams({});
                }}>
                  Limpar Tudo
                </Button>
              </div>
            )}

      {/* Breadcrumbs da pasta selecionada */}
      <div className="flex items-center justify-between gap-2 px-1 py-2 border-b">
        <div className="flex items-center flex-wrap text-sm text-muted-foreground min-w-0">
          <button
            type="button"
            className={`hover:text-primary ${folderPath.length === 0 ? "font-medium text-foreground" : ""}`}
            onClick={() => { setCurrentFolder(null); setFolderPath([]); }}
          >
            Todas as pastas
          </button>
          {folderPath.map((f, idx) => (
            <span key={f.id} className="flex items-center min-w-0">
              <ChevronRight className="h-4 w-4 mx-1 flex-shrink-0" />
              <button
                type="button"
                className={`truncate ${idx === folderPath.length - 1 ? "font-medium text-foreground" : "hover:text-primary"}`}
                onClick={() => {
                  if (idx === folderPath.length - 1) return;
                  const newPath = folderPath.slice(0, idx + 1);
                  setFolderPath(newPath);
                  setCurrentFolder(newPath[newPath.length - 1].id);
                }}
              >
                {f.name}
              </button>
            </span>
          ))}
          <Badge variant="secondary" className="ml-2 font-normal">
            {(currentFolder ? (totalCount ?? 0) : totalDocuments).toLocaleString()} {(currentFolder ? (totalCount ?? 0) : totalDocuments) === 1 ? "documento" : "documentos"}
          </Badge>
        </div>
        {folderPath.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-shrink-0"
            onClick={() => { setCurrentFolder(null); setFolderPath([]); }}
          >
            ← Todas as pastas
          </Button>
        )}
      </div>

      {/* Grid de Pastas/Documentos */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : viewMode === "list" ? (
          <>
            {documents.length === 0 && folders.length === 0 ? (
              <div className="py-20 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">Nenhum documento encontrado nesta pasta.</p>
                <Button variant="link" onClick={() => setIsUploadOpen(true)}>Fazer meu primeiro upload</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Arquivo</TableHead>
                    <SortableTableHead field="title" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                      Título
                    </SortableTableHead>
                    <SortableTableHead field="file_type_label" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                      Tipo
                    </SortableTableHead>
                    <SortableTableHead field="document_type_data.name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                      Tipo Documento
                    </SortableTableHead>
                    <SortableTableHead field="created_at" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                      Criado em
                    </SortableTableHead>
                    <SortableTableHead field="creator_name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                      Por
                    </SortableTableHead>
                    <SortableTableHead field="file_size" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                      Tamanho
                    </SortableTableHead>
                    <TableHead>Sigilo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Pastas */}
                  {folders.map((folder) => (
                    <TableRow
                      key={folder.past_id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => {
                        setCurrentFolder(folder.past_id);
                        setFolderPath([...folderPath, { id: folder.past_id, name: folder.past_nm_pasta }]);
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-primary/10'); }}
                      onDragLeave={(e) => e.currentTarget.classList.remove('bg-primary/10')}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('bg-primary/10');
                        const id = e.dataTransfer.getData('id');
                        const type = e.dataTransfer.getData('type');
                        if (type !== 'DOCUMENT' || !id) return;
                        moveItem({ type: 'DOCUMENT', id, targetId: folder.past_id });
                      }}
                    >
                      <TableCell><Folder className="h-6 w-6 text-amber-500 fill-amber-500/20" /></TableCell>
                      <TableCell className="font-medium">{folder.past_nm_pasta}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">PASTA</Badge></TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell className="text-muted-foreground">Pasta de arquivos</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}

                  {/* Documentos */}
                  {sortedDocuments.map((doc: any) => (
                    <TableRow
                      key={doc.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("id", doc.id);
                        e.dataTransfer.setData("type", "DOCUMENT");
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="cursor-grab active:cursor-grabbing group"
                    >
                      <TableCell>{getFileIcon(doc.mime_type)}</TableCell>
                      <TableCell className="font-medium max-w-[220px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{doc.title}</span>
                          {doc.is_favorite && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />}
                          {doc.custom_field_values?.length > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertCircle className="h-3 w-3 text-primary flex-shrink-0 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="p-3">
                                  <p className="text-xs font-bold mb-2 uppercase border-b pb-1">Campos Adicionais</p>
                                  <div className="space-y-1.5">
                                    {doc.custom_field_values.map((cv: any) => (
                                      <div key={cv.id} className="text-[10px]">
                                        <span className="font-semibold">{cv.field_data?.name || 'Campo'}: </span>
                                        <span className="text-muted-foreground">
                                          {cv.field_data?.field_type === 'decimal' 
                                            ? formatBrazilianNumber(cv.value) 
                                            : (cv.value || '—')}
                                        </span>
                                      </div>
                                    ))}

                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-mono">{doc.file_type_label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {doc.document_type_data?.name || doc.document_type || "Geral"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {doc.creator_name || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {typeof doc.file_size === 'number'
                          ? (doc.file_size < 1024 * 1024
                              ? `${(doc.file_size / 1024).toFixed(1)} KB`
                              : `${(doc.file_size / (1024 * 1024)).toFixed(2)} MB`)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant={doc.sigilo === 'PUBLICO' ? 'secondary' : 'destructive'} 
                                className="text-[9px] px-1.5 py-0 cursor-help"
                              >
                                {doc.sigilo}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[200px] text-xs">
                              {SIGILO_DESCRIPTIONS[doc.sigilo] || "Nível de acesso definido para este documento."}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[240px]">
                        <span className="truncate block">{doc.description || "—"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            disabled={!doc.has_file}
                            onClick={() => handleViewFile(doc.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {canUserDownload(doc) && (
                                <DropdownMenuItem className="gap-2" disabled={!doc.has_file} onClick={() => handleDownloadFile(doc)}>
                                  <Download className="h-4 w-4" /> Baixar
                                </DropdownMenuItem>
                              )}
                               {canUserEdit(doc) && (
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => {
                                    setDocumentToEdit(doc);
                                    setEditData({
                                      title: doc.title || "",
                                      document_type_id: doc.document_type_id || "",
                                      page_count: doc.page_count || 1,
                                      description: doc.description || "",
                                      expiration_date: doc.expiration_date || "",
                                      document_creation_date: doc.document_creation_date || "",
                                      tags: Array.isArray(doc.tags) ? doc.tags : [],
                                      sigilo: doc.sigilo || "PUBLICO",
                                    });
                                    const cfMap: Record<string, any> = {};
                                    (doc.custom_field_values || []).forEach((cv: any) => {
                                      if (cv.custom_field_id) {
                                        cfMap[cv.custom_field_id] = cv.field_data?.field_type === 'decimal' 
                                          ? formatBrazilianNumber(cv.value) 
                                          : cv.value;
                                      }
                                    });
                                    setEditCustomFields(cfMap);

                                  }}
                                >
                                  <FileCode className="h-4 w-4" /> Editar Dados
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="gap-2" onClick={() => toggleFavorite({ id: doc.id, isFavorite: !doc.is_favorite })}>
                                <Star className={`h-4 w-4 ${doc.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                {doc.is_favorite ? 'Remover Favorito' : 'Favoritar'}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2"><History className="h-4 w-4" /> Versões</DropdownMenuItem>
                               {canUserDelete(doc) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setDocumentToDelete(doc.id)}>
                                    <Trash2 className="h-4 w-4" /> Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Render Pastas */}
            {folders.map((folder) => (
              <Card 
                key={folder.past_id} 
                className="cursor-pointer transition-all hover:bg-accent/50 group"
                onClick={() => {
                  setCurrentFolder(folder.past_id);
                  setFolderPath([...folderPath, { id: folder.past_id, name: folder.past_nm_pasta }]);
                }}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2','ring-primary'); }}
                onDragLeave={(e) => e.currentTarget.classList.remove('ring-2','ring-primary')}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('ring-2','ring-primary');
                  const id = e.dataTransfer.getData('id');
                  const type = e.dataTransfer.getData('type');
                  if (type !== 'DOCUMENT' || !id) return;
                  moveItem({ type: 'DOCUMENT', id, targetId: folder.past_id });
                }}
              >
                <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                  <Folder className="h-8 w-8 text-amber-500 fill-amber-500/20" />
                  <p className="font-medium text-sm truncate max-w-[150px]">{folder.past_nm_pasta}</p>
                </CardContent>
              </Card>
            ))}

            {documents.length === 0 && folders.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">Nenhum documento encontrado nesta pasta.</p>
                <Button variant="link" onClick={() => setIsUploadOpen(true)}>Fazer meu primeiro upload</Button>
              </div>
            )}

            {documents.map((doc: any) => (
              <Card
                key={doc.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("id", doc.id);
                  e.dataTransfer.setData("type", "DOCUMENT");
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="transition-all hover:bg-accent/50 group cursor-grab active:cursor-grabbing"
              >
                <CardContent className="p-4 flex flex-col items-center gap-3 text-center h-full justify-between">
                  <div className="flex flex-col items-center gap-2">
                    {getFileIcon(doc.mime_type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{doc.title}</p>
                        {doc.is_favorite && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                      </div>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] h-4 py-0 font-mono">
                          {getFileTypeLabel(doc.mime_type, doc.file_name)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-4 py-0 font-normal">
                          {doc.document_type_data?.name || doc.document_type || "Geral"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <span className="text-[10px] text-muted-foreground">{new Date(doc.updated_at).toLocaleDateString()}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant={doc.sigilo === 'PUBLICO' ? 'secondary' : 'destructive'} 
                                className="text-[9px] h-4 py-0 px-1 cursor-help"
                              >
                                {doc.sigilo}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[200px] text-xs">
                              {SIGILO_DESCRIPTIONS[doc.sigilo] || "Nível de acesso definido."}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground group-hover:text-primary"
                      disabled={!doc.has_file}
                      onClick={() => handleViewFile(doc.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {canUserDownload(doc) && (
                          <DropdownMenuItem className="gap-2" disabled={!doc.has_file} onClick={() => handleDownloadFile(doc)}>
                            <Download className="h-4 w-4" /> Baixar
                          </DropdownMenuItem>
                         )}
                         {canUserEdit(doc) && (
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => {
                              setDocumentToEdit(doc);
                              setEditData({
                                title: doc.title || "",
                                document_type_id: doc.document_type_id || "",
                                page_count: doc.page_count || 1,
                                description: doc.description || "",
                                expiration_date: doc.expiration_date || "",
                                document_creation_date: doc.document_creation_date || "",
                                tags: Array.isArray(doc.tags) ? doc.tags : [],
                                sigilo: doc.sigilo || "PUBLICO",
                              });
                              const cfMap: Record<string, any> = {};
                              (doc.custom_field_values || []).forEach((cv: any) => {
                                if (cv.custom_field_id) {
                                  cfMap[cv.custom_field_id] = cv.field_data?.field_type === 'decimal' 
                                    ? formatBrazilianNumber(cv.value) 
                                    : cv.value;
                                }
                              });
                              setEditCustomFields(cfMap);

                            }}
                          >
                            <FileCode className="h-4 w-4" /> Editar Dados
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="gap-2" onClick={() => toggleFavorite({ id: doc.id, isFavorite: !doc.is_favorite })}>
                          <Star className={`h-4 w-4 ${doc.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                          {doc.is_favorite ? 'Remover Favorito' : 'Favoritar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2"><History className="h-4 w-4" /> Versões</DropdownMenuItem>
                        {canUserDelete(doc) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setDocumentToDelete(doc.id)}>
                              <Trash2 className="h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Paginação */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t p-4 bg-muted/20 gap-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              Mostrando <span className="font-medium">{Math.min(totalCount, page * pageSize + 1)}</span> a{" "}
              <span className="font-medium">{Math.min(totalCount, (page + 1) * pageSize)}</span> de{" "}
              <span className="font-medium">{totalCount}</span> documentos
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Itens por página:</span>
              <Select 
                value={pageSize.toString()} 
                onValueChange={(val) => {
                  setPageSize(parseInt(val));
                  setPage(0); // Volta para a primeira página ao mudar o tamanho
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize.toString()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="h-8 gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.ceil(totalCount / pageSize) }).map((_, i) => {
                // Lógica simples para não mostrar muitas páginas se houver centenas
                const totalPages = Math.ceil(totalCount / pageSize);
                if (
                  i === 0 || 
                  i === totalPages - 1 || 
                  (i >= page - 1 && i <= page + 1)
                ) {
                  return (
                    <Button
                      key={i}
                      variant={page === i ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(i)}
                      className="h-8 w-8 p-0"
                    >
                      {i + 1}
                    </Button>
                  );
                } else if (
                  (i === 1 && page > 2) || 
                  (i === totalPages - 2 && page < totalPages - 3)
                ) {
                  return <span key={i} className="px-1 text-muted-foreground">...</span>;
                }
                return null;
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * pageSize >= totalCount}
              className="h-8 gap-1"
            >
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  </div>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={!!documentToDelete} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O documento será marcado como excluído e não aparecerá mais na sua listagem ativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (documentToDelete) {
                  deleteDocument(documentToDelete);
                  setDocumentToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Upload (Simplificado para o Protótipo) */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Upload de Documentos</DialogTitle>
            <DialogDescription>
              Arraste múltiplos arquivos ou selecione do seu computador. {currentFolder ? "" : <span className="text-destructive font-bold">Aviso: Selecione uma pasta no menu lateral antes do upload.</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Badge variant="outline" className="h-5 w-5 rounded-full p-0 flex items-center justify-center">1</Badge>
                Metadados Padrão (Opcional)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-border/50">
                <div className="grid gap-2">
                  <Label htmlFor="type">Tipo Documental</Label>
                  <Select 
                    value={uploadData.document_type_id} 
                    onValueChange={(val) => setUploadData({ ...uploadData, document_type_id: val })}
                  >
                    <SelectTrigger id="type" className="bg-background">
                      <SelectValue placeholder="Selecione um tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Nível de Sigilo</Label>
                  <Select
                    value={uploadData.sigilo}
                    onValueChange={(value) => setUploadData({ ...uploadData, sigilo: value as any })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLICO">Público</SelectItem>
                      <SelectItem value="INTERNO">Interno</SelectItem>
                      <SelectItem value="RESTRITO">Restrito</SelectItem>
                      <SelectItem value="CONFIDENCIAL">Confidencial</SelectItem>
                      <SelectItem value="SIGILOSO">Sigiloso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2 grid gap-2">
                  <Label>Tags Padrão</Label>
                  <TagsInput
                    value={uploadData.tags}
                    onChange={(next) => setUploadData({ ...uploadData, tags: next })}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Badge variant="outline" className="h-5 w-5 rounded-full p-0 flex items-center justify-center">2</Badge>
                Arquivos
              </h3>
              <MultiFileUploader 
                isUploading={isUploading}
                requiresCreationDate={!!(uploadData.document_type_id && documentTypes.find(t => t.id === uploadData.document_type_id)?.requires_creation_date)}
                requiresExpirationDate={!!(uploadData.document_type_id && documentTypes.find(t => t.id === uploadData.document_type_id)?.requires_expiration_date)}
                associatedFields={uploadData.document_type_id ? documentTypes.find(t => t.id === uploadData.document_type_id)?.associated_fields : []}
                onUpload={async (items) => {
                  if (!currentFolder || !organization?.id) {
                    toast.error("Pasta ou organização não selecionada.");
                    return;
                  }

                  const uploadItems = items.map(item => ({
                    doc: {
                      title: item.file.name.split('.').slice(0, -1).join('.') || item.file.name,
                      document_type_id: uploadData.document_type_id || null,
                      expiration_date: item.expirationDate || null,
                      document_creation_date: item.creationDate || null,
                      page_count: 1, // Will be auto-calculated in useGED mutation
                      description: item.description || uploadData.description || null,
                      organization_id: organization.id,
                      folder_id: currentFolder,
                      past_id: currentFolder,
                      status: 'active',
                      tags: uploadData.tags,
                      keywords: [],
                      sigilo: uploadData.sigilo,
                    },
                    file: item.file,
                    customFields: item.customFields
                  }));

                  await uploadDocuments(uploadItems);
                }}
              />
            </section>
          </div>

          <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={!!documentToEdit} onOpenChange={(open) => { if (!open) { setDocumentToEdit(null); setEditCustomFields({}); } }}>
        <DialogContent className="sm:max-w-[720px] max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Dados do Documento</DialogTitle>
            <DialogDescription>
              Atualize as informações metadados do documento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Título do Documento</Label>
              <Input 
                id="edit-title" 
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-type">Tipo Documental</Label>
                <Select 
                  value={editData.document_type_id} 
                  onValueChange={(val) => setEditData({ ...editData, document_type_id: val })}
                >
                  <SelectTrigger id="edit-type">
                    <SelectValue placeholder="Selecione um tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
              </Select>
            </div>

            {editData.document_type_id && documentTypes.find(t => t.id === editData.document_type_id)?.associated_fields?.length > 0 && (
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-2 block uppercase text-muted-foreground">Campos Personalizados</Label>
                <CustomFieldsForm 
                  fields={documentTypes.find(t => t.id === editData.document_type_id)?.associated_fields || []}
                  values={editCustomFields}
                  onChange={(fieldId, value) => setEditCustomFields(prev => ({ ...prev, [fieldId]: value }))}
                />
              </div>
            )}

            <div className="grid gap-2">
                <Label htmlFor="edit-pages">Número de Páginas</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="edit-pages" 
                    type="number" 
                    min={1} 
                    value={editData.page_count}
                    readOnly
                    disabled 

                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        O número de páginas é calculado automaticamente durante o upload.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            {/* Campos Condicionais baseados no tipo (Edição) */}
            {editData.document_type_id && (() => {
              const selectedType = documentTypes.find(t => t.id === editData.document_type_id);
              if (!selectedType) return null;
              return (
                <div className="grid grid-cols-2 gap-4">
                  {selectedType.requires_creation_date && (
                    <div className="grid gap-2">
                      <Label>Data de Criação</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !editData.document_creation_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editData.document_creation_date ? format(new Date(editData.document_creation_date), "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={editData.document_creation_date ? new Date(editData.document_creation_date) : undefined}
                            onSelect={(date) => setEditData({ ...editData, document_creation_date: date ? date.toISOString() : "" })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                  {selectedType.requires_expiration_date && (
                    <div className="grid gap-2">
                      <Label>Data de Vencimento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !editData.expiration_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editData.expiration_date ? format(new Date(editData.expiration_date), "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={editData.expiration_date ? new Date(editData.expiration_date) : undefined}
                            onSelect={(date) => setEditData({ ...editData, expiration_date: date ? date.toISOString() : "" })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Input 
                id="edit-description" 
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Nível de Sigilo</Label>
              <Select
                value={editData.sigilo}
                onValueChange={(value) => setEditData({ ...editData, sigilo: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLICO">Público</SelectItem>
                  <SelectItem value="INTERNO">Interno</SelectItem>
                  <SelectItem value="RESTRITO">Restrito</SelectItem>
                  <SelectItem value="CONFIDENCIAL">Confidencial</SelectItem>
                  <SelectItem value="SIGILOSO">Sigiloso</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-sm border border-border/50">
                {SIGILO_DESCRIPTIONS[editData.sigilo] || "Define quem pode visualizar e baixar o documento."}
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Tags</Label>
              <TagsInput
                value={editData.tags}
                onChange={(next) => setEditData({ ...editData, tags: next })}
              />
              <p className="text-xs text-muted-foreground">
                Use tags para encontrar o arquivo na busca e em filtros.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentToEdit(null)}>Cancelar</Button>
            <Button 
              onClick={() => {
                if (!editData.title) {
                  toast.error("O título é obrigatório.");
                  return;
                }
                updateDocument({
                  id: documentToEdit.id,
                  updates: {
                    ...editData,
                    document_creation_date: editData.document_creation_date || null,
                    expiration_date: editData.expiration_date || null,
                  } as any,
                  customFields: editCustomFields
                }, {
                  onSuccess: () => setDocumentToEdit(null)
                });
              }} 
              disabled={isUpdatingDoc}
            >
              {isUpdatingDoc ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

