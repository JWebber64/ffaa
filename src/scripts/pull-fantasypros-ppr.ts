/* eslint-disable no-console */
// @ts-ignore - node-fetch types are not needed for ESM
import fetch from "node-fetch";
import * as fs from "node:fs/promises";
import path from "node:path";
import slugify from "slugify";
import * as cheerio from "cheerio";
import { stringify } from "csv-stringify";
import type { Position } from "@/types/draft";

// Team mapping for normalization
const teamMap: Record<string, string> = {
  'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BUF': 'BUF', 'CAR': 'CAR',
  'CHI': 'CHI', 'CIN': 'CIN', 'CLE': 'CLE', 'DAL': 'DAL', 'DEN': 'DEN',
  'DET': 'DET', 'GB': 'GB', 'HOU': 'HOU', 'IND': 'IND', 'JAC': 'JAX',
  'JAX': 'JAX', 'KC': 'KC', 'LAC': 'LAC', 'LAR': 'LAR', 'LV': 'LV',
  'MIA': 'MIA', 'MIN': 'MIN', 'NE': 'NE', 'NO': 'NO', 'NYG': 'NYG',
  'NYJ': 'NYJ', 'OAK': 'LV', 'PHI': 'PHI', 'PIT': 'PIT', 'SD': 'LAC',
  'SEA': 'SEA', 'SF': 'SF', 'STL': 'LAR', 'TB': 'TB', 'TEN': 'TEN',
  'WAS': 'WAS'
};

// Function to normalize team abbreviations
function normTeam(team: string): string {
  if (!team) return '';
  const upperTeam = team.toUpperCase();
  return teamMap[upperTeam] || '';
}

// Function to check if a player is a kicker
function isKicker(name: string): boolean {
  if (!name) return false;
  const lowerName = name.toLowerCase();
  return lowerName.includes('kicker') || 
         name.split(' ').some(part => part.toUpperCase() === 'K') ||
         /\bK\b/.test(name);
}


const FP_URL_PRIMARY = "https://www.fantasypros.com/nfl/cheatsheets/top-ppr-players.php"; // Overall PPR
const FP_URL_BACKUP = "https://www.fantasypros.com/nfl/adp/ppr-overall.php";             // ADP PPR overall

type Pos = Position;
interface Row {
  id: string;
  season: number;
  source: "FantasyPros ECR" | "FantasyPros ADP";
  rank: number;           // overall
  name: string;
  pos: Pos;
  nflTeam: string;
}

const OUT_JSON = path.resolve("src/data/players-2025-fantasypros.json");
const OUT_CSV = path.resolve("src/data/players-2025-fantasypros.csv");

function toSlug(s: string) {
  return slugify(s, { lower: true, strict: true });
}


function normPos(p: string, playerName: string = ''): Position {
  const cleanP = p.trim().toUpperCase();
  
  // Handle special cases first
  if (cleanP === 'DST' || cleanP === 'D/ST') return 'DEF';
  if (cleanP === 'PK') return 'K';
  
  // Check standard positions
  if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(cleanP)) {
    return cleanP as Position;
  }
  
  // Try to determine position from name if it's a known kicker
  if (isKicker(playerName)) {
    return 'K';
  }
  
  // If position is empty or unknown, try to infer from player name
  if (!cleanP) {
    // Try to infer position from player name patterns
    const name = playerName.toLowerCase();
    if (name.includes('defense') || name.includes('d/st')) return 'DEF';
    if (name.includes('kicker') || name.includes(' k ')) return 'K';
    
    // Default to 'UNK' if we can't determine the position
    return 'UNK' as Position;
  }
  
  // If we get here, we have a position but it's not standard
  console.warn(`Unknown position '${cleanP}' for player '${playerName}'. Defaulting to 'UNK'.`);
  return 'UNK' as Position;
}

/** Parse Primary page (Overall PPR list) */
function parsePrimary(html: string): Row[] {
  console.log('Parsing primary data...');
  const $ = cheerio.load(html);
  const items: Row[] = [];
  
  // Try ordered list first
  $("ol li, .players ol li").each((_i: number, el) => {
    const text = $(el).text().replace(/\u00A0/g, " ").trim();
    // Example: "1. Ja'Marr Chase WR-CIN"
    const m = text.match(/^\s*(\d+)\.\s+(.+?)\s+([A-Z]{1,3})-([A-Z]{2,3})\s*$/);
    if (!m) return;
    const rank = Number(m[1]);
    const name = m[2]?.trim() || '';
    const pos = normPos(m[3] || '');
    const team = normTeam(m[4] || '');
    items.push({
      id: `2025-${pos}-${toSlug(name)}`,
      season: 2025,
      source: "FantasyPros ECR",
      rank, name, pos, nflTeam: team
    });
  });

  // Fallback: table rows
  if (!items.length) {
    $("table tr").each((_i: number, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 3) return;
      const rank = Number($(tds[0]).text().trim());
      const nameTeam = $(tds[1]).text().replace(/\u00A0/g, " ").trim();
      const posTxt = $(tds[2]).text().trim();
      if (!rank || !nameTeam || !posTxt) return;
      const mt = nameTeam.match(/^(.+?)\s+([A-Z]{2,3})$/);
      if (!mt) return;
      const name = mt[1]?.trim() || '';
      const team = normTeam(mt[2] || '');
      const pos = normPos(posTxt);
      items.push({
        id: `2025-${pos}-${toSlug(name)}`,
        season: 2025,
        source: "FantasyPros ECR",
        rank, name, pos, nflTeam: team
      });
    });
  }

  console.log(`Parsed ${items.length} players from primary source`);
  return items;
}

