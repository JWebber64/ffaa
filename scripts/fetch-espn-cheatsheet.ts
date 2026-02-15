import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import { stringify } from 'csv-stringify/sync';
import slugify from 'slugify';

const ESPN_CHEATSHEET_URL = 'https://g.espncdn.com/s/ffldraftkit/25/NFL25_CS_PPR300.pdf?adddata=2025CS_PPR300';
const OUTPUT_DIR = path.join(process.cwd(), 'src', 'data');
const JSON_OUTPUT = path.join(OUTPUT_DIR, 'players-2025-espn.json');
const CSV_OUTPUT = path.join(OUTPUT_DIR, 'players-2025-espn.csv');

interface PlayerRow {
  rank: number;
  name: string;
  position: string;
  team: string;
  value: number;
  bye: number;
  id: string;
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
  try {
    const data = await pdf(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF parse error:', error);
    throw error;
  }
}

function parsePdfText(text: string): PlayerRow[] {
  console.log('Parsing PDF content...');
  const lines = text.split('\n').filter(line => line.trim());
  const players: PlayerRow[] = [];
  
  // ESPN PDF format: Rank Name, Pos Team $Value (Bye)
  const playerRegex = /^(\d+)\s+([A-Za-z'\-\. ]+?)\s+([A-Z/]+?)\s+([A-Z]+)\s+\$([\d,]+)\s+\((\d+)\)/;
  
  for (const line of lines) {
    const match = line.match(playerRegex);
    if (match) {
      const [_, rank, name, pos, team, value, bye] = match as [string, string, string, string, string, string, string];
      const position = pos === 'D/ST' ? 'DEF' : pos;
      
      const playerRank = parseInt(rank, 10);
      const playerName = name ? name.trim() : '';
      const playerValue = parseInt((value || '0').replace(/,/g, ''), 10);
      const playerBye = parseInt(bye || '0', 10);
      
      if (playerName && position && team) {
        players.push({
          rank: playerRank,
          name: playerName,
          position,
          team,
          value: playerValue,
          bye: playerBye,
          id: `2025-${position}-${slugify(playerName.toLowerCase(), { lower: true, strict: true })}`
        });
      }
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
    columns: ['rank', 'name', 'position', 'team', 'value', 'bye', 'id']
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
