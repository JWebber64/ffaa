import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";

export type StatsSortDirection = "asc" | "desc";

export interface StatsSortState {
  columnId: string;
  direction: StatsSortDirection;
}

export interface StatsTableColumn<Row> {
  id: string;
  label: string;
  description?: string;
  align?: "left" | "right";
  sticky?: boolean;
  sortValue: (row: Row) => number | string | null;
  render: (row: Row) => ReactNode;
}

interface StatsDataTableProps<Row extends { id: string }> {
  rows: Row[];
  columns: StatsTableColumn<Row>[];
  sort: StatsSortState;
  onSortChange: (sort: StatsSortState) => void;
  onRowSelect?: (row: Row) => void;
  emptyMessage: string;
  caption: string;
}

function nextSort(current: StatsSortState, columnId: string): StatsSortState {
  if (current.columnId !== columnId) return { columnId, direction: "desc" };
  return { columnId, direction: current.direction === "desc" ? "asc" : "desc" };
}

function SortIcon({ active, direction }: { active: boolean; direction: StatsSortDirection }) {
  if (!active) return <ArrowUpDown size={13} aria-hidden="true" />;
  return direction === "asc" ? (
    <ArrowUp size={13} aria-hidden="true" />
  ) : (
    <ArrowDown size={13} aria-hidden="true" />
  );
}

export function StatsDataTable<Row extends { id: string }>({
  rows,
  columns,
  sort,
  onSortChange,
  onRowSelect,
  emptyMessage,
  caption,
}: StatsDataTableProps<Row>) {
  return (
    <div className="stats-hub-table-shell">
      <table className="stats-hub-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort.columnId === column.id;
              return (
                <th
                  key={column.id}
                  scope="col"
                  className={column.sticky ? "is-sticky" : ""}
                  title={column.description}
                  aria-sort={
                    active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSortChange(nextSort(sort, column.id))}
                  >
                    <span>{column.label}</span>
                    <SortIcon active={active} direction={sort.direction} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={[
                    column.align === "left" ? "is-left" : "",
                    column.sticky ? "is-sticky" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {column.sticky && onRowSelect ? (
                    <button
                      type="button"
                      className="stats-hub-row-action"
                      onClick={() => onRowSelect(row)}
                    >
                      {column.render(row)}
                    </button>
                  ) : (
                    column.render(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <div className="stats-empty-state">{emptyMessage}</div> : null}
    </div>
  );
}
