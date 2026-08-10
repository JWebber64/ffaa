import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
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
          <Link className="tools-back-link" to="/tools">
            <ArrowLeft size={15} aria-hidden="true" />
            All tools
          </Link>
          <div className="tools-eyebrow">{eyebrow}</div>
          <h1 className="ff-display">{title}</h1>
          <p>{description}</p>
        </div>
        <div className="tools-free-mark">
          <ShieldCheck size={22} aria-hidden="true" />
          <span><strong>Free</strong>No login required</span>
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
