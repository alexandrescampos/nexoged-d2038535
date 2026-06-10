import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, FileText, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { format, isBefore, isAfter, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function ExpirationReportPage() {
  const { organization } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["expiration-report", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ged_documents")
        .select(`
          id, 
          title, 
          expiration_date, 
          document_creation_date,
          document_type_id,
          document_type_data:ged_document_types(name)
        `)
        .eq("organization_id", organization!.id)
        .not("expiration_date", "is", null)
        .order("expiration_date", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.document_type_data as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sortedItems, sortField, sortDirection, handleSort } = useTableSort(filteredDocs);

  const getStatus = (dateStr: string) => {
    const date = parseISO(dateStr);
    const today = new Date();
    const warningDate = addDays(today, 30);

    if (isBefore(date, today)) {
      return { label: "Vencido", color: "destructive", icon: AlertTriangle };
    }
    if (isBefore(date, warningDate)) {
      return { label: "Vence em breve", color: "warning", icon: Clock };
    }
    return { label: "Regular", color: "default", icon: CheckCircle2 };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatório de Vencimentos</h1>
          <p className="text-muted-foreground">Acompanhe documentos que possuem data de expiração controlada</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-destructive font-medium uppercase text-xs">Vencidos</CardDescription>
            <CardTitle className="text-2xl">{documents.filter(d => isBefore(parseISO(d.expiration_date!), new Date())).length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-600 font-medium uppercase text-xs">Vencem em 30 dias</CardDescription>
            <CardTitle className="text-2xl">
              {documents.filter(d => {
                const date = parseISO(d.expiration_date!);
                return isAfter(date, new Date()) && isBefore(date, addDays(new Date(), 30));
              }).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary font-medium uppercase text-xs">Total Monitorado</CardDescription>
            <CardTitle className="text-2xl">{documents.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <CardTitle>Documentos com Vencimento</CardTitle>
            <div className="w-full sm:w-72">
              <Input 
                placeholder="Filtrar por título ou tipo..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead field="title" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Documento</SortableTableHead>
                <SortableTableHead field="document_type_data.name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Tipo</SortableTableHead>
                <SortableTableHead field="expiration_date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Vencimento</SortableTableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum documento com vencimento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                sortedItems.map((doc: any) => {
                  const status = getStatus(doc.expiration_date);
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          {doc.title}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{doc.document_type_data?.name || "Geral"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(parseISO(doc.expiration_date), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={status.color as any} 
                          className="gap-1"
                          style={status.color === 'warning' ? { backgroundColor: 'rgb(245 158 11 / 0.1)', color: 'rgb(217 119 6)', border: '1px solid rgb(245 158 11 / 0.2)' } : {}}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
