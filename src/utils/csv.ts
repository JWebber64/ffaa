// Simple CSV exporter (no external deps)

function escapeCell(v: string): string {
    // Quote if needed; escape quotes by doubling them
    const needsQuote = /[",\n]/.test(v);
    const s = v.replace(/"/g, '""');
    return needsQuote ? `"${s}"` : s;
  }
  
  export function toCSV(rows: string[][]): string {
    return rows.map((r) => r.map(escapeCell).join(",")).join("\n");
  }
  
  export function downloadCSV(filename: string, rows: string[][]) {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  