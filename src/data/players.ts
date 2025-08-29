import type { Player } from '../store/draftStore';

// Utility function to generate player IDs
const generatePlayerIds = (position: string, count: number, startIndex = 1): string[] => {
  return Array.from({ length: count }, (_, i) => `${position}-${String(i + startIndex).padStart(3, '0')}`);
};

// Top 50 QBs
const qbIds = generatePlayerIds('QB', 50);
const qbs: Player[] = [
  { id: qbIds[0], name: 'Josh Allen', pos: 'QB', nflTeam: 'BUF' },
  { id: qbIds[1], name: 'Patrick Mahomes', pos: 'QB', nflTeam: 'KC' },
  { id: qbIds[2], name: 'Jalen Hurts', pos: 'QB', nflTeam: 'PHI' },
  { id: qbIds[3], name: 'Lamar Jackson', pos: 'QB', nflTeam: 'BAL' },
  { id: qbIds[4], name: 'Joe Burrow', pos: 'QB', nflTeam: 'CIN' },
  { id: qbIds[5], name: 'Justin Herbert', pos: 'QB', nflTeam: 'LAC' },
  { id: qbIds[6], name: 'Justin Fields', pos: 'QB', nflTeam: 'CHI' },
  { id: qbIds[7], name: 'Trevor Lawrence', pos: 'QB', nflTeam: 'JAX' },
  { id: qbIds[8], name: 'Dak Prescott', pos: 'QB', nflTeam: 'DAL' },
  { id: qbIds[9], name: 'Tua Tagovailoa', pos: 'QB', nflTeam: 'MIA' },
  { id: qbIds[10], name: 'Kirk Cousins', pos: 'QB', nflTeam: 'ATL' },
  { id: qbIds[11], name: 'Aaron Rodgers', pos: 'QB', nflTeam: 'NYJ' },
  // Add more QBs as needed
];

// Top 125 RBs
const rbIds = generatePlayerIds('RB', 125);
const rbs: Player[] = [
  { id: rbIds[0], name: 'Christian McCaffrey', pos: 'RB', nflTeam: 'SF' },
  { id: rbIds[1], name: 'Bijan Robinson', pos: 'RB', nflTeam: 'ATL' },
  { id: rbIds[2], name: 'Jonathan Taylor', pos: 'RB', nflTeam: 'IND' },
  { id: rbIds[3], name: 'Austin Ekeler', pos: 'RB', nflTeam: 'WAS' },
  { id: rbIds[4], name: 'Saquon Barkley', pos: 'RB', nflTeam: 'PHI' },
  { id: rbIds[5], name: 'Derrick Henry', pos: 'RB', nflTeam: 'BAL' },
  { id: rbIds[6], name: 'Breece Hall', pos: 'RB', nflTeam: 'NYJ' },
  { id: rbIds[7], name: 'Nick Chubb', pos: 'RB', nflTeam: 'CLE' },
  { id: rbIds[8], name: 'Tony Pollard', pos: 'RB', nflTeam: 'TEN' },
  { id: rbIds[9], name: 'Josh Jacobs', pos: 'RB', nflTeam: 'GB' },
  { id: rbIds[10], name: 'Rhamondre Stevenson', pos: 'RB', nflTeam: 'NE' },
  { id: rbIds[11], name: 'Travis Etienne', pos: 'RB', nflTeam: 'JAX' },
  { id: rbIds[12], name: 'Kenneth Walker', pos: 'RB', nflTeam: 'SEA' },
  { id: rbIds[13], name: 'Najee Harris', pos: 'RB', nflTeam: 'PIT' },
  { id: rbIds[14], name: 'Aaron Jones', pos: 'RB', nflTeam: 'MIN' },
  { id: rbIds[15], name: 'Joe Mixon', pos: 'RB', nflTeam: 'HOU' },
  { id: rbIds[16], name: 'Javonte Williams', pos: 'RB', nflTeam: 'DEN' },
  { id: rbIds[17], name: 'Dameon Pierce', pos: 'RB', nflTeam: 'HOU' },
  { id: rbIds[18], name: 'J.K. Dobbins', pos: 'RB', nflTeam: 'LAC' },
  { id: rbIds[19], name: 'Cam Akers', pos: 'RB', nflTeam: 'MIN' },
  { id: rbIds[20], name: 'David Montgomery', pos: 'RB', nflTeam: 'DET' },
  { id: rbIds[21], name: 'Alvin Kamara', pos: 'RB', nflTeam: 'NO' },
  { id: rbIds[22], name: 'James Conner', pos: 'RB', nflTeam: 'ARI' },
  { id: rbIds[23], name: 'Miles Sanders', pos: 'RB', nflTeam: 'CAR' },
  // Add more RBs as needed
];

