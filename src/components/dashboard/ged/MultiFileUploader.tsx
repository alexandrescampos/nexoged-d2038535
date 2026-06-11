import React, { useState, useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2, FileImage, FileSpreadsheet, FileCode, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CustomFieldsForm } from './CustomFieldsForm';
import { CustomField } from '@/types/ged';

interface FileWithProgress {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  description: string;
  creationDate?: string;
  expirationDate?: string;
  customFields: Record<string, any>;
}

interface MultiFileUploaderProps {
  onUpload: (files: { file: File; description: string; creationDate?: string; expirationDate?: string; customFields?: Record<string, any> }[]) => Promise<void>;
  isUploading: boolean;
  maxSize?: number; // in MB
  acceptedFileTypes?: Record<string, string[]>;
  requiresCreationDate?: boolean;
  requiresExpirationDate?: boolean;
  associatedFields?: CustomField[];
}

export function MultiFileUploader({ 
  onUpload, 
  isUploading, 
  maxSize = 50,
  acceptedFileTypes = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif'],
    'image/bmp': ['.bmp'],
    'image/tiff': ['.tif', '.tiff'],
    'text/plain': ['.txt', '.log'],
    'text/csv': ['.csv'],
    'application/xml': ['.xml', '.xsd', '.xsl', '.xslt'],
    'text/xml': ['.xml']
  },
  requiresCreationDate = false,
  requiresExpirationDate = false,
  associatedFields = []
}: MultiFileUploaderProps) {
  const [files, setFiles] = useState<FileWithProgress[]>([]);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    // Extra validation before state update to ensure we don't even add non-allowed files to the list
    const validatedFiles = acceptedFiles.filter(file => {
      const mimeType = file.type;
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      
      const isMimeAllowed = Object.keys(acceptedFileTypes).includes(mimeType);
      const isExtAllowed = Object.values(acceptedFileTypes).flat().includes(extension);
      
      return isMimeAllowed || isExtAllowed;
    });

    const newFiles = validatedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      progress: 0,
      status: 'pending' as const,
      description: '',
      creationDate: undefined,
      expirationDate: undefined,
      customFields: {}
    }));

    setFiles(prev => [...prev, ...newFiles]);

    if (fileRejections.length > 0) {
      const acceptedExts = Array.from(
        new Set(Object.values(acceptedFileTypes).flat().map(e => e.replace(/^\./, '').toUpperCase()))
      ).sort().join(', ');

      fileRejections.forEach(({ file, errors }) => {
        const extMatch = file.name.match(/\.([^.]+)$/);
        const detectedExt = extMatch ? extMatch[1].toUpperCase() : 'desconhecida';
        const detectedMime = file.type || 'não identificado';

        const errorMsgs = errors.map(e => {
          if (e.code === 'file-too-large') {
            const sizeMb = (file.size / 1024 / 1024).toFixed(2);
            return `Arquivo muito grande (${sizeMb}MB). Limite: ${maxSize}MB`;
          }
          if (e.code === 'file-invalid-type') {
            return `Tipo não permitido — detectado: "${detectedMime}" (.${detectedExt.toLowerCase()}). Formatos aceitos: ${acceptedExts}`;
          }
          return e.message;
        }).join(' • ');

        toast.error(`"${file.name}" rejeitado`, {
          description: errorMsgs,
          duration: 8000,
        });
      });
    }
  }, [maxSize, acceptedFileTypes]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: maxSize * 1024 * 1024,
    accept: acceptedFileTypes,
    validator: (file) => {
      // Browser-side pre-validation using react-dropzone's validator
      const mimeType = file.type;
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      
      const isMimeAllowed = Object.keys(acceptedFileTypes).includes(mimeType);
      const isExtAllowed = Object.values(acceptedFileTypes).flat().includes(extension);

      if (!isMimeAllowed && !isExtAllowed) {
        return {
          code: "file-invalid-type",
          message: "Tipo de arquivo não permitido"
        };
      }
      return null;
    }
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileMeta = (id: string, updates: Partial<FileWithProgress>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) return;
    
    try {
      setFiles(prev => prev.map(f => 
        (f.status === 'pending' || f.status === 'error') 
          ? { ...f, status: 'uploading' } 
          : f
      ));

      await onUpload(pendingFiles.map(f => ({
        file: f.file,
        description: f.description,
        creationDate: f.creationDate,
        expirationDate: f.expirationDate,
        customFields: f.customFields
      })));
      
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { ...f, status: 'completed', progress: 100 } : f
      ));
      
      toast.success(`${pendingFiles.length} arquivo(s) enviados com sucesso!`);
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
          PDF, DOCX, XLSX/XLS, CSV, TXT, XML, JPG, PNG, WEBP, GIF, BMP, TIFF (Máx {maxSize}MB por arquivo)
        </p>
      </div>

      {files.length > 0 && (
        <Card className="overflow-hidden border-muted-foreground/20">
          <ScrollArea className="max-h-[450px]">
            <div className="p-4 space-y-4">
              {files.map((fileData) => (
                <div 
                  key={fileData.id} 
                  className="flex flex-col gap-3 p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors group"
                >
                  <div className="flex items-center gap-3">
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

                  {(fileData.status === 'pending' || fileData.status === 'error') && (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor={`desc-${fileData.id}`} className="text-xs">Descrição</Label>
                        <Input 
                          id={`desc-${fileData.id}`}
                          placeholder="Descrição breve..."
                          className="h-8 text-xs"
                          value={fileData.description}
                          onChange={(e) => updateFileMeta(fileData.id, { description: e.target.value })}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {requiresCreationDate && (
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Criação</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs justify-start px-2 font-normal">
                                  <CalendarIcon className="mr-1 h-3 w-3" />
                                  {fileData.creationDate ? format(new Date(fileData.creationDate), "dd/MM/yy") : "Data"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={fileData.creationDate ? new Date(fileData.creationDate) : undefined}
                                  onSelect={(date) => updateFileMeta(fileData.id, { creationDate: date?.toISOString() })}
                                  locale={ptBR}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}

                        {requiresExpirationDate && (
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Vencimento</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs justify-start px-2 font-normal">
                                  <CalendarIcon className="mr-1 h-3 w-3" />
                                  {fileData.expirationDate ? format(new Date(fileData.expirationDate), "dd/MM/yy") : "Data"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={fileData.expirationDate ? new Date(fileData.expirationDate) : undefined}
                                  onSelect={(date) => updateFileMeta(fileData.id, { expirationDate: date?.toISOString() })}
                                  locale={ptBR}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                      </div>
                    </div>
                    {associatedFields.length > 0 && (
                      <div className="border-t pt-3 mt-1">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">Campos Específicos do Tipo de Documento</p>
                        <CustomFieldsForm 
                          fields={associatedFields} 
                          values={fileData.customFields} 
                          onChange={(fieldId, value) => {
                            const newCustomFields = { ...fileData.customFields, [fieldId]: value };
                            updateFileMeta(fileData.id, { customFields: newCustomFields });
                          }}
                        />
                      </div>
                    )}
                    </>
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
