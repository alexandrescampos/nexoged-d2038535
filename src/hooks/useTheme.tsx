import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  applyTheme,
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  ThemeMode,
  ThemePaletteId,
} from "@/lib/themes";

interface ThemeContextValue {
  palette: ThemePaletteId;
  mode: ThemeMode;
  orgPalette: ThemePaletteId;
  orgMode: ThemeMode;
  userPalette: ThemePaletteId | null;
  userMode: ThemeMode | null;
  /** Define preferência pessoal do usuário (null = usar padrão da org). */
  setUserPreferences: (palette: ThemePaletteId | null, mode: ThemeMode | null) => Promise<void>;
  /** Define padrão da organização (apenas admins). */
  setOrgPreferences: (palette: ThemePaletteId, mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile, organization, isOrgAdmin, isSuperAdmin } = useAuth();

  const orgPalette = ((organization as any)?.theme_palette as ThemePaletteId) ?? DEFAULT_PALETTE;
  const orgMode = (((organization as any)?.theme_mode as ThemeMode) ?? DEFAULT_MODE);
  const userPalette = ((profile as any)?.theme_palette as ThemePaletteId | null) ?? null;
  const userMode = (((profile as any)?.theme_mode as ThemeMode | null) ?? null);

  // Cache local para resposta instantânea antes do profile carregar
  const [localPalette, setLocalPalette] = useState<ThemePaletteId>(() => {
    return (localStorage.getItem("theme-palette") as ThemePaletteId) || DEFAULT_PALETTE;
  });
  const [localMode, setLocalMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem("theme-mode") as ThemeMode) || DEFAULT_MODE;
  });

  const effectivePalette = userPalette ?? orgPalette ?? localPalette;
  const effectiveMode = userMode ?? orgMode ?? localMode;

  useEffect(() => {
    applyTheme(effectivePalette, effectiveMode);
    localStorage.setItem("theme-palette", effectivePalette);
    localStorage.setItem("theme-mode", effectiveMode);
    setLocalPalette(effectivePalette);
    setLocalMode(effectiveMode);
  }, [effectivePalette, effectiveMode]);

  const setUserPreferences = useCallback(
    async (palette: ThemePaletteId | null, mode: ThemeMode | null) => {
      if (!profile?.id) return;
      const { error } = await supabase
        .from("profiles")
        .update({ theme_palette: palette, theme_mode: mode } as any)
        .eq("id", profile.id);
      if (error) throw error;
      // Aplica imediato
      applyTheme(palette ?? orgPalette, mode ?? orgMode);
    },
    [profile?.id, orgPalette, orgMode]
  );

  const setOrgPreferences = useCallback(
    async (palette: ThemePaletteId, mode: ThemeMode) => {
      if (!organization?.id) return;
      if (!isOrgAdmin && !isSuperAdmin) throw new Error("Sem permissão");
      const { error } = await supabase
        .from("organizations")
        .update({ theme_palette: palette, theme_mode: mode } as any)
        .eq("id", organization.id);
      if (error) throw error;
      applyTheme(userPalette ?? palette, userMode ?? mode);
    },
    [organization?.id, isOrgAdmin, isSuperAdmin, userPalette, userMode]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      palette: effectivePalette as ThemePaletteId,
      mode: effectiveMode as ThemeMode,
      orgPalette,
      orgMode,
      userPalette,
      userMode,
      setUserPreferences,
      setOrgPreferences,
    }),
    [effectivePalette, effectiveMode, orgPalette, orgMode, userPalette, userMode, setUserPreferences, setOrgPreferences]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return ctx;
}
