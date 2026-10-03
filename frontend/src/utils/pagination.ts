// Pure pagination math. No React, so it lives in utils/.

export type PageInfo = {
  totalPages: number;
  /** 1-based index of the first row on this page (0 when there are no rows). */
  firstRow: number;
  /** 1-based index of the last row on this page (0 when there are no rows). */
  lastRow: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

/** page=2, pageSize=25, total=160 -> rows 26–50 of 7 pages. */
export function pageInfo(page: number, pageSize: number, total: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const inRange = total > 0 && page <= totalPages;
  return {
    totalPages,
    firstRow: inRange ? (page - 1) * pageSize + 1 : 0,
    lastRow: inRange ? Math.min(page * pageSize, total) : 0,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  };
}
