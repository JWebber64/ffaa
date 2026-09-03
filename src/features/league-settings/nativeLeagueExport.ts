import { collection, getDocs } from "firebase/firestore";

import { firestore } from "../../lib/firebase";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function loadNativeLeagueExport(leagueId: string, exportId: string) {
  const snapshot = await getDocs(collection(firestore, "leagues", leagueId, "leagueExports", exportId, "chunks"));
  const chunks = snapshot.docs
    .map((document) => ({ index: Number(document.data().index), content: text(document.data().content) }))
    .filter((chunk) => Number.isInteger(chunk.index) && chunk.index >= 0)
    .sort((left, right) => left.index - right.index);
  if (!chunks.length || chunks.some((chunk, index) => chunk.index !== index)) throw new Error("The export is incomplete. Generate it again before downloading.");
  return chunks.map((chunk) => chunk.content).join("");
}

export function downloadNativeLeagueExport(filename: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
