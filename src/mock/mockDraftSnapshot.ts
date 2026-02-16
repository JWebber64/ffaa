export type DraftPhase = "lobby" | "nominating" | "bidding" | "sold" | "paused";

export type Team = {
  teamId: string;
  name: string;
  budget: number;
  spent: number;
  roster: Array<{ playerId: string; name: string; price: number }>;
};

export type DraftSnapshot = {
  draftId: string;
  phase: DraftPhase;
  settings: {
    teamsCount: number;
    startingBudget: number;
    bidIncrements: number[];
    nominationSeconds: number;
    bidSeconds: number;
  };

  order: {
    currentNominatorTeamId: string;
    nominatingIndex: number; // 0-based in teams array
  };

  auction: {
    player: null | { playerId: string; name: string; pos?: string; team?: string };
    currentBid: number;
    highBidderTeamId: string | null;
    secondsLeft: number;
    call: "none" | "once" | "twice" | "sold";
  };

  teams: Team[];

  log: Array<{
    id: string;
    ts: string;
    type: "join" | "ready" | "nominate" | "bid" | "sold" | "system";
    text: string;
  }>;
};

export const MOCK_SNAPSHOT: DraftSnapshot = {
  draftId: "mock",
  phase: "bidding",
  settings: {
    teamsCount: 12,
    startingBudget: 200,
    bidIncrements: [1, 2, 5, 10],
    nominationSeconds: 30,
    bidSeconds: 20,
  },
  order: {
    currentNominatorTeamId: "t3",
    nominatingIndex: 2,
  },
  auction: {
    player: { playerId: "p-1001", name: "Justin Jefferson", pos: "WR", team: "MIN" },
    currentBid: 27,
    highBidderTeamId: "t7",
    secondsLeft: 14,
    call: "once",
  },
  teams: Array.from({ length: 12 }).map((_, i) => {
    const id = `t${i + 1}`;
    const spent = i === 6 ? 41 : i * 7;
    return {
      teamId: id,
      name: `Team ${i + 1}`,
      budget: 200,
      spent,
      roster:
        i === 6
          ? [
              { playerId: "p-11", name: "A.J. Brown", price: 31 },
              { playerId: "p-12", name: "Travis Kelce", price: 10 },
            ]
          : [],
    };
  }),
  log: [
    { id: "l1", ts: "00:00", type: "system", text: "Draft started. Team 3 is nominating." },
    { id: "l2", ts: "00:12", type: "nominate", text: "Team 3 nominated Justin Jefferson." },
    { id: "l3", ts: "00:15", type: "bid", text: "Team 7 bid $27." },
    { id: "l4", ts: "00:18", type: "system", text: "Going once…" },
  ],
};
