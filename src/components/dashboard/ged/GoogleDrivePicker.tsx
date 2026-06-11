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
      const queryParams = new URLSearchParams(
        searchQuery 
          ? { action: 'search', query: searchQuery }
          : { action: 'list', folderId }
      ).toString();

      const { data, error } = await supabase.functions.invoke(`google-drive-integration?${queryParams}`, {
        method: 'GET'
      });

      if (error) {
        const msg = (error as any).message || '';
        const ctx = (error as any).context;
        // 409 NOT_CONNECTED handling
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
      fetchFiles(currentFolder);
    }
  }, [isOpen]);

  const handleFolderClick = (folderId: string) => {
    setHistory(prev => [...prev, currentFolder]);
    setCurrentFolder(folderId);
    fetchFiles(folderId);
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
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" className="h-5 w-5" alt="Drive" />
            Google Drive
          </DialogTitle>
          <DialogDescription>
            Selecione arquivos do seu Google Drive para importar para o GED.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
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

        <div className="flex items-center gap-2 mb-2">
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 px-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {currentFolder === 'root' ? 'Meu Drive' : 'Pasta atual'}
          </span>
        </div>

        <ScrollArea className="flex-1 min-h-[300px] border rounded-md">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[300px] gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando arquivos...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <p className="text-sm">Nenhum arquivo encontrado.</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {files.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer transition-colors group"
                  onClick={() => isFolder(file.mimeType) ? handleFolderClick(file.id) : null}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isFolder(file.mimeType) ? (
                      <Folder className="h-5 w-5 text-blue-500 fill-blue-500/20" />
                    ) : (
                      <File className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{file.name}</span>
                      {file.size && (
                        <span className="text-[10px] text-muted-foreground">
                          {(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isFolder(file.mimeType) ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
