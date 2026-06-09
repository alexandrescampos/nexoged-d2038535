import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";

interface SortableTableHeadProps {
  field: string;
  sortField: string | null;
  sortDirection: "asc" | "desc" | null;
  onSort: (field: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function SortableTableHead({ field, sortField, sortDirection, onSort, children, className }: SortableTableHeadProps) {
  const isActive = sortField === field;
  return (
    <TableHead
      className={`cursor-pointer select-none ${className || ""}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {!isActive && <ArrowUpDown className="h-3 w-3 opacity-40" />}
        {isActive && sortDirection === "asc" && <ArrowUp className="h-3 w-3" />}
        {isActive && sortDirection === "desc" && <ArrowDown className="h-3 w-3" />}
      </span>
    </TableHead>
  );
}
