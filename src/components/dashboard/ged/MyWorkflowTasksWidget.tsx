import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, PenLine, ArrowRight, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMyWorkflowTasks } from "@/hooks/useMyWorkflowTasks";

export function MyWorkflowTasksWidget() {
  const navigate = useNavigate();
  const { approvals, signatures, isLoading } = useMyWorkflowTasks();

  const openDoc = (docId: string) => navigate(`/dashboard/documents?docId=${docId}`);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
            Minhas Aprovações Pendentes
            <Badge variant="secondary">{approvals.length}</Badge>
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => navigate("/dashboard/my-approvals")}>
            Ver tudo <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 max-h-64 overflow-auto">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : approvals.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm flex flex-col items-center gap-2">
              <Inbox className="h-6 w-6" /> Nenhuma aprovação pendente
            </div>
          ) : (
            approvals.slice(0, 5).map((a: any) => (
              <button
                key={a.id}
                onClick={() => openDoc(a.documento_id)}
                className="w-full text-left p-2 rounded border hover:bg-accent transition flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.documento?.nome || "Documento"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Etapa #{a.ordem} · {a.nome_etapa}
                  </p>
                </div>
                <Badge className="bg-amber-500 text-white">Aprovar</Badge>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <PenLine className="h-4 w-4 text-blue-500" />
            Minhas Assinaturas Pendentes
            <Badge variant="secondary">{signatures.length}</Badge>
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => navigate("/dashboard/my-signatures")}>
            Ver tudo <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 max-h-64 overflow-auto">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : signatures.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm flex flex-col items-center gap-2">
              <Inbox className="h-6 w-6" /> Nenhuma assinatura pendente
            </div>
          ) : (
            signatures.slice(0, 5).map((s: any) => (
              <button
                key={s.id}
                onClick={() => openDoc(s.documento_id)}
                className="w-full text-left p-2 rounded border hover:bg-accent transition flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.documento?.nome || "Documento"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Ordem #{s.ordem} · Tipo: {s.tipo_assinatura}
                  </p>
                </div>
                <Badge className="bg-blue-500 text-white">Assinar</Badge>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
