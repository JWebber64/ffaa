import { useState } from "react";

import "./team-identity-mark.css";

function teamIdentityInitials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "FF";
}

export function TeamIdentityMark({
  avatarUrl,
  className = "",
  fallbackText,
  name,
}: {
  avatarUrl?: string;
  className?: string;
  fallbackText?: string;
  name: string;
}) {
  const normalizedAvatarUrl = avatarUrl?.trim() ?? "";
  const [failedAvatarUrl, setFailedAvatarUrl] = useState("");
  const canShowAvatar = Boolean(normalizedAvatarUrl && failedAvatarUrl !== normalizedAvatarUrl);

  return (
    <span className={`team-identity-mark ${className}`.trim()} aria-hidden="true">
      {canShowAvatar
        ? <img src={normalizedAvatarUrl} alt="" decoding="async" onError={() => setFailedAvatarUrl(normalizedAvatarUrl)} />
        : fallbackText || teamIdentityInitials(name)}
    </span>
  );
}