// Top 150 WRs
const wrIds = generatePlayerIds('WR', 150);
const wrs: Player[] = [
  { id: wrIds[0], name: 'Justin Jefferson', pos: 'WR', nflTeam: 'MIN' },
  { id: wrIds[1], name: 'Ja\'Marr Chase', pos: 'WR', nflTeam: 'CIN' },
  { id: wrIds[2], name: 'Tyreek Hill', pos: 'WR', nflTeam: 'MIA' },
  { id: wrIds[3], name: 'CeeDee Lamb', pos: 'WR', nflTeam: 'DAL' },
  { id: wrIds[4], name: 'Amon-Ra St. Brown', pos: 'WR', nflTeam: 'DET' },
  { id: wrIds[5], name: 'Garrett Wilson', pos: 'WR', nflTeam: 'NYJ' },
  { id: wrIds[6], name: 'A.J. Brown', pos: 'WR', nflTeam: 'PHI' },
  { id: wrIds[7], name: 'Davante Adams', pos: 'WR', nflTeam: 'LV' },
  { id: wrIds[8], name: 'Jaylen Waddle', pos: 'WR', nflTeam: 'MIA' },
  { id: wrIds[9], name: 'Stefon Diggs', pos: 'WR', nflTeam: 'HOU' },
  { id: wrIds[10], name: 'DeVonta Smith', pos: 'WR', nflTeam: 'PHI' },
  { id: wrIds[11], name: 'Chris Olave', pos: 'WR', nflTeam: 'NO' },
  { id: wrIds[12], name: 'DK Metcalf', pos: 'WR', nflTeam: 'SEA' },
  { id: wrIds[13], name: 'Tee Higgins', pos: 'WR', nflTeam: 'CIN' },
  { id: wrIds[14], name: 'Deebo Samuel', pos: 'WR', nflTeam: 'SF' },
  { id: wrIds[15], name: 'Keenan Allen', pos: 'WR', nflTeam: 'CHI' },
  { id: wrIds[16], name: 'Calvin Ridley', pos: 'WR', nflTeam: 'TEN' },
  { id: wrIds[17], name: 'Terry McLaurin', pos: 'WR', nflTeam: 'WAS' },
  { id: wrIds[18], name: 'DeAndre Hopkins', pos: 'WR', nflTeam: 'TEN' },
  { id: wrIds[19], name: 'DJ Moore', pos: 'WR', nflTeam: 'CHI' },
  { id: wrIds[20], name: 'Tyler Lockett', pos: 'WR', nflTeam: 'SEA' },
  { id: wrIds[21], name: 'Brandon Aiyuk', pos: 'WR', nflTeam: 'SF' },
  { id: wrIds[22], name: 'Mike Evans', pos: 'WR', nflTeam: 'TB' },
  { id: wrIds[23], name: 'Chris Godwin', pos: 'WR', nflTeam: 'TB' },
  { id: wrIds[24], name: 'Jerry Jeudy', pos: 'WR', nflTeam: 'CLE' },
  { id: wrIds[25], name: 'Christian Watson', pos: 'WR', nflTeam: 'GB' },
  { id: wrIds[26], name: 'Drake London', pos: 'WR', nflTeam: 'ATL' },
  { id: wrIds[27], name: 'Tyler Lockett', pos: 'WR', nflTeam: 'SEA' },
  { id: wrIds[28], name: 'Diontae Johnson', pos: 'WR', nflTeam: 'CAR' },
  { id: wrIds[29], name: 'Christian Kirk', pos: 'WR', nflTeam: 'JAX' },
  { id: wrIds[30], name: 'Mike Williams', pos: 'WR', nflTeam: 'NYJ' },
  { id: wrIds[31], name: 'Brandin Cooks', pos: 'WR', nflTeam: 'DAL' },
  { id: wrIds[32], name: 'Jahan Dotson', pos: 'WR', nflTeam: 'WAS' },
  { id: wrIds[33], name: 'Kadarius Toney', pos: 'WR', nflTeam: 'KC' },
  { id: wrIds[34], name: 'Gabe Davis', pos: 'WR', nflTeam: 'JAX' },
  { id: wrIds[35], name: 'Marquise Brown', pos: 'WR', nflTeam: 'KC' },
  // Add more WRs as needed
];

