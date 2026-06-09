import { z } from "zod";

/**
 * Password requirements:
 * - 8 characters minimum
 * - Uppercase letters
 * - Lowercase letters
 * - Numbers
 * - Special characters
 */
export const passwordSchema = z.string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula")
  .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula")
  .regex(/[0-9]/, "A senha deve conter pelo menos um número")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter pelo menos um caractere especial");

export const isPasswordExpired = (updatedAt: string | null) => {
  if (!updatedAt) return false; // If not set, we assume it's fine for now or forced reset
  
  const lastUpdate = new Date(updatedAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 90;
};
