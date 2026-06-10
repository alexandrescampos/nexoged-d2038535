import { useState, useRef } from "react";
import { useGEDSettings } from "@/hooks/useGEDSettings";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGED } from "@/hooks/useGED";
import { useDocumentPermissions } from "@/hooks/useDocumentPermissions";
import { 

  FileText, 
  Search, 
  Filter, 
  MoreVertical, 
  Star,
  Clock, 
  LayoutGrid,
  List,
  ChevronRight,
  Download,
  Eye,
  Trash2,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export default function RecentPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<any | null>(null);
  const [editData, setEditData] = useState({
    title: "",
    document_type_id: "",
    page_count: 1,
    description: "",
    expiration_date: "",
    document_creation_date: ""
  });
  
  const { 
    documents, 
    isLoading, 
    searchTerm, 
    setSearchTerm,
    deleteDocument,
    toggleFavorite,
    getDownloadUrl,
    updateDocument,
    isUpdatingDoc
  } = useGED(null, false, true); // null for folderId, false for filterFavorites, true for filterRecent

  const { canUserDownload } = useDocumentPermissions();


  const { documentTypes } = useGEDSettings();

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Últimos Acessos</h1>
          <div className="flex items-center text-sm text-muted-foreground mt-1">
            <span>Nexo GED</span>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="font-medium text-foreground">Últimos Acessos</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-3 rounded-lg border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Pesquisar nos acessos recentes..." 
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

      {/* List/Grid */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" : "space-y-1"}>
            {documents.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">Você ainda não acessou nenhum documento.</p>
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
                        <Badge variant="outline" className="text-[10px] h-4 py-0 font-normal">
                          {doc.document_type_data?.name || doc.document_type || "Geral"}
                        </Badge>
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
                        {canUserDownload(doc) && (
                          <DropdownMenuItem 
                            className="gap-2"
                            disabled={!doc.has_file}
                            onClick={() => handleDownloadFile(doc)}
                          >
                            <Download className="h-4 w-4" /> Baixar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="gap-2"
                          onClick={() => toggleFavorite({ id: doc.id, isFavorite: !doc.is_favorite })}
                        >
                          <Star className={`h-4 w-4 ${doc.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} /> 
                          {doc.is_favorite ? 'Remover Favorito' : 'Favoritar'}
                        </DropdownMenuItem>
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

      {/* Delete Confirmation */}
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
    </div>
  );
}