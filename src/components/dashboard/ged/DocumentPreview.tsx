import { useState, useEffect } from "react";
import { gedRepository } from "@/repository/gedRepository";
import { Loader2, AlertCircle, FileText, FileImage, FileCode, FileSpreadsheet, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentPreviewProps {
  documentId: string;
  documentName?: string;
  className?: string;
  showDetails?: boolean;
}

export function DocumentPreview({ documentId, documentName, className, showDetails = false }: DocumentPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const { url } = await gedRepository.getDownloadUrl(documentId);
        
        // We need the mime type to decide how to render. 
        // gedRepository.getDownloadUrl doesn't return mimeType, but we can try to guess from documentName 
        // or just let the browser handle it if it's an iframe.
        
        const ext = documentName?.split('.').pop()?.toLowerCase();
        let detectedMime = "application/octet-stream";
        if (ext === 'pdf') detectedMime = "application/pdf";
        else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) detectedMime = "image/" + (ext === 'jpg' ? 'jpeg' : ext);
        
        if (isMounted) {
          setPreviewUrl(url);
          setMimeType(detectedMime);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Erro ao carregar prévia");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [documentId, documentName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-muted/20 rounded-lg min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/10 rounded-lg min-h-[200px] border border-red-100 dark:border-red-900/20 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
        {showDetails && (
           <Button variant="outline" size="sm" className="mt-4" onClick={() => window.open(`/dashboard/documents?docId=${documentId}`, '_blank')}>
             Ver detalhes do documento
           </Button>
        )}
      </div>
    );
  }

  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  return (
    <div className={`flex flex-col bg-background rounded-lg border shadow-sm overflow-hidden ${className}`}>
      <div className="flex-1 relative min-h-[300px] bg-muted/10">
        {isImage ? (
          <img 
            src={previewUrl!} 
            alt={documentName} 
            className="w-full h-full object-contain p-2"
          />
        ) : isPdf ? (
          <iframe 
            src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
            className="w-full h-full border-none min-h-[400px]"
            title={documentName}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            {detectIcon(documentName)}
            <div>
              <p className="text-sm font-medium">{documentName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Prévia não disponível para este tipo de arquivo.
              </p>
            </div>
            <Button size="sm" onClick={() => window.open(previewUrl!, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir em nova aba
            </Button>
          </div>
        )}
      </div>
      
      {showDetails && (
        <div className="p-3 border-t bg-muted/5 flex items-center justify-between">
          <span className="text-xs font-medium truncate max-w-[200px]">{documentName}</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => window.open(previewUrl!, '_blank')}>
            Ver tela cheia
          </Button>
        </div>
      )}
    </div>
  );
}

function detectIcon(name?: string) {
  const ext = name?.split('.').pop()?.toLowerCase();
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileSpreadsheet className="h-12 w-12 text-green-600" />;
  if (['doc', 'docx'].includes(ext || '')) return <FileText className="h-12 w-12 text-blue-600" />;
  if (['js', 'ts', 'tsx', 'html', 'css', 'json'].includes(ext || '')) return <FileCode className="h-12 w-12 text-gray-500" />;
  return <FileText className="h-12 w-12 text-muted-foreground" />;
}
