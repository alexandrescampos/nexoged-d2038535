import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock } from "lucide-react";
import { TermsDialog } from "@/components/TermsDialog";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const { signIn, user, roles, profile, isLoading: authLoading } = useAuth();
  const { data: systemSettings, isLoading: settingsLoading } = useSystemSettings();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    
    if (errorParam === "account_disabled") {
      toast({
        variant: "destructive",
        title: "Conta inativa",
        description: "Sua conta de usuário está inativa. Entre em contato com o administrador.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorParam === "no_roles") {
      toast({
        variant: "destructive",
        title: "Acesso negado",
        description: "Seu usuário não possui permissões atribuídas. Entre em contato com o administrador.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  const systemLogo = systemSettings?.system_logo;

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Redirect based on role after login
  useEffect(() => {
    if (!authLoading && user && roles.length > 0 && profile !== null) {
      setIsTransitioning(true);

      const timer = setTimeout(() => {
        if (profile?.must_reset_password) {
          navigate("/reset-password");
          return;
        }

        if (roles.includes("super_admin")) {
          navigate("/super-admin");
        } else if (roles.includes("org_admin") || roles.includes("manager")) {
          navigate("/dashboard");
        } else {
          navigate("/");
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [user, roles, profile, authLoading, navigate]);

  const onLogin = async (data: LoginForm) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);

    if (error) {
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Erro ao entrar",
        description: error.message === "Invalid login credentials" ? "Email ou senha incorretos" : error.message,
      });
    }
  };

  if (authLoading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isTransitioning || (user && isLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Carregando seu ambiente...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6 w-full">
            {systemLogo ? (
              <img src={systemLogo} alt="Logo do Sistema" className="w-full max-h-[480px] object-contain" />
            ) : (
              <div className="h-80 w-80 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Clock className="h-40 w-40 text-primary" />
              </div>
            )}
          </div>
          <p className="text-muted-foreground">Sistema de Gestão Eletrônica de Documentos</p>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Acesse sua conta</CardTitle>
            <CardDescription className="text-center">Entre com suas credenciais para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="seu@email.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input placeholder="••••••••" type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="text-center mt-6 space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => setShowTermsDialog(true)} className="hover:text-foreground underline">
              Termos de Uso
            </button>
            <span>|</span>
            <button onClick={() => setShowPrivacyDialog(true)} className="hover:text-foreground underline">
              Política de Privacidade
            </button>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Nexo GED. Todos os direitos reservados.</p>
        </div>
      </div>

      <TermsDialog type="terms" open={showTermsDialog} onOpenChange={setShowTermsDialog} />
      <TermsDialog type="privacy" open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog} />
    </div>
  );
}
