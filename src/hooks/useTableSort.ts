import { useState, useMemo } from "react";

type SortDirection = "asc" | "desc" | null;

export function useTableSort<T>(items: T[]) {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") { setSortField(null); setSortDirection(null); }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedItems = useMemo(() => {
    if (!sortField || !sortDirection) return items;
    return [...items].sort((a, b) => {
      const aVal = getNestedValue(a, sortField);
      const bVal = getNestedValue(b, sortField);
      let cmp = 0;
      if (aVal == null && bVal == null) cmp = 0;
      else if (aVal == null) cmp = -1;
      else if (bVal == null) cmp = 1;
      else if (typeof aVal === "number" && typeof bVal === "number") cmp = aVal - bVal;
      else if (typeof aVal === "boolean" && typeof bVal === "boolean") cmp = (aVal === bVal ? 0 : aVal ? 1 : -1);
      else cmp = String(aVal).localeCompare(String(bVal), "pt-BR", { sensitivity: "base" });
      return sortDirection === "desc" ? -cmp : cmp;
    });
  }, [items, sortField, sortDirection]);

  return { sortedItems, sortField, sortDirection, handleSort };
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}
