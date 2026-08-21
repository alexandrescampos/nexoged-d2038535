import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { FileBadge2, Loader2, ShieldCheck, Trash2, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatBrasiliaDateTime } from "@/lib/timezone";
import { useAuth } from "@/hooks/useAuth";
import { useDigitalCertificates, daysUntil } from "@/hooks/useDigitalCertificates";
import type { CertificateScope, DigitalCertificate } from "@/repository/certificateRepository";

const MAX_BYTES = 2 * 1024 * 1024;

function formatDocumento(doc: string | null): string {
  if (!doc) return "—";
  const digits = doc.replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

function ValidityBadge({ validoAte }: { validoAte: string }) {
  const days = daysUntil(validoAte);
  if (days < 0) return <Badge variant="destructive">Vencido</Badge>;
  if (days < 30) {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30" variant="outline">
        Vence em {days} dia(s)
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30" variant="outline">
      Válido
    </Badge>
  );
}

interface UploadFormProps {
  scope: CertificateScope;
  isUploading: boolean;
  onSubmit: (file: File, password: string) => void;
}

function UploadForm({ scope, isUploading, onSubmit }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selected: File | null) => {
    if (!selected) {
      setFile(null);
      return;
    }
    if (!/\.(pfx|p12)$/i.test(selected.name)) {
      toast.error("Selecione um arquivo .pfx ou .p12");
      return;
    }
    if (selected.size > MAX_BYTES) {
      toast.error("O arquivo excede o limite de 2 MB");
      return;
    }
    setFile(selected);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`cert-file-${scope}`}>Arquivo do certificado (.pfx)</Label>
        <Input
          id={`cert-file-${scope}`}
          ref={inputRef}
          type="file"
          accept=".pfx,.p12"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`cert-pass-${scope}`}>Senha do certificado</Label>
        <Input
          id={`cert-pass-${scope}`}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <Button
        disabled={!file || !password || isUploading}
        onClick={() => {
          if (!file) return;
          onSubmit(file, password);
          setPassword("");
          setFile(null);
          if (inputRef.current) inputRef.current.value = "";
        }}
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
        Salvar certificado
      </Button>
      <p className="text-xs text-muted-foreground">
        O arquivo é gravado criptografado no servidor e nunca é exibido ou baixado novamente.
      </p>
    </div>
  );
}

function CertificateCard({
  certificate,
  onRemove,
  isRemoving,
}: {
  certificate: DigitalCertificate;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileBadge2 className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium leading-tight">{certificate.titular_nome}</p>
            <p className="text-xs text-muted-foreground">{formatDocumento(certificate.titular_documento)}</p>
          </div>
        </div>
        <ValidityBadge validoAte={certificate.valido_ate} />
      </div>
      <Separator />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Emissor</dt>
          <dd className="break-words">{certificate.emissor || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Válido até</dt>
          <dd>{formatBrasiliaDateTime(certificate.valido_ate)}</dd>
        </div>
      </dl>
      <Button variant="outline" size="sm" onClick={onRemove} disabled={isRemoving}>
        {isRemoving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
        Remover certificado
      </Button>
    </div>
  );
}

export default function DigitalCertificatesPage() {
  const { isOrgAdmin, isSuperAdmin } = useAuth();
  const { userCertificate, orgCertificate, isLoading, upload, remove } = useDigitalCertificates();
  const canManageOrg = Boolean(isOrgAdmin || isSuperAdmin);

  const handleUpload = (scope: CertificateScope) => (file: File, password: string) => {
    upload.mutate(
      { scope, file, password },
      {
        onSuccess: () => toast.success("Certificado salvo com sucesso"),
        onError: (e: unknown) => toast.error((e as Error).message),
      },
    );
  };

  const handleRemove = (id: string) => {
    remove.mutate(id, {
      onSuccess: () => toast.success("Certificado removido"),
      onError: () => toast.error("Não foi possível remover o certificado"),
    });
  };

  const expiringSoon = useMemo(
    () =>
      [userCertificate, orgCertificate].filter(
        (c): c is DigitalCertificate => !!c && daysUntil(c.valido_ate) < 30,
      ),
    [userCertificate, orgCertificate],
  );

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Certificados Digitais</h1>
        <p className="text-muted-foreground mt-1">
          Cadastre seu certificado A1 (ICP-Brasil) para assinar documentos direto pelo sistema, sem instalar
          nenhum programa.
        </p>
      </div>

      {expiringSoon.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Há certificado vencido ou próximo do vencimento. Substitua o arquivo para continuar assinando.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Meus certificados
          </CardTitle>
          <CardDescription>
            O arquivo e a senha ficam criptografados no servidor e só são usados no momento da assinatura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <Tabs defaultValue="usuario">
              <TabsList>
                <TabsTrigger value="usuario">Meu certificado (e-CPF)</TabsTrigger>
                <TabsTrigger value="organizacao">Certificado da organização (e-CNPJ)</TabsTrigger>
              </TabsList>

              <TabsContent value="usuario" className="pt-4 space-y-4">
                {userCertificate && (
                  <CertificateCard
                    certificate={userCertificate}
                    onRemove={() => handleRemove(userCertificate.id)}
                    isRemoving={remove.isPending}
                  />
                )}
                <UploadForm
                  scope="USUARIO"
                  isUploading={upload.isPending}
                  onSubmit={handleUpload("USUARIO")}
                />
              </TabsContent>

              <TabsContent value="organizacao" className="pt-4 space-y-4">
                {orgCertificate && (
                  <CertificateCard
                    certificate={orgCertificate}
                    onRemove={() => handleRemove(orgCertificate.id)}
                    isRemoving={remove.isPending}
                  />
                )}
                {canManageOrg ? (
                  <UploadForm
                    scope="ORGANIZACAO"
                    isUploading={upload.isPending}
                    onSubmit={handleUpload("ORGANIZACAO")}
                  />
                ) : (
                  <Alert>
                    <AlertDescription>
                      Apenas administradores da organização podem cadastrar o certificado e-CNPJ.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Segurança</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• O arquivo .pfx é armazenado criptografado e nunca pode ser baixado de volta.</p>
          <p>• A senha é guardada criptografada apenas para permitir a assinatura em um clique.</p>
          <p>• Somente você acessa o seu e-CPF; o e-CNPJ fica restrito à sua organização.</p>
          <p>• Toda assinatura é registrada em auditoria com data, titular e hash do documento.</p>
        </CardContent>
      </Card>
    </div>
  );
}
