import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Eye, Loader2, AlertCircle } from "lucide-react";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/public-document-share`;

export default function PublicShare() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);

  const fetchInfo = async (pwd?: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pwd, action: "info" }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.error === "password_required") { setNeedsPassword(true); setError(pwd ? "Senha incorreta" : ""); }
        else setError(errorMessage(data.error));
      } else {
        setInfo(data);
        setNeedsPassword(false);
      }
    } catch (e: any) {
      setError(e.message || "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInfo(); /* eslint-disable-next-line */ }, [token]);

  const handleAction = async (action: "view" | "download") => {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: password || undefined, action }),
    });
    const data = await res.json();
    if (!data.ok) { setError(errorMessage(data.error)); return; }
    if (action === "download") {
      const a = document.createElement("a");
      a.href = data.url; a.download = data.file_name || "documento"; a.click();
    } else {
      window.open(data.url, "_blank");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Documento compartilhado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {info && (
            <>
              <div>
                <div className="text-xs text-muted-foreground">Título</div>
                <div className="font-medium">{info.title}</div>
                {info.file_name && <div className="text-xs text-muted-foreground mt-1">{info.file_name}</div>}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" onClick={() => handleAction("view")}><Eye className="h-4 w-4 mr-2" /> Visualizar</Button>
                <Button className="flex-1" onClick={() => handleAction("download")}><Download className="h-4 w-4 mr-2" /> Baixar</Button>
              </div>
            </>
          )}
          {needsPassword && !info && (
            <div className="space-y-2">
              <Label>Este link requer senha</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
              <Button className="w-full" onClick={() => fetchInfo(password)}>Acessar</Button>
            </div>
          )}
          {error && !needsPassword && (
            <div className="flex items-center gap-2 text-destructive text-sm"><AlertCircle className="h-4 w-4" />{error}</div>
          )}
          {error && needsPassword && (
            <div className="text-destructive text-sm">{error}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function errorMessage(code: string) {
  switch (code) {
    case "not_found": return "Link inválido";
    case "revoked": return "Este link foi revogado";
    case "expired": return "Este link expirou";
    case "limit_reached": return "Limite de downloads atingido";
    case "no_file": return "Documento sem arquivo";
    default: return code || "Erro desconhecido";
  }
}
