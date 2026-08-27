import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareButton({ title, text, className = "" }: { title: string; text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, text, url });
      else await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  };
  return <button type="button" className={`share-page-button ${className}`} onClick={share}>{copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}<span>{copied ? "Link copied" : "Share"}</span></button>;
}
