import { useSystemSettings } from "@/hooks/useSystemSettings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface TermsDialogProps {
  type: "terms" | "privacy";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TermsDialog({ type, open, onOpenChange }: TermsDialogProps) {
  const { data: settings, isLoading } = useSystemSettings();

  const content = type === "terms" 
    ? settings?.terms_of_service 
    : settings?.privacy_policy;
  
  const title = type === "terms" 
    ? "Termos de Uso" 
    : "Política de Privacidade";

  // Simple markdown-like formatting
  const formatContent = (text: string) => {
    return text
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold mt-6 mb-4">{line.substring(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold mt-5 mb-3">{line.substring(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-medium mt-4 mb-2">{line.substring(4)}</h3>;
        }
        // List items
        if (line.startsWith('- ')) {
          return (
            <li key={index} className="ml-4 mb-1">
              {formatInlineText(line.substring(2))}
            </li>
          );
        }
        // Horizontal rule
        if (line.startsWith('---')) {
          return <hr key={index} className="my-4 border-border" />;
        }
        // Empty lines
        if (line.trim() === '') {
          return <br key={index} />;
        }
        // Regular paragraphs
        return <p key={index} className="mb-2">{formatInlineText(line)}</p>;
      });
  };

  // Format inline text (bold)
  const formatInlineText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : content ? (
            <div className="text-sm text-foreground">
              {formatContent(content)}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Conteúdo não disponível.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
