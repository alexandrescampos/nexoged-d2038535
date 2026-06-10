import DocumentTypesSettings from "@/components/dashboard/DocumentTypesSettings";

export default function DocumentTypesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tipos de Documento</h1>
        <p className="text-muted-foreground">
          Gerencie os tipos de documentos da organização
        </p>
      </div>
      <DocumentTypesSettings />
    </div>
  );
}
