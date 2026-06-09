import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload, Shield, Clock, Pencil, Trash2 } from "lucide-react";
import { PermissionGate } from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";

export default function DocumentsPage() {
  const documents = [
    { id: 1, name: "Contrato Social.pdf", type: "Jurídico", date: "10/06/2026", status: "Vigente" },
    { id: 2, name: "Alvará de Funcionamento.pdf", type: "Licença", date: "05/06/2026", status: "Vigente" },
    { id: 3, name: "PPRA 2025.pdf", type: "Segurança", date: "01/01/2025", status: "Expirado" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground">Gerencie seus documentos eletrônicos</p>
        </div>
        <PermissionGate permission="inserir_documento">
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Novo Documento
          </Button>
        </PermissionGate>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Documentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Documentos Vigentes</CardTitle>
            <Shield className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expirados / Próximos</CardTitle>
            <Clock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nome</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tipo</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Data</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium">{doc.name}</td>
                    <td className="p-4 align-middle">{doc.type}</td>
                    <td className="p-4 align-middle">{doc.date}</td>
                    <td className="p-4 align-middle">
                      <span className={`px-2 py-1 rounded-full text-xs ${doc.status === 'Vigente' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-right space-x-2">
                      <PermissionGate permission="editar_documento">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="excluir_documento">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
