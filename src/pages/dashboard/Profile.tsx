import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, User, Building2, Shield, Lock, Phone, Check, X } from "lucide-react";
import { passwordSchema as passwordValidationSchema } from "@/utils/password-validation";
import { ThemePicker } from "@/components/ThemePicker";

// Phone mask helper
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
}

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  phone: z
    .string()
    .max(15, "Telefone inválido")
    .refine(
      (val) => !val || /^\(\d{2}\)\s?\d{4,5}-\d{4}$/.test(val),
      "Formato inválido. Use (XX) XXXXX-XXXX"
    )
    .optional()
    .or(z.literal("")),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: passwordValidationSchema,
  confirmPassword: z.string().min(1, "Confirme a nova senha"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

type ProfileFormValues = z.infer<typeof profileSchema>;

const getRoleBadge = (role: string) => {
  switch (role) {
    case "org_admin":
      return <Badge className="bg-primary/10 text-primary border-primary/20">Administrador</Badge>;
    case "manager":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Usuário</Badge>;
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
};

export default function ProfilePage() {
  const { profile, organization, roles, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      phone: profile?.phone ? maskPhone(profile.phone) : "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const cleanedPhone = values.phone ? values.phone.replace(/\D/g, "") : null;
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: values.full_name, phone: cleanedPhone, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message || "Ocorreu um erro ao salvar suas informações.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (values: PasswordFormValues) => {
    if (!user?.email || !user?.id) return;

    setIsChangingPassword(true);
    try {
      // First, verify the current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: values.currentPassword,
      });

      if (signInError) {
        toast({
          title: "Erro",
          description: "Senha atual incorreta.",
          variant: "destructive",
        });
        setIsChangingPassword(false);
        return;
      }

      // Check if password was used in the last 3 changes
      const { data: isInHistory, error: historyCheckError } = await supabase.rpc(
        "is_password_in_history",
        {
          p_user_id: user.id,
          p_new_password: values.newPassword,
        }
      );

      if (historyCheckError) throw historyCheckError;

      if (isInHistory) {
        toast({
          variant: "destructive",
          title: "Senha repetida",
          description: "Você não pode repetir as últimas 3 senhas utilizadas.",
        });
        setIsChangingPassword(false);
        return;
      }

      // Update password in Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (updateError) throw updateError;

      // Record the change and update profile
      const { error: recordError } = await supabase.rpc("record_password_change", {
        p_user_id: user.id,
        p_new_password: values.newPassword,
      });

      if (recordError) throw recordError;

      toast({
        title: "Senha alterada",
        description: "Sua senha foi atualizada com sucesso.",
      });

      passwordForm.reset();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Ocorreu um erro ao atualizar sua senha.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const primaryRole = roles[0] || "user";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground">Visualize e edite suas informações pessoais</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Informações Editáveis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>Atualize seu nome e informações de contato</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        Telefone
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(11) 99999-9999"
                          {...field}
                          onChange={(e) => field.onChange(maskPhone(e.target.value))}
                          maxLength={15}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Email</FormLabel>
                  <Input value={profile?.email || user?.email || ""} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                </div>

                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Alterações
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Informações da Conta */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Função
              </CardTitle>
              <CardDescription>Sua função na organização</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getRoleBadge(primaryRole)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organização
              </CardTitle>
              <CardDescription>Organização à qual você pertence</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{organization?.name || "Não vinculado"}</p>
              {organization?.slug && (
                <p className="text-sm text-muted-foreground">@{organization.slug}</p>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Seção de Segurança */}
      <Separator />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Segurança
          </CardTitle>
          <CardDescription>Altere sua senha de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4 max-w-md">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha Atual</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
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
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Nova Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar Senha
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <ThemePicker scope="user" />
    </div>
  );
}

