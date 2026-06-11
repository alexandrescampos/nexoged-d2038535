import React, { useState, useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2, FileImage, FileSpreadsheet, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

interface FileWithProgress {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface MultiFileUploaderProps {
  onUpload: (files: File[]) => Promise<void>;
  isUploading: boolean;
  maxSize?: number; // in MB
  acceptedFileTypes?: Record<string, string[]>;
}

export function MultiFileUploader({ 
  onUpload, 
  isUploading, 
  maxSize = 50,
  acceptedFileTypes = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'text/plain': ['.txt']
  }
}: MultiFileUploaderProps) {
  const [files, setFiles] = useState<FileWithProgress[]>([]);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      progress: 0,
      status: 'pending' as const
    }));

    setFiles(prev => [...prev, ...newFiles]);

    if (fileRejections.length > 0) {
      fileRejections.forEach(({ file, errors }) => {
        const errorMsgs = errors.map(e => {
          if (e.code === 'file-too-large') return `Arquivo muito grande (máx ${maxSize}MB)`;
          if (e.code === 'file-invalid-type') return 'Tipo de arquivo não suportado';
          return e.message;
        }).join(', ');
        toast.error(`Erro no arquivo ${file.name}: ${errorMsgs}`);
      });
    }
  }, [maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: maxSize * 1024 * 1024,
    accept: acceptedFileTypes
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    // Pass only files that are not already completed or uploading
    const filesToUpload = files
      .filter(f => f.status === 'pending' || f.status === 'error')
      .map(f => f.file);
    
    if (filesToUpload.length === 0) return;

    try {
      // We handle the status update here while the parent handles the actual upload logic
      setFiles(prev => prev.map(f => 
        (f.status === 'pending' || f.status === 'error') 
          ? { ...f, status: 'uploading' } 
          : f
      ));

      await onUpload(filesToUpload);
      
      // Update all to completed on success (simplified since we don't have per-file progress callback from parent yet)
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { ...f, status: 'completed', progress: 100 } : f
      ));
      
      toast.success(`${filesToUpload.length} arquivo(s) enviados com sucesso!`);
    } catch (error: any) {
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { ...f, status: 'error', error: error.message } : f
      ));
      toast.error('Erro ao enviar um ou mais arquivos.');
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    if (type.includes('image')) return <FileImage className="h-8 w-8 text-blue-500" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
    return <FileCode className="h-8 w-8 text-gray-500" />;
  };

  return (
    <div className="space-y-4">
      <div 
        {...getRootProps()} 
        className={cn(
          "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer",
          isDragActive ? "border-primary bg-primary/5 scale-[0.99]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
          isUploading && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <input {...getInputProps()} />
        <div className="bg-primary/10 p-4 rounded-full mb-4">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <p className="text-sm font-semibold text-center">
          {isDragActive ? "Solte os arquivos aqui" : "Arraste e solte ou clique para selecionar arquivos"}
        </p>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          PDF, DOCX, XLSX, JPG, PNG (Máx {maxSize}MB por arquivo)
        </p>
      </div>

      {files.length > 0 && (
        <Card className="overflow-hidden border-muted-foreground/20">
          <ScrollArea className="max-h-[300px]">
            <div className="p-4 space-y-3">
              {files.map((fileData) => (
                <div 
                  key={fileData.id} 
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors group"
                >
                  <div className="flex-shrink-0">
                    {getFileIcon(fileData.file.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate pr-4">
                        {fileData.file.name}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    
                    {fileData.status === 'uploading' && (
                      <div className="space-y-1">
                        <Progress value={fileData.progress} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground animate-pulse">Enviando...</p>
                      </div>
                    )}

                    {fileData.status === 'completed' && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="text-[10px] font-medium">Concluído</span>
                      </div>
                    )}

                    {fileData.status === 'error' && (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span className="text-[10px] font-medium">Erro: {fileData.error || 'Falha no upload'}</span>
                      </div>
                    )}

                    {fileData.status === 'pending' && (
                      <span className="text-[10px] text-muted-foreground">Aguardando início...</span>
                    )}
                  </div>
                  
                  {fileData.status !== 'uploading' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(fileData.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {fileData.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <div className="p-4 bg-muted/30 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {files.filter(f => f.status === 'completed').length} de {files.length} arquivos concluídos
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setFiles([])}
                disabled={isUploading}
              >
                Limpar Tudo
              </Button>
              <Button 
                size="sm" 
                onClick={handleUpload}
                disabled={isUploading || files.every(f => f.status === 'completed')}
              >
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isUploading ? "Enviando..." : "Iniciar Upload"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
