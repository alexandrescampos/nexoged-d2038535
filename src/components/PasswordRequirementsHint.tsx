import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  password: string;
  className?: string;
}

const rules = [
  { label: "Mínimo de 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "Número", test: (p: string) => /[0-9]/.test(p) },
  { label: "Caractere especial", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function isStrongPassword(password: string): boolean {
  return rules.every((r) => r.test(password));
}

export function PasswordRequirementsHint({ password, className }: Props) {
  return (
    <ul className={cn("space-y-1 text-xs", className)}>
      {rules.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-2",
              ok ? "text-green-600" : "text-muted-foreground"
            )}
          >
            {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
