import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText } from "lucide-react";

export default function TermsPage() {
  const { data: settings, isLoading } = useSystemSettings();

  const content = settings?.terms_of_service;
  const version = settings?.terms_version;

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Termos de Uso</h1>
          {version && (
            <p className="text-sm text-muted-foreground">Versão {version}</p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Termos e Condições de Uso do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-300px)] pr-4">
            {content ? (
              <div className="text-sm text-foreground">
                {formatContent(content)}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Os termos de uso ainda não foram configurados.
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
