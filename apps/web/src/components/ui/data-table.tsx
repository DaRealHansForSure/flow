// Flow: a searchable table whose columns sort on click. On phones the rows stack and the sort
// moves into a menu. The caller owns the sort so it can remember it.
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useMediaQuery } from "~/hooks/useMediaQuery";
import { cn } from "~/lib/utils";

import { Button } from "./button";
import {
  type DataTableSort,
  type DataTableSortValue,
  filterAndSortRows,
  nextDataTableSort,
} from "./data-table.logic";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "./menu";

export interface DataTableColumn<Row> {
  readonly id: string;
  readonly header: string;
  readonly renderCell: (row: Row) => ReactNode;
  /** Columns without a sort value cannot be sorted. */
  readonly sortValue?: (row: Row) => DataTableSortValue;
  readonly align?: "start" | "end";
  /**
   * Where the cell goes when the rows stack on a phone: the first line's title or its end, or the
   * second line with the other details. Defaults to "detail".
   */
  readonly phone?: "title" | "trailing" | "detail" | "hidden";
}

function SortIcon(props: { readonly direction: "asc" | "desc" | null }) {
  if (props.direction === "asc") {
    return <ArrowUpIcon aria-hidden className="size-3.5 shrink-0" />;
  }
  if (props.direction === "desc") {
    return <ArrowDownIcon aria-hidden className="size-3.5 shrink-0" />;
  }
  return <ChevronsUpDownIcon aria-hidden className="size-3.5 shrink-0 opacity-50" />;
}

export function DataTable<Row>(props: {
  readonly rows: ReadonlyArray<Row>;
  readonly columns: ReadonlyArray<DataTableColumn<Row>>;
  readonly getRowId: (row: Row) => string;
  readonly searchText?: (row: Row) => string;
  readonly searchLabel: string;
  readonly sort: DataTableSort | null;
  readonly onSortChange: (sort: DataTableSort) => void;
  /** For example "12 projects"; receives how many rows match the search. */
  readonly countLabel: (count: number) => string;
  readonly emptyLabel: string;
  /** Controls at the end of the search bar, such as an add button. */
  readonly actions?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const isPhone = useMediaQuery("max-sm");
  const { columns, sort } = props;
  const sortColumns = new Map(
    columns.flatMap((column) => (column.sortValue ? [[column.id, column.sortValue] as const] : [])),
  );
  const rows = filterAndSortRows(props.rows, {
    query,
    searchText: props.searchText,
    sort,
    sortValue: (row, columnId) => sortColumns.get(columnId)?.(row) ?? null,
  });
  const directionOf = (columnId: string) => (sort?.columnId === columnId ? sort.direction : null);
  const sortBy = (columnId: string) => props.onSortChange(nextDataTableSort(sort, columnId));
  const sortedColumn = columns.find((column) => column.id === sort?.columnId);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
      <label className="flex min-w-40 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-muted-foreground">
        <SearchIcon aria-hidden className="size-4 shrink-0" />
        <input
          type="search"
          aria-label={props.searchLabel}
          placeholder={`${props.searchLabel}…`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      {isPhone && sortColumns.size > 0 ? (
        <Menu>
          <MenuTrigger render={<Button variant="outline" size="sm" />}>
            {sortedColumn?.header ?? "Sort"}
            <SortIcon direction={sort?.direction ?? null} />
          </MenuTrigger>
          <MenuPopup align="end">
            {columns
              .filter((column) => column.sortValue)
              .map((column) => (
                <MenuItem key={column.id} onClick={() => sortBy(column.id)}>
                  <span className="min-w-0 flex-1">{column.header}</span>
                  {directionOf(column.id) ? <SortIcon direction={directionOf(column.id)} /> : null}
                </MenuItem>
              ))}
          </MenuPopup>
        </Menu>
      ) : null}
      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {props.countLabel(rows.length)}
      </span>
      {props.actions}
    </div>
  );

  const empty = (
    <p className="p-4 text-xs text-muted-foreground">
      {props.rows.length === 0 ? props.emptyLabel : "Nothing matches the search."}
    </p>
  );

  if (isPhone) {
    const title = columns.find((column) => column.phone === "title") ?? columns[0];
    const trailing = columns.filter((column) => column.phone === "trailing");
    const details = columns.filter(
      (column) => column !== title && (column.phone ?? "detail") === "detail",
    );
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {toolbar}
        {rows.length === 0 ? (
          empty
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={props.getRowId(row)} className="flex flex-col gap-1.5 p-3">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">{title?.renderCell(row)}</div>
                  {trailing.map((column) => (
                    <div key={column.id} className="shrink-0">
                      {column.renderCell(row)}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {details.map((column) => (
                    <span key={column.id} className="flex items-center gap-1">
                      {column.renderCell(row)}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {toolbar}
      {rows.length === 0 ? (
        empty
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {columns.map((column) => {
                  const direction = directionOf(column.id);
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={
                        direction === "asc"
                          ? "ascending"
                          : direction === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        "px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground",
                        column.align === "end" ? "text-end" : "text-start",
                      )}
                    >
                      {column.sortValue ? (
                        <button
                          type="button"
                          onClick={() => sortBy(column.id)}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1 rounded hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                            direction && "text-foreground",
                          )}
                        >
                          {column.header}
                          <SortIcon direction={direction} />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={props.getRowId(row)}
                  className="border-b border-border last:border-0 hover:bg-muted/40"
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-3 py-2.5 align-middle",
                        column.align === "end" ? "text-end tabular-nums" : "text-start",
                      )}
                    >
                      {column.renderCell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
