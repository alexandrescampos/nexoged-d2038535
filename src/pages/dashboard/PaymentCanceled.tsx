import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, ArrowLeft } from "lucide-react";

export default function PaymentCanceled() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <XCircle className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Pagamento Cancelado</CardTitle>
          <CardDescription>
            O processo de pagamento foi cancelado. Nenhuma cobrança foi realizada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Se você encontrou algum problema ou tem dúvidas sobre os planos, entre em contato com nosso suporte.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button onClick={() => navigate("/dashboard/billing")} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Billing
          </Button>
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="w-full">
            Ir para o Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
