// Flow: search and sort for DataTable, kept apart from the component so it can be tested alone.

export type DataTableSortDirection = "asc" | "desc";

export interface DataTableSort {
  readonly columnId: string;
  readonly direction: DataTableSortDirection;
}

/** Missing values (null) sort last in both directions. */
export type DataTableSortValue = string | number | null;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareSortValues(left: DataTableSortValue, right: DataTableSortValue): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return collator.compare(String(left), String(right));
}

/** Clicking the sorted column reverses it; another column starts ascending. */
export function nextDataTableSort(current: DataTableSort | null, columnId: string): DataTableSort {
  if (current?.columnId === columnId) {
    return { columnId, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { columnId, direction: "asc" };
}

export function filterAndSortRows<Row>(
  rows: ReadonlyArray<Row>,
  options: {
    readonly query: string;
    readonly searchText?: ((row: Row) => string) | undefined;
    readonly sort: DataTableSort | null;
    readonly sortValue?: ((row: Row, columnId: string) => DataTableSortValue) | undefined;
  },
): ReadonlyArray<Row> {
  const terms = options.query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const { searchText, sort, sortValue } = options;
  const matching =
    terms.length === 0 || searchText === undefined
      ? rows
      : rows.filter((row) => {
          const text = searchText(row).toLowerCase();
          return terms.every((term) => text.includes(term));
        });
  if (sort === null || sortValue === undefined) {
    return matching;
  }
  const factor = sort.direction === "asc" ? 1 : -1;
  return matching.toSorted((leftRow, rightRow) => {
    const left = sortValue(leftRow, sort.columnId);
    const right = sortValue(rightRow, sort.columnId);
    if (left === null || right === null) {
      return left === right ? 0 : left === null ? 1 : -1;
    }
    return compareSortValues(left, right) * factor;
  });
}
