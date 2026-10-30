import { describe, expect, it } from "vite-plus/test";

import { filterAndSortRows, nextDataTableSort } from "./data-table.logic";

interface Row {
  readonly name: string;
  readonly path: string;
  readonly chats: number | null;
}

const rows: ReadonlyArray<Row> = [
  { name: "octobus-os", path: "~/dev/octobus-os", chats: 37 },
  { name: "gpsd-to-can", path: "~/dev/gpsd-to-can", chats: null },
  { name: "Octobus-cli", path: "~/work/octobus-cli", chats: 2 },
  { name: "project10", path: "~/dev/project10", chats: 4 },
  { name: "project9", path: "~/dev/project9", chats: 4 },
];

const options = {
  searchText: (row: Row) => `${row.name} ${row.path}`,
  sortValue: (row: Row, columnId: string) => (columnId === "chats" ? row.chats : row.name),
};

const names = (result: ReadonlyArray<Row>) => result.map((row) => row.name);

describe("filterAndSortRows", () => {
  it("matches every search word in any searchable text, ignoring case", () => {
    expect(
      names(filterAndSortRows(rows, { ...options, query: "OCTOBUS work", sort: null })),
    ).toEqual(["Octobus-cli"]);
  });

  it("sorts names naturally and case-insensitively, both ways", () => {
    const sort = { columnId: "name", direction: "asc" } as const;
    expect(names(filterAndSortRows(rows, { ...options, query: "", sort }))).toEqual([
      "gpsd-to-can",
      "Octobus-cli",
      "octobus-os",
      "project9",
      "project10",
    ]);
    expect(
      names(
        filterAndSortRows(rows, { ...options, query: "", sort: { ...sort, direction: "desc" } }),
      ),
    ).toEqual(["project10", "project9", "octobus-os", "Octobus-cli", "gpsd-to-can"]);
  });

  it("keeps missing values last in both directions", () => {
    for (const direction of ["asc", "desc"] as const) {
      const result = filterAndSortRows(rows, {
        ...options,
        query: "",
        sort: { columnId: "chats", direction },
      });
      expect(result.at(-1)?.name).toBe("gpsd-to-can");
    }
  });
});

describe("nextDataTableSort", () => {
  it("reverses the sorted column and starts another column ascending", () => {
    const byName = nextDataTableSort(null, "name");
    expect(byName).toEqual({ columnId: "name", direction: "asc" });
    expect(nextDataTableSort(byName, "name")).toEqual({ columnId: "name", direction: "desc" });
    expect(nextDataTableSort({ columnId: "name", direction: "desc" }, "chats")).toEqual({
      columnId: "chats",
      direction: "asc",
    });
  });
});
