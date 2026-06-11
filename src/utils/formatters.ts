
export const formatBrazilianNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "—";
  
  let num: number;
  if (typeof value === "string") {
    // Remove todos os espaços
    const cleanValue = value.trim();
    
    // Se tiver vírgula, assume formato brasileiro: ponto é milhar, vírgula é decimal
    if (cleanValue.includes(",")) {
      const normalized = cleanValue.replace(/\./g, "").replace(",", ".");
      num = parseFloat(normalized);
    } else {
      // Se não tiver vírgula, mas tiver ponto, pode ser o decimal (padrão JS) 
      // ou milhar (se for ex: 1.000)
      // Para simplificar: se não tem vírgula, assume que o ponto é o decimal se houver apenas um.
      num = parseFloat(cleanValue);
    }
  } else {
    num = value;
  }
  
  if (isNaN(num)) return value.toString();

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