/** Parse Backup (ADP overall) */
function parseBackup(html: string): Row[] {
  console.log('Parsing backup data...');
  const $ = cheerio.load(html);
  const rows: Row[] = [];
  
  // Try different table selectors to handle different page structures
  const tables = $('table.player-table, table.table, table');
  
  if (!tables.length) {
    console.log('No tables found in the HTML');
    return [];
  }
  
  tables.first().find('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 3) return; // Skip header rows and rows with insufficient data
    
    try {
      // Try to extract data from different column positions
      let rank = 0;
      let name = '';
      let team = '';
      let pos = '';
      
      // Try to find rank in first column
      rank = parseInt($(tds[0]).text().trim(), 10) || 0;
      
      // Try to find name in second column
      name = $(tds[1]).find('a.player-name').text().trim() || $(tds[1]).text().trim();
      
      // Try to find team and position in third column
      const teamPosText = $(tds[2]).text().trim();
      
      // First, try to extract position from the name column (common pattern: "Name POS")
      const namePosMatch = name.match(/([A-Z]{1,3})$/);
      if (namePosMatch && namePosMatch[1]) {
        pos = normPos(namePosMatch[1], name);
        name = name.replace(/\s+[A-Z]{1,3}$/, '').trim();
      }
      
      // Try to extract team and position from the HTML structure
      if (teamPosText) {
        // First, check if this is a kicker by position or name
        const isPlayerKicker = pos === 'K' || name.toLowerCase().includes('kicker') || 
                             name.split(' ').some(part => part.toLowerCase() === 'k');
        
        // Try different patterns to extract team and position
        // Pattern 1: Standard format "TEAM POS" (e.g., "DAL K")
        const teamPosMatch = teamPosText.match(/^([A-Z]{2,3})\s*([A-Z]{1,3})?$/);
        
        if (teamPosMatch?.[1]) {
          team = normTeam(teamPosMatch[1]);
          if (teamPosMatch[2]) {
            pos = normPos(teamPosMatch[2], name);
          }
        } 
        // Pattern 2: Just team or position
        else if (/^[A-Z]{2,3}$/.test(teamPosText)) {
          // Check if it's a valid team abbreviation
          const teamAbbrev = teamPosText as keyof typeof teamMap;
          if (teamMap[teamAbbrev]) {
            team = normTeam(teamAbbrev);
          } 
          // Otherwise, treat it as position if it's a valid position
          else if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(teamPosText)) {
            pos = normPos(teamPosText, name);
          }
        }
        
        // Special handling for kickers - sometimes team is in the name column
        if (isPlayerKicker && !team) {
          // Try to find team in the name (e.g., "Brandon Aubrey DAL")
          const teamFromName = name.split(' ').pop();
          if (teamFromName && teamFromName.length <= 3 && /^[A-Z]+$/.test(teamFromName)) {
            const potentialTeam = normTeam(teamFromName);
            if (potentialTeam) {
              team = potentialTeam;
              name = name.replace(new RegExp(`\\s*${teamFromName}$`), '').trim();
            }
          }
        }
        
        // If we still don't have a team, try to find it in the name
        if (!team) {
          const nameTeamMatch = name.match(/([A-Z]{2,3})\s*$/);
          if (nameTeamMatch?.[1]) {
            team = normTeam(nameTeamMatch[1]);
            name = name.replace(/\s*[A-Z]{2,3}\s*$/, '').trim();
          }
        }
        
        // If we're dealing with a kicker and still don't have a team,
        // try to find it in the player's name (some kickers have team abbreviations in their names)
        if (!team && (pos === 'K' || isKicker(name))) {
          const potentialTeam = name.split(' ').find(part => 
            part.length === 2 || part.length === 3
          );
          if (potentialTeam && /^[A-Z]{2,3}$/.test(potentialTeam)) {
            team = normTeam(potentialTeam);
            name = name.replace(new RegExp(`\\s*${potentialTeam}\\s*$`, 'i'), '').trim();
          }
        }
      }
      
      // If we still don't have a position, try to get it from the name or default to K for kickers
      if (!pos) {
        if (name.toLowerCase().includes('kicker') || name.split(' ').some(part => part.toLowerCase() === 'k')) {
          pos = 'K';
        } else {
          pos = normPos('', name);
        }
      }
      
      // If we still don't have position, try to find it in the name or other columns
      if (!pos && tds.length > 3) {
        const posMatch = $(tds[3]).text().trim().match(/^[A-Z]{1,3}$/);
        if (posMatch) {
          pos = normPos(posMatch[0]);
        }
      }
      
      // Clean up the name - remove any remaining position/team info and extra spaces
      name = name
        .replace(/\s+[A-Z]{1,3}\s*$/, '')  // Remove position at end
        .replace(/\s*\([^)]*\)\s*$/, '')  // Remove anything in parentheses at end
        .replace(/\s*\[[^\]]*\]\s*$/, '')  // Remove anything in brackets at end
        .replace(/\s*[A-Z]{2,3}\s*$/, '')  // Remove team at end (2-3 uppercase letters)
        .replace(/\s*,\s*$/, '')           // Remove trailing comma and any whitespace
        .replace(/\s{2,}/g, ' ')            // Replace multiple spaces with one
        .trim()
        // Remove any remaining non-alphabetic characters at the end
        .replace(/[^a-zA-Z0-9\s-]+$/, '')
        // Remove any remaining team abbreviations that might be at the end of the name
        .replace(/\s+(?:[A-Z]{2,3}|[A-Z]{2,3}K?|K[A-Z]{2,3})$/i, '')
        .trim()
        // Remove any single letters at the end that might be leftover
        .replace(/\s+[A-Z]$/i, '')
        .trim();
      
      // We need rank, name, position, and team
      if (!rank || !name || !pos || !team) {
        console.log('Skipping row - missing required data:', { rank, name, team, pos });
        return;
      }
      
      // Ensure pos is a valid Position type
      type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "UNK";
      const validPos: Position = pos as Position;
      
      rows.push({
        id: `2025-${validPos}-${toSlug(name)}`,
        season: 2025,
        source: "FantasyPros ADP",
        rank,
        name,
        pos: validPos,
        nflTeam: team
      });
    } catch (error) {
      console.error('Error parsing row:', error);
    }
  });
  
  console.log(`Parsed ${rows.length} players from backup source`);
  return rows;
}

