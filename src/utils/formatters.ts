
export const formatBrazilianNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "—";
  
  let num: number;
  if (typeof value === "string") {
    // Se já tiver vírgula e ponto, assume formato brasileiro e tenta normalizar para o JS (dot decimal)
    // Se tiver apenas vírgula, assume que é o separador decimal
    const normalized = value.replace(/\./g, "").replace(",", ".");
    num = parseFloat(normalized);
  } else {
    num = value;
  }
  
  if (isNaN(num)) return value.toString();

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};
