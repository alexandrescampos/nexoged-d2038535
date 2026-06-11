import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Cloud, Link2, Info } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Status {
  connected: boolean;
  status?: string;
  email?: string;
  display_name?: string;
  photo_url?: string;
  scope?: string;
  connected_by_name?: string;
  connected_at?: string;
  last_used_at?: string;
  last_error?: string;
}

export default function GoogleDriveIntegrationPage() {
  const { profile } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const orgId = profile?.organization_id;

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_org_gdrive_status", { p_org_id: orgId });
    if (error) {
      toast.error("Falha ao consultar status: " + error.message);
      setStatus(null);
    } else {
      setStatus(data as unknown as Status);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // Handle OAuth callback redirect
  useEffect(() => {
    const r = searchParams.get("gdrive");
    if (r === "connected") {
      toast.success("Google Drive conectado com sucesso!");
      searchParams.delete("gdrive");
      setSearchParams(searchParams, { replace: true });
      load();
    } else if (r === "error") {
      const reason = searchParams.get("reason") || "desconhecido";
      toast.error("Falha ao conectar: " + reason);
      searchParams.delete("gdrive");
      searchParams.delete("reason");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, load]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth-start", {
        body: { origin: window.location.origin },
      });
      if (error || !data?.url) throw new Error(error?.message || "Sem URL");
      window.location.href = data.url;
    } catch (e: any) {
      toast.error("Não foi possível iniciar a conexão: " + e.message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("google-drive-disconnect");
      if (error) throw error;
      toast.success("Google Drive desconectado.");
      setConfirmDisconnect(false);
      load();
    } catch (e: any) {
      toast.error("Falha ao desconectar: " + e.message);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Cloud className="h-6 w-6 text-primary" />
          Integração Google Drive
        </h1>
        <p className="text-muted-foreground mt-1">
          Conecte a conta Google da sua organização para importar arquivos diretamente do Drive.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Status da conexão</span>
            {loading ? (
              <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Verificando</Badge>
            ) : status?.connected ? (
              <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</Badge>
            ) : status?.status === "error" ? (
              <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>
            ) : (
              <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Desconectado</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Cada organização possui sua própria conexão. Apenas administradores podem conectar ou desconectar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : status?.connected ? (
            <>
              <div className="flex items-center gap-4">
                {status.photo_url && (
                  <img src={status.photo_url} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
                )}
                <div>
                  <div className="font-medium">{status.display_name ?? "—"}</div>
                  <div className="text-sm text-muted-foreground">{status.email}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Conectado por</div>
                  <div>{status.connected_by_name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Conectado em</div>
                  <div>{status.connected_at ? new Date(status.connected_at).toLocaleString("pt-BR") : "—"}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground">Escopo autorizado</div>
                  <div className="text-xs break-all">{status.scope}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" onClick={load} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
                </Button>
                <Button variant="outline" onClick={handleConnect} disabled={connecting}>
                  <Link2 className="h-4 w-4 mr-2" /> Reconectar (outra conta)
                </Button>
                <Button variant="destructive" onClick={() => setConfirmDisconnect(true)}>
                  <XCircle className="h-4 w-4 mr-2" /> Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              {status?.status === "error" && status.last_error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>A conexão apresentou erro</AlertTitle>
                  <AlertDescription className="break-all">{status.last_error}</AlertDescription>
                </Alert>
              )}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Nenhuma conta Google conectada</AlertTitle>
                <AlertDescription>
                  Ao clicar em "Conectar Google Drive", você será redirecionado para a tela oficial do Google para
                  autorizar a aplicação a <strong>ler</strong> arquivos do Drive da organização. Sua senha nunca é
                  enviada ao sistema.
                </AlertDescription>
              </Alert>
              <Button onClick={handleConnect} disabled={connecting} size="lg">
                {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                Conectar Google Drive
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar Google Drive?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso será revogado e os usuários não conseguirão mais importar arquivos do Drive até que um
              administrador conecte novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