async function pull(url: string) {
  console.log(`Fetching URL: ${url}`);
  try {
    const res = await fetch(url, { 
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" 
      } 
    });
    console.log(`Response status: ${res.status} ${res.statusText}`);
    if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Fetched ${text.length} characters`);
    return text;
  } catch (error) {
    console.error('Error in pull function:', error);
    throw error;
  }
}

async function main() {
  console.log('Starting FantasyPros data fetch...');
  let data: Row[] = [];
  
  try {
    console.log('Fetching primary data from:', FP_URL_PRIMARY);
    const html = await pull(FP_URL_PRIMARY);
    data = parsePrimary(html);
  } catch (e) {
    console.warn("Primary fetch/parse failed, trying backup…");
    console.error(e);
  }
  
  if (!data.length) {
    try {
      console.log('Fetching backup data from:', FP_URL_BACKUP);
      const html2 = await pull(FP_URL_BACKUP);
      data = parseBackup(html2);
    } catch (e) {
      console.error('Backup fetch/parse also failed:', e);
      throw new Error('Could not fetch data from any source');
    }
  }
  
  if (!data.length) throw new Error("No players parsed from FantasyPros.");

  // De-dup by id and sort by rank
  console.log('Processing data...');
  const map = new Map<string, Row>();
  for (const r of data) if (!map.has(r.id)) map.set(r.id, r);
  const unique = [...map.values()].sort((a, b) => a.rank - b.rank);

  // Write JSON
  console.log(`Writing ${unique.length} players to ${OUT_JSON}`);
  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify(unique, null, 2), "utf8");

  // Write CSV
  console.log(`Writing CSV to ${OUT_CSV}`);
  await fs.mkdir(path.dirname(OUT_CSV), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const stringifier = stringify(
      unique.map(r => ({
        id: r.id,
        season: r.season,
        source: r.source,
        rank: r.rank,
        name: r.name,
        pos: r.pos,
        nflTeam: r.nflTeam
      })),
      { header: true, columns: ["id", "season", "source", "rank", "name", "pos", "nflTeam"] }
    );

    stringifier
      .on('readable', function() {
        let chunk: Buffer;
        while ((chunk = stringifier.read() as Buffer) !== null) {
          chunks.push(chunk);
        }
      })
      .on('error', reject)
      .on('end', async () => {
        try {
          await fs.writeFile(OUT_CSV, Buffer.concat(chunks));
          resolve();
        } catch (err) {
          reject(err);
        }
      });
  });

  console.log('\nDone!');
  console.log(`- Wrote ${unique.length} players to ${OUT_JSON}`);
  console.log(`- Wrote CSV to ${OUT_CSV}`);
}

// Run the main function
main().catch(e => { 
  console.error('Error in main function:', e); 
  process.exit(1); 
});
