import * as XLSX from "xlsx";

interface SectorOption {
  id: string;
  name: string;
}

interface JobFunctionOption {
  id: string;
  name: string;
  code: string;
  sector_id: string | null;
}

interface EpiOption {
  id: string;
  code: string;
  name: string;
  ca_number?: string | null;
}

interface ExportSectorFunctionEpiMatrixParams {
  sectors: SectorOption[];
  jobFunctions: JobFunctionOption[];
  epis: EpiOption[];
}

export function exportSectorFunctionEpiMatrix({
  sectors,
  jobFunctions,
  epis,
}: ExportSectorFunctionEpiMatrixParams) {
  const sectorById = new Map(sectors.map((sector) => [sector.id, sector.name]));

  const validFunctions = jobFunctions.filter(
    (jobFunction) => jobFunction.sector_id && sectorById.has(jobFunction.sector_id),
  );

  const rows = validFunctions.flatMap((jobFunction) =>
    epis.map((epi) => ({
      SETOR: sectorById.get(jobFunction.sector_id!) ?? "",
      "CÓD FUNÇÃO": jobFunction.code,
      "FUNÇÃO": jobFunction.name,
      "CÓD EPI": epi.code,
      "NOME EPI": epi.name,
      QTD: "",
      "VALIDADE (MESES)": "",
    })),
  );

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ["SETOR", "CÓD FUNÇÃO", "FUNÇÃO", "CÓD EPI", "NOME EPI", "QTD", "VALIDADE (MESES)"],
  });

  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 28 },
    { wch: 18 },
    { wch: 36 },
    { wch: 10 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Matriz EPI x Função");
  XLSX.writeFile(workbook, "matriz_epi_x_funcao.xlsx");

  return {
    exportedRows: rows.length,
    skippedFunctions: jobFunctions.length - validFunctions.length,
  };
}