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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MAX_BATCH = 100;

export function GoogleDrivePicker({ isOpen, onOpenChange, onFileSelect }: GoogleDrivePickerProps) {
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string>('root');
  const [history, setHistory] = useState<string[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const fetchFiles = async (folderId: string = 'root', searchQuery: string = '') => {
    setLoading(true);
    setSelectedIds(new Set());
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

  const isFolder = (mimeType: string) => mimeType === FOLDER_MIME;

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleFileIds = files.filter(f => !isFolder(f.mimeType)).map(f => f.id);
  const allFilesSelected = visibleFileIds.length > 0 && visibleFileIds.every(id => selectedIds.has(id));

  const toggleSelectAllFiles = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilesSelected) visibleFileIds.forEach(id => next.delete(id));
      else visibleFileIds.forEach(id => next.add(id));
      return next;
    });
  };

  /** Downloads a single Drive file and returns it as a browser File. */
  const fetchDriveFile = async (driveFile: GoogleDriveFile): Promise<File> => {
    const { data, error } = await supabase.functions.invoke(
      `google-drive-integration?action=download&fileId=${driveFile.id}`,
      { method: 'GET' }
    );
    if (error) throw error;
    const blob = data as Blob;
    return new (window as any).File([blob], driveFile.name, { type: driveFile.mimeType }) as File;
  };

  const downloadFile = async (driveFile: GoogleDriveFile) => {
    if (downloadingIds.has(driveFile.id)) return;
    setDownloadingIds(prev => new Set(prev).add(driveFile.id));
    try {
      const file = await fetchDriveFile(driveFile);
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

  /** Expands selected folders into their files via the edge function. */
  const expandFolder = async (folderId: string): Promise<{ files: GoogleDriveFile[]; truncated: boolean }> => {
    const qs = new URLSearchParams({
      action: 'folder-files',
      folderId,
      recursive: String(includeSubfolders),
      maxFiles: String(MAX_BATCH),
    }).toString();
    const { data, error } = await supabase.functions.invoke(`google-drive-integration?${qs}`, { method: 'GET' });
    if (error) throw error;
    return { files: (data?.files || []) as GoogleDriveFile[], truncated: !!data?.truncated };
  };

  const handleImportSelected = async () => {
    if (selectedIds.size === 0 || importing) return;
    setImporting(true);
    setProgress({ done: 0, total: 0 });

    try {
      const selected = files.filter(f => selectedIds.has(f.id));
      const targets: GoogleDriveFile[] = [];
      const seen = new Set<string>();
      let truncated = false;

      for (const item of selected) {
        if (isFolder(item.mimeType)) {
          const res = await expandFolder(item.id);
          truncated = truncated || res.truncated;
          for (const f of res.files) {
            if (!seen.has(f.id)) { seen.add(f.id); targets.push(f); }
          }
        } else if (!seen.has(item.id)) {
          seen.add(item.id);
          targets.push(item);
        }
      }

      if (targets.length === 0) {
        toast.info('Nenhum arquivo encontrado na seleção.');
        return;
      }

      if (targets.length > MAX_BATCH) {
        truncated = true;
        targets.length = MAX_BATCH;
      }

      setProgress({ done: 0, total: targets.length });

      const downloaded: File[] = [];
      let failures = 0;
      const CONCURRENCY = 3;
      let cursor = 0;

      const worker = async () => {
        while (cursor < targets.length) {
          const index = cursor++;
          const target = targets[index];
          try {
            downloaded.push(await fetchDriveFile(target));
          } catch (err) {
            console.error('Falha ao baixar', target.name, err);
            failures++;
          } finally {
            setProgress(p => ({ ...p, done: p.done + 1 }));
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

      if (downloaded.length > 0) {
        onFileSelect(downloaded);
        toast.success(`${downloaded.length} arquivo(s) importado(s) do Google Drive.`);
      }
      if (failures > 0) toast.error(`${failures} arquivo(s) falharam na importação.`);
      if (truncated) toast.warning(`Limite de ${MAX_BATCH} arquivos por importação atingido.`);

      setSelectedIds(new Set());
    } catch (error: any) {
      console.error('Erro na importação em massa:', error);
      toast.error('Erro ao importar arquivos do Google Drive');
    } finally {
      setImporting(false);
      setProgress({ done: 0, total: 0 });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[850px] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" className="h-6 w-6" alt="Drive" />
            Google Drive
          </DialogTitle>
          <DialogDescription>
            Selecione arquivos ou pastas inteiras do seu Google Drive para importar para o GED.
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

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
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

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="gd-select-all"
                  checked={allFilesSelected}
                  onCheckedChange={toggleSelectAllFiles}
                  disabled={visibleFileIds.length === 0 || importing}
                />
                <Label htmlFor="gd-select-all" className="text-sm cursor-pointer">
                  Selecionar todos
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="gd-subfolders"
                  checked={includeSubfolders}
                  onCheckedChange={setIncludeSubfolders}
                  disabled={importing}
                />
                <Label htmlFor="gd-subfolders" className="text-sm cursor-pointer">
                  Incluir subpastas
                </Label>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 border-y bg-muted/30">
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
                  className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent hover:border-accent transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Checkbox
                      checked={selectedIds.has(file.id)}
                      onCheckedChange={() => toggleSelection(file.id)}
                      disabled={importing}
                      aria-label={`Selecionar ${file.name}`}
                    />
                    <div
                      className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                      onClick={() => isFolder(file.mimeType) ? handleFolderClick(file.id) : toggleSelection(file.id)}
                    >
                      <div className="flex-shrink-0">
                        {isFolder(file.mimeType) ? (
                          <Folder className="h-6 w-6 text-primary" />
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
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {isFolder(file.mimeType) ? (
                      <ChevronRight
                        className="h-5 w-5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors cursor-pointer"
                        onClick={() => handleFolderClick(file.id)}
                      />
                    ) : (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-9 w-9 bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFile(file);
                        }}
                        disabled={downloadingIds.has(file.id) || importing}
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

        <DialogFooter className="p-6 pt-4 border-t flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="w-full sm:flex-1">
            {importing && progress.total > 0 ? (
              <div className="space-y-1">
                <Progress value={(progress.done / progress.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Baixando {progress.done} de {progress.total}...
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {selectedIds.size > 0 ? `${selectedIds.size} item(ns) selecionado(s)` : 'Nenhum item selecionado'}
              </p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
              Fechar
            </Button>
            <Button onClick={handleImportSelected} disabled={selectedIds.size === 0 || importing}>
              {importing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
              ) : (
                <>Importar selecionados ({selectedIds.size})</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
