import type { ReactNode } from "react";

import { appUrl } from "../../lib/appBasePath";

type LeagueSeasonHeroProps = {
  description: string;
  eyebrow: string;
  imageAlt: string;
  imagePath: string;
  sourceDetail: string;
  sourceIcon: ReactNode;
  sourceLabel: string;
  title: string;
  variant: "lineup" | "matchups" | "teams";
};

export function LeagueSeasonHero({
  description,
  eyebrow,
  imageAlt,
  imagePath,
  sourceDetail,
  sourceIcon,
  sourceLabel,
  title,
  variant,
}: LeagueSeasonHeroProps) {
  return (
    <header className={`league-season-heading is-editorial is-${variant}`}>
      <div className="league-season-heading-copy">
        <span>{eyebrow}</span>
        <h1 className="ff-display">{title}</h1>
        <p>{description}</p>
      </div>
      <div className="league-season-artwork">
        <div className="league-season-artwork-frame">
          <img
            src={appUrl(imagePath)}
            alt={imageAlt}
            width="1536"
            height="1024"
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <div className="league-season-source">
          {sourceIcon}
          <span>{sourceLabel}</span>
          <strong>{sourceDetail}</strong>
        </div>
      </div>
    </header>
  );
}
