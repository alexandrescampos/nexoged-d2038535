import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Folder, File, ChevronRight, ChevronLeft, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  iconLink?: string;
  path?: string;
}

interface GoogleDrivePickerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFileSelect: (files: File[]) => void;
}

export function GoogleDrivePicker({ isOpen, onOpenChange, onFileSelect }: GoogleDrivePickerProps) {
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string>('root');
  const [history, setHistory] = useState<string[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const fetchFiles = async (folderId: string = 'root', searchQuery: string = '') => {
    setLoading(true);
    try {
      const params: Record<string, string> = searchQuery
        ? { action: 'search', query: searchQuery }
        : { action: 'list', folderId };
      const queryParams = new URLSearchParams(params).toString();

      const { data, error } = await supabase.functions.invoke(`google-drive-integration?${queryParams}`, {
        method: 'GET'
      });

      if (error) {
        const msg = (error as any).message || '';
        const ctx = (error as any).context;
        if (msg.includes('NOT_CONNECTED') || ctx?.status === 409) {
          toast.error('Google Drive não conectado. Peça a um administrador para conectar em Configurações → Google Drive.', { duration: 7000 });
          onOpenChange(false);
          return;
        }
        if (msg.includes('REFRESH_FAILED')) {
          toast.error('A autorização do Google expirou. Um administrador deve reconectar.', { duration: 7000 });
          onOpenChange(false);
          return;
        }
        throw error;
      }
      setFiles(data.files || []);
    } catch (error: any) {
      console.error('Error fetching files:', error);
      toast.error('Erro ao buscar arquivos do Google Drive');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles(currentFolder, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleFolderClick = (folderId: string) => {
    setHistory(prev => [...prev, currentFolder]);
    setCurrentFolder(folderId);
    fetchFiles(folderId, '');
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentFolder(previous);
    fetchFiles(previous);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFiles(undefined, search);
  };

  const downloadFile = async (driveFile: GoogleDriveFile) => {
    if (downloadingIds.has(driveFile.id)) return;
    
    setDownloadingIds(prev => new Set(prev).add(driveFile.id));
    try {
      const { data, error } = await supabase.functions.invoke(`google-drive-integration?action=download&fileId=${driveFile.id}`, {
        method: 'GET'
      });

      if (error) throw error;

      // Data is a Blob
      const blob = data as Blob;
      // Using a type assertion to bypass the typing issue with new File
      const file = new (window as any).File([blob], driveFile.name, { type: driveFile.mimeType }) as File;
      
      onFileSelect([file]);
      toast.success(`${driveFile.name} importado com sucesso!`);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast.error(`Erro ao baixar ${driveFile.name}`);
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(driveFile.id);
        return next;
      });
    }
  };

  const isFolder = (mimeType: string) => mimeType === 'application/vnd.google-apps.folder';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[800px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" className="h-6 w-6" alt="Drive" />
            Google Drive
          </DialogTitle>
          <DialogDescription>
            Selecione arquivos do seu Google Drive para importar para o GED.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input 
              placeholder="Pesquisar arquivos..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="icon" variant="secondary">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 px-2">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
              )}
              <span className="text-sm font-medium text-muted-foreground">
                {currentFolder === 'root' ? 'Meu Drive' : 'Pasta atual'}
              </span>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 border-y bg-slate-50/50 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando arquivos...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground">
              <p className="text-sm">Nenhum arquivo encontrado.</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {files.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent hover:border-accent cursor-pointer transition-all group shadow-sm"
                  onClick={() => isFolder(file.mimeType) ? handleFolderClick(file.id) : null}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {isFolder(file.mimeType) ? (
                        <Folder className="h-6 w-6 text-blue-500 fill-blue-500/20" />
                      ) : (
                        <File className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold truncate leading-none mb-1">{file.name}</span>
                      <div className="flex items-center gap-2">
                        {file.size && (
                          <span className="text-[11px] text-muted-foreground">
                            {(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB
                          </span>
                        )}
                        {file.size && <span className="text-muted-foreground/30 text-[10px]">•</span>}
                        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                          {isFolder(file.mimeType) ? 'Pasta' : file.mimeType.split('/').pop()?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {isFolder(file.mimeType) ? (
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                    ) : (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-9 w-9 bg-slate-100 hover:bg-primary hover:text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFile(file);
                        }}
                        disabled={downloadingIds.has(file.id)}
                      >
                        {downloadingIds.has(file.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="p-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}