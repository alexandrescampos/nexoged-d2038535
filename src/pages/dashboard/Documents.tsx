import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useGED } from "@/hooks/useGED";
import { useAuth } from "@/hooks/useAuth";
import { UsageIndicator } from "@/components/dashboard/UsageIndicator";
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
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { toast } from "sonner";

export default function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState({
    title: "",
    document_type: "",
    page_count: 1
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { 
    documents, 
    folders, 
    isLoading, 
    searchTerm, 
    setSearchTerm,
    uploadDocument,
    isUploading,
    deleteDocument,
    toggleFavorite,
    getDownloadUrl
  } = useGED(currentFolder);
  const { organization } = useAuth();
  
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
      toast.error(error?.message || "Erro ao visualizar arquivo.");
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
      toast.error(error?.message || "Erro ao baixar arquivo.");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
      {/* Header Profissional */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Documentos</h1>
          <div className="flex items-center text-sm text-muted-foreground mt-1">
            <span className="hover:text-primary cursor-pointer" onClick={() => setCurrentFolder(null)}>Nexo GED</span>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="font-medium text-foreground">Explorar</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <History className="mr-2 h-4 w-4" /> Histórico
          </Button>
          <Button size="sm" onClick={() => setIsUploadOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        </div>
      </div>

      <UsageIndicator />

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
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="mr-2 h-4 w-4" /> Filtros
          </Button>
        </div>
      </div>

      {/* Grid de Pastas/Documentos */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" : "space-y-1"}>
            {/* Render Pastas */}
            {folders.map((folder) => (
              <Card 
                key={folder.id} 
                className={`cursor-pointer transition-all hover:bg-accent/50 group ${viewMode === 'list' ? 'border-none shadow-none bg-transparent rounded-md' : ''}`}
                onClick={() => setCurrentFolder(folder.id)}
              >
                <CardContent className={viewMode === 'list' ? 'p-2 flex items-center gap-3' : 'p-4 flex flex-col items-center gap-2 text-center'}>
                  <Folder className="h-8 w-8 text-amber-500 fill-amber-500/20" />
                  <div className={viewMode === 'list' ? 'flex-1' : ''}>
                    <p className="font-medium text-sm truncate max-w-[150px]">{folder.name}</p>
                    {viewMode === 'list' && <p className="text-xs text-muted-foreground">Pasta de arquivos</p>}
                  </div>
                  {viewMode === 'list' && <MoreVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />}
                </CardContent>
              </Card>
            ))}

            {/* Render Documentos */}
            {documents.length === 0 && folders.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">Nenhum documento encontrado nesta pasta.</p>
                <Button variant="link" onClick={() => setIsUploadOpen(true)}>Fazer meu primeiro upload</Button>
              </div>
            )}

            {documents.map((doc) => (
              <Card 
                key={doc.id} 
                className={`transition-all hover:bg-accent/50 group ${viewMode === 'list' ? 'border-none shadow-none bg-transparent rounded-md border-b' : ''}`}
              >
                <CardContent className={viewMode === 'list' ? 'p-3 flex items-center gap-4' : 'p-4 flex flex-col items-center gap-3 text-center h-full justify-between'}>
                  <div className={viewMode === 'list' ? 'flex items-center gap-4 flex-1 min-w-0' : 'flex flex-col items-center gap-2'}>
                    {getFileIcon(doc.mime_type)}
                    <div className={viewMode === 'list' ? 'flex-1 min-w-0' : ''}>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{doc.title}</p>
                        {doc.is_favorite && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] h-4 py-0 font-normal">{doc.document_type || "Geral"}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(doc.updated_at).toLocaleDateString()}</span>
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
                        <DropdownMenuItem 
                          className="gap-2"
                          disabled={!doc.has_file}
                          onClick={() => handleDownloadFile(doc)}
                        >
                          <Download className="h-4 w-4" /> Baixar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2"><Star className="h-4 w-4" /> {doc.is_favorite ? 'Remover Favorito' : 'Favoritar'}</DropdownMenuItem>
                        <DropdownMenuItem className="gap-2"><History className="h-4 w-4" /> Versões</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="gap-2 text-destructive"
                          onClick={() => setDocumentToDelete(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload de Documento</DialogTitle>
            <DialogDescription>
              Selecione um arquivo para subir para {currentFolder ? 'esta pasta' : 'a raiz'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Título do Documento</Label>
              <Input 
                id="title" 
                placeholder="Ex: Contrato_Fornecedor_A" 
                value={uploadData.title}
                onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Tipo Documental</Label>
                <Input 
                  id="type" 
                  placeholder="Ex: Jurídico..." 
                  value={uploadData.document_type}
                  onChange={(e) => setUploadData({ ...uploadData, document_type: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pages">Número de Páginas</Label>
                <Input 
                  id="pages" 
                  type="number" 
                  min={1} 
                  value={uploadData.page_count}
                  onChange={(e) => setUploadData({ ...uploadData, page_count: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div 
              className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Input
                type="file"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <Upload className="h-10 w-10 text-muted-foreground mb-4 opacity-30" />
              <p className="text-sm font-medium">
                {selectedFile ? selectedFile.name : "Arraste e solte ou clique para selecionar"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, PNG, JPG (Max 50MB)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsUploadOpen(false);
              setSelectedFile(null);
            }}>Cancelar</Button>
            <Button onClick={() => {
              if (!uploadData.title || !selectedFile) {
                toast.error("Por favor, preencha o título e selecione um arquivo.");
                return;
              }
              
              if (!organization?.id) {
                toast.error("Organização não identificada. Por favor, recarregue a página.");
                return;
              }

              uploadDocument({
                doc: {
                  title: uploadData.title,
                  document_type: uploadData.document_type,
                  page_count: uploadData.page_count,
                  organization_id: organization.id,
                  folder_id: currentFolder,
                  status: 'active',
                  tags: [],
                  keywords: []
                },
                file: selectedFile
              }, {
                onSuccess: () => {
                  setIsUploadOpen(false);
                  setUploadData({ title: "", document_type: "", page_count: 1 });
                  setSelectedFile(null);
                }
              });
            }} disabled={isUploading || !selectedFile || !uploadData.title}>
              {isUploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              {isUploading ? "Enviando..." : "Enviar Documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
