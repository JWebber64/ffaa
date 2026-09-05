import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface ToolLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  methodology?: ReactNode;
}

export function ToolLayout({
  eyebrow,
  title,
  description,
  children,
  methodology,
}: ToolLayoutProps) {
  return (
    <section className="tools-page">
      <header className="tools-page-hero">
        <div>
          <div className="tools-page-context"><Link className="tools-back-link" to="/tools">
            <ArrowLeft size={15} aria-hidden="true" />
            All tools
          </Link><span>{eyebrow} · Free, no login required</span></div>
          <h1 className="ff-display">{title}</h1>
          <p>{description}</p>
        </div>
      </header>

      {children}

      {methodology ? (
        <aside className="tools-methodology" aria-label="Methodology and limitations">
          <strong>How to read this</strong>
          <div>{methodology}</div>
        </aside>
      ) : null}
    </section>
  );
}
