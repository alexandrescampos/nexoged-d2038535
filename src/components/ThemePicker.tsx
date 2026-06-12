import { Check, Moon, Sun, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/hooks/useTheme";
import { THEME_PALETTES, ThemeMode, ThemePaletteId } from "@/lib/themes";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** "user" = preferência pessoal (perfil) | "org" = padrão da organização */
  scope: "user" | "org";
}

export function ThemePicker({ scope }: Props) {
  const {
    palette,
    mode,
    orgPalette,
    orgMode,
    userPalette,
    userMode,
    setUserPreferences,
    setOrgPreferences,
  } = useTheme();
  const [saving, setSaving] = useState(false);

  const currentPalette: ThemePaletteId =
    scope === "user" ? (userPalette ?? orgPalette) : orgPalette;
  const currentMode: ThemeMode = scope === "user" ? (userMode ?? orgMode) : orgMode;
  const isUsingOrgDefault = scope === "user" && userPalette === null && userMode === null;

  const handleSelect = async (newPalette: ThemePaletteId, newMode: ThemeMode) => {
    setSaving(true);
    try {
      if (scope === "user") {
        await setUserPreferences(newPalette, newMode);
      } else {
        await setOrgPreferences(newPalette, newMode);
      }
      toast({ title: "Tema atualizado", description: "Sua preferência foi salva." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message ?? "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetToOrg = async () => {
    setSaving(true);
    try {
      await setUserPreferences(null, null);
      toast({ title: "Preferência removida", description: "Usando padrão da organização." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{scope === "org" ? "Tema padrão da organização" : "Tema visual"}</CardTitle>
        <CardDescription>
          {scope === "org"
            ? "Define o tema que será aplicado a todos os usuários da organização (cada usuário pode sobrepor)."
            : isUsingOrgDefault
              ? "Você está usando o tema padrão da organização. Selecione abaixo para personalizar."
              : "Sua preferência pessoal sobrescreve o padrão da organização."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="mb-3 block">Paleta de cores</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {THEME_PALETTES.map((p) => {
              const selected = currentPalette === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={saving}
                  onClick={() => handleSelect(p.id, currentMode)}
                  className={cn(
                    "relative rounded-lg border-2 p-3 text-left transition-all hover:shadow-md disabled:opacity-50",
                    selected ? "border-primary ring-2 ring-primary/30" : "border-border"
                  )}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                  <div className="flex gap-1 mb-2">
                    {p.preview.map((c, i) => (
                      <div
                        key={i}
                        className="h-6 w-6 rounded-md border border-border/50"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="mb-3 block">Modo</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={currentMode === "light" ? "default" : "outline"}
              onClick={() => handleSelect(currentPalette, "light")}
              disabled={saving}
            >
              <Sun className="h-4 w-4 mr-2" /> Claro
            </Button>
            <Button
              type="button"
              variant={currentMode === "dark" ? "default" : "outline"}
              onClick={() => handleSelect(currentPalette, "dark")}
              disabled={saving}
            >
              <Moon className="h-4 w-4 mr-2" /> Escuro
            </Button>
          </div>
        </div>

        {scope === "user" && !isUsingOrgDefault && (
          <Button variant="ghost" size="sm" onClick={resetToOrg} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Voltar ao padrão da organização
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
