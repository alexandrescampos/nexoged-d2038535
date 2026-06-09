import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Loader2, KeyRound, Check, X } from "lucide-react";
import { passwordSchema } from "@/utils/password-validation";

const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const { user, roles, profile, clearMustResetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Check if password was used in the last 3 changes
      const { data: isInHistory, error: historyCheckError } = await supabase.rpc(
        "is_password_in_history",
        {
          p_user_id: user.id,
          p_new_password: data.newPassword,
        }
      );

      if (historyCheckError) throw historyCheckError;

      if (isInHistory) {
        toast({
          variant: "destructive",
          title: "Senha repetida",
          description: "Você não pode repetir as últimas 3 senhas utilizadas.",
        });
        setIsLoading(false);
        return;
      }

      // Update the password in Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (updateError) throw updateError;

      // Record the change and update profile
      const { error: recordError } = await supabase.rpc("record_password_change", {
        p_user_id: user.id,
        p_new_password: data.newPassword,
      });

      if (recordError) throw recordError;

      clearMustResetPassword();

      toast({
        title: "Senha atualizada",
        description: "Sua nova senha foi cadastrada com sucesso.",
      });

      // Redirect based on role
      if (roles.includes("super_admin")) {
        navigate("/super-admin");
      } else if (roles.includes("org_admin") || roles.includes("manager")) {
        navigate("/dashboard");
      } else {
        navigate("/auth");
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar senha",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
          <CardDescription>
            {profile?.full_name ? `Olá, ${profile.full_name}! ` : ""}
            Por favor, cadastre uma nova senha para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Digite sua nova senha"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs space-y-1 mt-2">
                      <div className="flex items-center gap-1.5">
                        {field.value.length >= 8 ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-muted-foreground" />}
                        <span>Mínimo 8 caracteres</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/[A-Z]/.test(field.value) ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-muted-foreground" />}
                        <span>Letra maiúscula</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/[a-z]/.test(field.value) ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-muted-foreground" />}
                        <span>Letra minúscula</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/[0-9]/.test(field.value) ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-muted-foreground" />}
                        <span>Número</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/[^A-Za-z0-9]/.test(field.value) ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-muted-foreground" />}
                        <span>Caractere especial</span>
                      </div>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirme sua nova senha"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Nova Senha
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
