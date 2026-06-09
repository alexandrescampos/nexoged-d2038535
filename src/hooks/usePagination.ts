import { useState, useMemo } from "react";

interface UsePaginationOptions {
  pageSize?: number;
}

export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { pageSize: initialPageSize = 10 } = options;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Reset to valid page immediately during render (not via effect)
  const validPage = currentPage > totalPages ? totalPages : currentPage;

  const paginatedItems = useMemo(() => {
    const page = validPage;
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, validPage, pageSize]);

  const resetPage = () => setCurrentPage(1);

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  };

  return {
    paginatedItems,
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,
    setPageSize,
    totalItems: items.length,
    resetPage,
  };
}
