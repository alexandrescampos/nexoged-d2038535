import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Info, Cloud } from "lucide-react";
import { toast } from "sonner";

interface DriveAbout {
  ok: boolean;
  user?: { displayName?: string; emailAddress?: string; photoLink?: string };
  storageQuota?: { limit?: string; usage?: string };
  error?: { message?: string };
}

const formatBytes = (bytes?: string) => {
  if (!bytes) return "—";
  const n = Number(bytes);
  if (!isFinite(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(2)} ${units[i]}`;
};

export default function GoogleDriveIntegrationPage() {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<DriveAbout | null>(null);

  const fetchAbout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-integration", {
        body: null,
        method: "GET" as any,
      });
      // Edge function uses query params; call via fetch instead
      const { data: sess } = await supabase.auth.getSession();
      const url = `${(supabase as any).functionsUrl ?? ""}`;
      // Fallback: use functions.invoke with custom path
      throw new Error("use-direct");
    } catch {
      try {
        const projectUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        const res = await fetch(`${projectUrl}/functions/v1/google-drive-integration?action=about`, {
          headers: { Authorization: `Bearer ${anon}`, apikey: anon },
        });
        const json = await res.json();
        setInfo(json);
      } catch (e: any) {
        setInfo({ ok: false, error: { message: e.message } });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAbout(); }, []);

  const connected = info?.ok && info.user?.emailAddress;
  const usage = Number(info?.storageQuota?.usage ?? 0);
  const limit = Number(info?.storageQuota?.limit ?? 0);
  const pct = limit > 0 ? Math.min(100, (usage / limit) * 100) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Cloud className="h-6 w-6 text-primary" />
          Integração Google Drive
        </h1>
        <p className="text-muted-foreground mt-1">
          Visualize a conta conectada e gerencie a integração com o Google Drive.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Status da conexão</span>
            {loading ? (
              <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Verificando</Badge>
            ) : connected ? (
              <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</Badge>
            ) : (
              <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Desconectado</Badge>
            )}
          </CardTitle>
          <CardDescription>Conta Google atualmente vinculada ao sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando informações...
            </div>
          ) : connected ? (
            <>
              <div className="flex items-center gap-4">
                {info?.user?.photoLink && (
                  <img src={info.user.photoLink} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
                )}
                <div>
                  <div className="font-medium">{info?.user?.displayName ?? "—"}</div>
                  <div className="text-sm text-muted-foreground">{info?.user?.emailAddress}</div>
                </div>
              </div>

              {limit > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Armazenamento</span>
                    <span>{formatBytes(String(usage))} / {formatBytes(String(limit))}</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Não foi possível conectar</AlertTitle>
              <AlertDescription>
                {info?.error?.message ?? "Verifique a configuração do conector Google Drive."}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={fetchAbout} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                toast.info("Para desconectar, abra o painel de Conectores do Lovable Cloud e remova a conexão do Google Drive.", { duration: 8000 });
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Desconectar
            </Button>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como desconectar</AlertTitle>
            <AlertDescription>
              A integração é gerenciada pelo Lovable Cloud. Para desconectar de forma definitiva,
              acesse o menu de <strong>Conectores</strong> no painel do Lovable e remova a conexão
              do <strong>Google Drive</strong>. Após a remoção, esta página exibirá o status como desconectado.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
