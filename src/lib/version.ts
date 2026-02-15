export interface VersionInfo {
  version: string;
  gitHash?: string;
  buildTime?: string;
}

let cachedVersionInfo: VersionInfo | null = null;

export async function getVersionInfo(): Promise<VersionInfo> {
  if (cachedVersionInfo) {
    return cachedVersionInfo;
  }

  const version = import.meta.env.VITE_APP_VERSION || '0.0.0';
  
  // Try to get git hash from environment or fetch it
  let gitHash = import.meta.env.VITE_GIT_HASH;
  
  if (!gitHash && typeof window !== 'undefined') {
    try {
      // In development, try to get git hash from a simple endpoint
      const response = await fetch('/api/git-hash');
      if (response.ok) {
        gitHash = await response.text();
      }
    } catch {
      // Fallback: use current timestamp as pseudo-hash
      gitHash = 'dev-' + Date.now().toString(36);
    }
  }

  const buildTime = import.meta.env.VITE_BUILD_TIME || new Date().toISOString();

  cachedVersionInfo = {
    version,
    gitHash: gitHash?.substring(0, 7) || 'unknown', // Short hash
    buildTime
  };

  return cachedVersionInfo;
}

export function formatVersionShort(info: VersionInfo): string {
  return `v${info.version}${info.gitHash ? `-${info.gitHash}` : ''}`;
}

export function formatVersionFull(info: VersionInfo): string {
  return `v${info.version}${info.gitHash ? ` (${info.gitHash})` : ''} • ${new Date(info.buildTime || '').toLocaleDateString()}`;
}
