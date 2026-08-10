import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { stringify } from 'csv-stringify/sync';
import slugify from 'slugify';

const FANTASY_SEASON = 2026;
const ESPN_CHEATSHEET_URL = 'https://g.espncdn.com/s/ffldraftkit/26/NFL26_CS_PPR300.pdf?adddata=2026CS_PPR300';
const OUTPUT_DIR = path.join(process.cwd(), 'src', 'data');
const JSON_OUTPUT = path.join(OUTPUT_DIR, `players-${FANTASY_SEASON}-espn.json`);
const CSV_OUTPUT = path.join(OUTPUT_DIR, `players-${FANTASY_SEASON}-espn.csv`);

interface PlayerRow {
  rank: number;
  name: string;
  position: string;
  team: string;
  value: number;
  bye: number;
  id: string;
  updatedAt: string;
}

async function downloadPdf(): Promise<Buffer> {
  console.log('Downloading ESPN cheat sheet...');
  try {
    const response = await fetch(ESPN_CHEATSHEET_URL);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    console.log(`Downloaded ${buffer.byteLength} bytes`);
    return Buffer.from(buffer);
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}

async function parsePdfBuffer(pdfBuffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const data = await parser.getText();
    return data.text;
  } catch (error) {
    console.error('PDF parse error:', error);
    throw error;
  } finally {
    await parser.destroy();
  }
}

function parsePdfText(text: string): PlayerRow[] {
  console.log('Parsing PDF content...');
  const players: PlayerRow[] = [];
  const updatedAt = new Date().toISOString().slice(0, 10);

  // ESPN 2026 PDF format: "1. (RB1) Jahmyr Gibbs, DET $57 6"
  // The text extractor places multiple entries on one line, so parse globally.
  const playerRegex =
    /(\d+)\.\s+\((QB|RB|WR|TE|K|DST|D\/ST)(\d+)\)\s+(.+?),\s+([A-Z]{2,3})\s+\$([\d,]+)\s+(\d+)/g;

  for (const match of text.matchAll(playerRegex)) {
    const rank = match[1];
    const pos = match[2];
    const name = match[4];
    const team = match[5];
    const value = match[6];
    const bye = match[7];
    const position = pos === 'D/ST' || pos === 'DST' ? 'DEF' : pos;

    const playerRank = parseInt(rank ?? '0', 10);
    const playerName = name?.trim() ?? '';
    const playerValue = parseInt((value ?? '0').replace(/,/g, ''), 10);
    const playerBye = parseInt(bye ?? '0', 10);

    if (playerRank && playerName && position && team) {
      players.push({
        rank: playerRank,
        name: playerName,
        position,
        team,
        value: playerValue,
        bye: playerBye,
        id: `${FANTASY_SEASON}-${position}-${slugify(playerName.toLowerCase(), { lower: true, strict: true })}`,
        updatedAt,
      });
    }
  }
  
  return players;
}

function saveOutput(players: PlayerRow[]) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Save as JSON
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(players, null, 2));
  console.log(`Saved ${players.length} players to ${JSON_OUTPUT}`);
  
  // Save as CSV for manual checking
  const csvData = stringify(players, {
    header: true,
    columns: ['rank', 'name', 'position', 'team', 'value', 'bye', 'id', 'updatedAt']
  });
  fs.writeFileSync(CSV_OUTPUT, csvData);
  console.log(`Saved CSV to ${CSV_OUTPUT}`);
}

async function main() {
  console.log('Starting ESPN cheat sheet download...');
  console.log('Output directory:', OUTPUT_DIR);
  
  try {
    const pdfBuffer = await downloadPdf();
    console.log('Parsing PDF content...');
    const pdfText = await parsePdfBuffer(pdfBuffer);
    const players = parsePdfText(pdfText);
    if (!players.length) {
      throw new Error('ESPN PDF parser extracted 0 players. Check the current PDF text layout before writing output.');
    }
    saveOutput(players);
    console.log('Done!');
    console.log(`✅ Successfully processed ${players.length} players.`);
    console.log(`📁 JSON output: ${JSON_OUTPUT}`);
    console.log(`📄 CSV output: ${CSV_OUTPUT}`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
