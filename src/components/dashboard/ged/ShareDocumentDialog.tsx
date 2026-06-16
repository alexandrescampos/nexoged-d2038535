import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Link as LinkIcon, Loader2 } from "lucide-react";

interface Props {
  document: { id: string; title: string } | null;
  onClose: () => void;
}

export function ShareDocumentDialog({ document, onClose }: Props) {
  const [expiresInDays, setExpiresInDays] = useState<string>("7");
  const [maxDownloads, setMaxDownloads] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!document) return;
    setLoading(true);
    try {
      const expires = expiresInDays && Number(expiresInDays) > 0
        ? new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString()
        : null;
      const { data, error } = await supabase.rpc("create_document_share", {
        p_document_id: document.id,
        p_expires_at: expires,
        p_max_downloads: maxDownloads ? Number(maxDownloads) : null,
        p_password: password || null,
      });
      if (error) throw error;
      const token = (data as any)?.token;
      const url = `${window.location.origin}/s/${token}`;
      setLink(url);
      toast.success("Link de compartilhamento gerado");
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  };

  const handleClose = () => {
    setLink("");
    setPassword("");
    setMaxDownloads("");
    setExpiresInDays("7");
    onClose();
  };

  return (
    <Dialog open={!!document} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LinkIcon className="h-5 w-5" /> Compartilhar documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground truncate">{document?.title}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Expira em (dias)</Label>
              <Input type="number" min={0} value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)} placeholder="ex: 7" />
            </div>
            <div>
              <Label>Máx. downloads</Label>
              <Input type="number" min={0} value={maxDownloads} onChange={e => setMaxDownloads(e.target.value)} placeholder="ilimitado" />
            </div>
          </div>
          <div>
            <Label>Senha (opcional)</Label>
            <Input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Deixe em branco para acesso direto" />
          </div>
          {link && (
            <div className="space-y-2">
              <Label>Link público</Label>
              <div className="flex gap-2">
                <Input readOnly value={link} />
                <Button type="button" variant="outline" onClick={handleCopy}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
            Gerar link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
