export const CPU_MANAGER_PROFILE_IDS = [
  "balanced",
  "aggressive",
  "frugal",
  "stars_and_scrubs",
  "need_focused",
] as const;

export type CpuManagerProfileId = (typeof CPU_MANAGER_PROFILE_IDS)[number];
export type CpuManagerProfileSelection = CpuManagerProfileId | "random";

export const DEFAULT_CPU_MANAGER_PROFILE_SELECTION: CpuManagerProfileSelection = "random";

const CPU_MANAGER_PROFILE_ID_SET = new Set<string>(CPU_MANAGER_PROFILE_IDS);

export function isCpuManagerProfileId(value: unknown): value is CpuManagerProfileId {
  return typeof value === "string" && CPU_MANAGER_PROFILE_ID_SET.has(value);
}

export function normalizeCpuManagerProfileSelection(value: unknown): CpuManagerProfileSelection {
  if (isCpuManagerProfileId(value)) return value;
  return DEFAULT_CPU_MANAGER_PROFILE_SELECTION;
}

export function normalizeCpuManagerProfileSelections(
  value: unknown,
  count: number
): CpuManagerProfileSelection[] {
  const selections = Array.isArray(value) ? value : [];

  return Array.from({ length: Math.max(0, count) }, (_, index) =>
    normalizeCpuManagerProfileSelection(selections[index])
  );
}

function stableHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function resolveCpuManagerProfileSelection(
  selection: CpuManagerProfileSelection | undefined,
  seed: string
): CpuManagerProfileId {
  if (isCpuManagerProfileId(selection)) return selection;

  const index = stableHash(seed) % CPU_MANAGER_PROFILE_IDS.length;
  return CPU_MANAGER_PROFILE_IDS[index] ?? CPU_MANAGER_PROFILE_IDS[0];
}
