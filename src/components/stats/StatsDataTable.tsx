import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, UIEvent } from "react";

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
  const tableShellId = useId();
  const tableShellRef = useRef<HTMLDivElement>(null);
  const topScrollbarRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);

  const measureTable = useCallback(() => {
    const tableShell = tableShellRef.current;
    if (!tableShell) return;

    setTableScrollWidth(tableShell.scrollWidth);
    setHasHorizontalOverflow(tableShell.scrollWidth > tableShell.clientWidth + 1);
  }, []);

  useLayoutEffect(() => {
    const tableShell = tableShellRef.current;
    const table = tableShell?.querySelector("table");
    if (!tableShell || !table) return;

    measureTable();
    window.addEventListener("resize", measureTable);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", measureTable);
    }

    const resizeObserver = new ResizeObserver(measureTable);
    resizeObserver.observe(tableShell);
    resizeObserver.observe(table);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureTable);
    };
  }, [columns.length, measureTable, rows.length]);

  const syncHorizontalScroll = (
    event: UIEvent<HTMLDivElement>,
    target: HTMLDivElement | null,
  ) => {
    if (!target || Math.abs(target.scrollLeft - event.currentTarget.scrollLeft) < 1) return;
    target.scrollLeft = event.currentTarget.scrollLeft;
  };

  return (
    <div className="stats-hub-table-scroll-stack">
      <div
        ref={topScrollbarRef}
        className="stats-hub-table-top-scrollbar"
        role="region"
        aria-label={`Horizontal scroll for ${caption}`}
        aria-controls={tableShellId}
        tabIndex={0}
        hidden={!hasHorizontalOverflow}
        onScroll={(event) => syncHorizontalScroll(event, tableShellRef.current)}
      >
        <div
          className="stats-hub-table-top-scrollbar-spacer"
          style={{ width: tableScrollWidth }}
          aria-hidden="true"
        />
      </div>
      <div
        id={tableShellId}
        ref={tableShellRef}
        className="stats-hub-table-shell"
        onScroll={(event) => syncHorizontalScroll(event, topScrollbarRef.current)}
      >
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
    </div>
  );
}
