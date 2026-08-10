import { AlertTriangle, LoaderCircle } from "lucide-react";

interface ToolDataStatusProps {
  loading: boolean;
  error: string | null;
  label?: string;
}

export function ToolDataStatus({ loading, error, label = "public data" }: ToolDataStatusProps) {
  if (loading) {
    return (
      <div className="tool-data-status" role="status">
        <LoaderCircle className="is-spinning" size={17} aria-hidden="true" />
        Loading {label}…
      </div>
    );
  }
  if (error) {
    return (
      <div className="tool-data-status is-warning" role="status">
        <AlertTriangle size={17} aria-hidden="true" />
        {error}
      </div>
    );
  }
  return null;
}