// Top 50 TEs
const teIds = generatePlayerIds('TE', 50);
const tes: Player[] = [
  { id: teIds[0], name: 'Travis Kelce', pos: 'TE', nflTeam: 'KC' },
  { id: teIds[1], name: 'Mark Andrews', pos: 'TE', nflTeam: 'BAL' },
  { id: teIds[2], name: 'T.J. Hockenson', pos: 'TE', nflTeam: 'MIN' },
  { id: teIds[3], name: 'George Kittle', pos: 'TE', nflTeam: 'SF' },
  { id: teIds[4], name: 'Dallas Goedert', pos: 'TE', nflTeam: 'PHI' },
  { id: teIds[5], name: 'Darren Waller', pos: 'TE', nflTeam: 'NYG' },
  { id: teIds[6], name: 'Kyle Pitts', pos: 'TE', nflTeam: 'ATL' },
  { id: teIds[7], name: 'Evan Engram', pos: 'TE', nflTeam: 'JAX' },
  { id: teIds[8], name: 'Pat Freiermuth', pos: 'TE', nflTeam: 'PIT' },
  { id: teIds[9], name: 'David Njoku', pos: 'TE', nflTeam: 'CLE' },
  { id: teIds[10], name: 'Dalton Schultz', pos: 'TE', nflTeam: 'HOU' },
  { id: teIds[11], name: 'Tyler Higbee', pos: 'TE', nflTeam: 'LAR' },
  // Add more TEs as needed
];

// 32 Kickers
const kIds = generatePlayerIds('K', 32);
const ks: Player[] = [
  { id: kIds[0], name: 'Justin Tucker', pos: 'K', nflTeam: 'BAL' },
  { id: kIds[1], name: 'Harrison Butker', pos: 'K', nflTeam: 'KC' },
  { id: kIds[2], name: 'Tyler Bass', pos: 'K', nflTeam: 'BUF' },
  { id: kIds[3], name: 'Daniel Carlson', pos: 'K', nflTeam: 'LV' },
  { id: kIds[4], name: 'Evan McPherson', pos: 'K', nflTeam: 'CIN' },
  { id: kIds[5], name: 'Younghoe Koo', pos: 'K', nflTeam: 'ATL' },
  { id: kIds[6], name: 'Jake Elliott', pos: 'K', nflTeam: 'PHI' },
  { id: kIds[7], name: 'Jason Myers', pos: 'K', nflTeam: 'SEA' },
  { id: kIds[8], name: 'Brett Maher', pos: 'K', nflTeam: 'LAC' },
  { id: kIds[9], name: 'Jason Sanders', pos: 'K', nflTeam: 'MIA' },
  { id: kIds[10], name: 'Matt Gay', pos: 'K', nflTeam: 'IND' },
  { id: kIds[11], name: 'Greg Joseph', pos: 'K', nflTeam: 'GB' },
  // Add more Ks as needed
];

// 32 D/STs
const defIds = generatePlayerIds('DEF', 32);
const defs: Player[] = [
  { id: defIds[0], name: '49ers D/ST', pos: 'DEF', nflTeam: 'SF' },
  { id: defIds[1], name: 'Cowboys D/ST', pos: 'DEF', nflTeam: 'DAL' },
  { id: defIds[2], name: 'Eagles D/ST', pos: 'DEF', nflTeam: 'PHI' },
  { id: defIds[3], name: 'Patriots D/ST', pos: 'DEF', nflTeam: 'NE' },
  { id: defIds[4], name: 'Bills D/ST', pos: 'DEF', nflTeam: 'BUF' },
  { id: defIds[5], name: 'Ravens D/ST', pos: 'DEF', nflTeam: 'BAL' },
  { id: defIds[6], name: 'Jets D/ST', pos: 'DEF', nflTeam: 'NYJ' },
  { id: defIds[7], name: 'Browns D/ST', pos: 'DEF', nflTeam: 'CLE' },
  { id: defIds[8], name: 'Saints D/ST', pos: 'DEF', nflTeam: 'NO' },
  { id: defIds[9], name: 'Broncos D/ST', pos: 'DEF', nflTeam: 'DEN' },
  { id: defIds[10], name: 'Buccaneers D/ST', pos: 'DEF', nflTeam: 'TB' },
  { id: defIds[11], name: 'Commanders D/ST', pos: 'DEF', nflTeam: 'WAS' },
  // Add more D/STs as needed
];


// Combine all players
export const FALLBACK_PLAYERS: Player[] = [
  ...qbs,
  ...rbs,
  ...wrs,
  ...tes,
  ...ks,
  ...defs
];
