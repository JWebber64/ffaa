import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { STYLE_PACKS, type StylePackId } from "../src/auctioneer/stylePacks";

type SpokenAuctionCall = "once" | "twice" | "sold";

const MODEL = "gpt-4o-mini-tts";
const VOICE = "cedar";
const OUT_DIR = path.resolve("public", "sounds", "voice");
const API_URL = "https://api.openai.com/v1/audio/speech";

const SOLD_LINES: Record<StylePackId, string> = {
  classic: "Sold!",
  rodeo: "Hammer down! Sold!",
  posh: "Sold. Exquisite.",
  comedian: "Sold! Hope you meant to do that.",
};

const INSTRUCTIONS: Record<StylePackId, string> = {
  classic: "Speak like a natural, confident fantasy football auctioneer. Clear, warm, energetic, and not robotic.",
  rodeo: "Speak like a lively auctioneer with a playful rodeo cadence. Natural, upbeat, and concise.",
  posh: "Speak like a refined auction host. Smooth, tasteful, and natural.",
  comedian: "Speak like a witty live host. Natural delivery, dry timing, and clear pronunciation.",
};

function parseDotenv(raw: string) {
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && value && !process.env[key]) process.env[key] = value;
  }
}

async function loadLocalEnv() {
  try {
    parseDotenv(await readFile(path.resolve(".env"), "utf8"));
  } catch {
    // Local .env is optional.
  }
}

async function createSpeech(input: string, instructions: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to generate auction voice clips.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      input,
      instructions,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI speech request failed (${response.status}): ${details}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function getLine(styleId: StylePackId, call: SpokenAuctionCall) {
  const pack = STYLE_PACKS[styleId];
  if (call === "once") return pack.once();
  if (call === "twice") return pack.twice();
  return SOLD_LINES[styleId];
}

async function main() {
  await loadLocalEnv();
  await mkdir(OUT_DIR, { recursive: true });

  const clips: Record<StylePackId, Record<SpokenAuctionCall, string>> = {
    classic: {} as Record<SpokenAuctionCall, string>,
    rodeo: {} as Record<SpokenAuctionCall, string>,
    posh: {} as Record<SpokenAuctionCall, string>,
    comedian: {} as Record<SpokenAuctionCall, string>,
  };

  for (const styleId of Object.keys(STYLE_PACKS) as StylePackId[]) {
    for (const call of ["once", "twice", "sold"] as SpokenAuctionCall[]) {
      const fileName = `${styleId}-${call}.mp3`;
      const outputPath = path.join(OUT_DIR, fileName);
      const audio = await createSpeech(getLine(styleId, call), INSTRUCTIONS[styleId]);
      await writeFile(outputPath, audio);
      clips[styleId][call] = `/sounds/voice/${fileName}`;
      console.log(`Generated ${outputPath}`);
    }
  }

  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        provider: "OpenAI",
        model: MODEL,
        voice: VOICE,
        clips,
      },
      null,
      2
    )
  );

  await writeFile(
    path.join(OUT_DIR, "SOUND_CREDITS.md"),
    [
      "# Auction Voice Credits",
      "",
      `Generated with OpenAI text-to-speech model \`${MODEL}\`, voice \`${VOICE}\`.`,
      "",
      "These clips are AI-generated voice lines. The app should disclose to users that auctioneer voice audio is AI-generated.",
      "",
    ].join("\n")
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
