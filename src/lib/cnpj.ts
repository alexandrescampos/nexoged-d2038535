/**
 * Validates a Brazilian CNPJ (Cadastro Nacional da Pessoa Jurídica)
 * @param cnpj - The CNPJ string to validate (can contain formatting)
 * @returns true if valid, false otherwise
 */
export function validateCNPJ(cnpj: string): boolean {
  // Remove non-numeric characters
  const cleaned = cleanCNPJ(cnpj);
  
  // Must have exactly 14 digits
  if (cleaned.length !== 14) {
    return false;
  }
  
  // Check for known invalid patterns (all same digits)
  if (/^(\d)\1+$/.test(cleaned)) {
    return false;
  }
  
  // Validate first check digit
  let sum = 0;
  let weight = 5;
  
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  let remainder = sum % 11;
  const firstCheckDigit = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cleaned[12]) !== firstCheckDigit) {
    return false;
  }
  
  // Validate second check digit
  sum = 0;
  weight = 6;
  
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  remainder = sum % 11;
  const secondCheckDigit = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cleaned[13]) !== secondCheckDigit) {
    return false;
  }
  
  return true;
}

/**
 * Formats a CNPJ string to the standard format: XX.XXX.XXX/XXXX-XX
 * @param cnpj - The CNPJ string to format
 * @returns Formatted CNPJ string
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = cleanCNPJ(cnpj);
  
  if (cleaned.length !== 14) {
    return cnpj;
  }
  
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12, 14)}`;
}

/**
 * Removes all non-numeric characters from a CNPJ string
 * @param cnpj - The CNPJ string to clean
 * @returns Cleaned CNPJ string containing only digits
 */
export function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

/**
 * Applies CNPJ mask as user types
 * @param value - The current input value
 * @returns Masked value
 */
export function maskCNPJ(value: string): string {
  const cleaned = cleanCNPJ(value);
  
  let masked = cleaned;
  
  if (cleaned.length > 2) {
    masked = `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
  }
  if (cleaned.length > 5) {
    masked = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5)}`;
  }
  if (cleaned.length > 8) {
    masked = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8)}`;
  }
  if (cleaned.length > 12) {
    masked = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12, 14)}`;
  }
  
  return masked;
}
