// Paletas de cores disponíveis para o sistema.
// Cada paleta define overrides de variáveis CSS HSL aplicadas em :root.
// O modo escuro é controlado separadamente via classe .dark.

export type ThemePaletteId =
  | "corporate-blue"
  | "emerald-premium"
  | "noir-gold"
  | "ocean-deep"
  | "ruby-fire"
  | "sunset-blaze";

export type ThemeMode = "light" | "dark";

export interface ThemePalette {
  id: ThemePaletteId;
  label: string;
  description: string;
  preview: string[]; // 4 cores hex p/ swatches
  // Tokens HSL (sem hsl())
  light: Record<string, string>;
  dark: Record<string, string>;
}

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: "corporate-blue",
    label: "Azul Corporativo",
    description: "Paleta padrão do sistema",
    preview: ["#1565C0", "#1A2332", "#F8FAFC", "#0F172A"],
    light: {
      "--primary": "217 91% 45%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "217 91% 95%",
      "--accent-foreground": "217 91% 45%",
      "--ring": "217 91% 45%",
      "--sidebar-background": "222 47% 11%",
      "--sidebar-primary": "217 91% 60%",
      "--sidebar-ring": "217 91% 60%",
    },
    dark: {
      "--primary": "217 91% 60%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "217 32% 20%",
      "--accent-foreground": "217 91% 70%",
      "--ring": "217 91% 60%",
      "--sidebar-primary": "217 91% 60%",
      "--sidebar-ring": "217 91% 60%",
    },
  },
  {
    id: "emerald-premium",
    label: "Esmeralda Premium",
    description: "Verde luxuoso com toque dourado",
    preview: ["#0d7a5f", "#064e3b", "#c9a84c", "#f5f0e0"],
    light: {
      "--primary": "160 84% 26%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "160 60% 94%",
      "--accent-foreground": "160 84% 26%",
      "--ring": "160 84% 26%",
      "--sidebar-background": "160 50% 10%",
      "--sidebar-primary": "45 65% 55%",
      "--sidebar-ring": "45 65% 55%",
    },
    dark: {
      "--primary": "160 70% 45%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "160 40% 18%",
      "--accent-foreground": "160 70% 70%",
      "--ring": "160 70% 45%",
      "--sidebar-primary": "45 65% 55%",
      "--sidebar-ring": "45 65% 55%",
    },
  },
  {
    id: "noir-gold",
    label: "Noir & Gold",
    description: "Sofisticação preta com dourado",
    preview: ["#0d0d0d", "#1a1a1a", "#c9a84c", "#f0d78c"],
    light: {
      "--primary": "42 56% 54%",
      "--primary-foreground": "0 0% 10%",
      "--accent": "42 60% 95%",
      "--accent-foreground": "42 56% 35%",
      "--ring": "42 56% 54%",
      "--sidebar-background": "0 0% 6%",
      "--sidebar-primary": "42 56% 54%",
      "--sidebar-ring": "42 56% 54%",
    },
    dark: {
      "--primary": "42 70% 60%",
      "--primary-foreground": "0 0% 10%",
      "--accent": "42 30% 18%",
      "--accent-foreground": "42 70% 75%",
      "--ring": "42 70% 60%",
      "--sidebar-primary": "42 70% 60%",
      "--sidebar-ring": "42 70% 60%",
    },
  },
  {
    id: "ocean-deep",
    label: "Oceano Profundo",
    description: "Azul-petróleo e turquesa",
    preview: ["#0c2340", "#1a4a6e", "#2d8a9e", "#5cbdb9"],
    light: {
      "--primary": "192 56% 40%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "192 60% 94%",
      "--accent-foreground": "192 56% 30%",
      "--ring": "192 56% 40%",
      "--sidebar-background": "210 60% 14%",
      "--sidebar-primary": "180 45% 55%",
      "--sidebar-ring": "180 45% 55%",
    },
    dark: {
      "--primary": "192 65% 55%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "192 35% 20%",
      "--accent-foreground": "192 65% 75%",
      "--ring": "192 65% 55%",
      "--sidebar-primary": "180 45% 55%",
      "--sidebar-ring": "180 45% 55%",
    },
  },
  {
    id: "ruby-fire",
    label: "Rubi Vibrante",
    description: "Vermelho intenso e elegante",
    preview: ["#b91c1c", "#dc2626", "#fecaca", "#1f1f1f"],
    light: {
      "--primary": "0 74% 42%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "0 80% 96%",
      "--accent-foreground": "0 74% 42%",
      "--ring": "0 74% 42%",
      "--sidebar-background": "0 30% 12%",
      "--sidebar-primary": "0 80% 60%",
      "--sidebar-ring": "0 80% 60%",
    },
    dark: {
      "--primary": "0 80% 60%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "0 40% 22%",
      "--accent-foreground": "0 80% 80%",
      "--ring": "0 80% 60%",
      "--sidebar-primary": "0 80% 60%",
      "--sidebar-ring": "0 80% 60%",
    },
  },
  {
    id: "sunset-blaze",
    label: "Laranja Sunset",
    description: "Energia quente e vibrante",
    preview: ["#ea580c", "#f97316", "#fed7aa", "#1f2937"],
    light: {
      "--primary": "21 90% 48%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "27 100% 94%",
      "--accent-foreground": "21 90% 40%",
      "--ring": "21 90% 48%",
      "--sidebar-background": "20 30% 12%",
      "--sidebar-primary": "27 95% 60%",
      "--sidebar-ring": "27 95% 60%",
    },
    dark: {
      "--primary": "27 95% 60%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "21 40% 22%",
      "--accent-foreground": "27 95% 78%",
      "--ring": "27 95% 60%",
      "--sidebar-primary": "27 95% 60%",
      "--sidebar-ring": "27 95% 60%",
    },
  },
];

export const DEFAULT_PALETTE: ThemePaletteId = "corporate-blue";
export const DEFAULT_MODE: ThemeMode = "light";

export function getPalette(id?: string | null): ThemePalette {
  return THEME_PALETTES.find((p) => p.id === id) ?? THEME_PALETTES[0];
}

export function applyTheme(paletteId: string | null | undefined, mode: ThemeMode) {
  const palette = getPalette(paletteId);
  const root = document.documentElement;

  // Modo claro/escuro
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");

  // Aplicar tokens da paleta (sobrescreve as variáveis em :root)
  const tokens = mode === "dark" ? palette.dark : palette.light;
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  root.setAttribute("data-theme", palette.id);
}
