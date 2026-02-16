export type StylePackId = "classic" | "rodeo" | "posh" | "comedian";

export const STYLE_PACKS: Record<StylePackId, any> = {
  classic: {
    label: "Classic",
    bid: (team: string, amount: number) => `${team} bids $${amount}.`,
    once: () => "Going once…",
    twice: () => "Going twice…",
    sold: (team: string, amount: number) =>
      `Sold to ${team} for $${amount}.`,
  },

  rodeo: {
    label: "Rodeo",
    bid: (team: string, amount: number) =>
      `${team} throws down $${amount}!`,
    once: () => "I hear ya once!",
    twice: () => "Twice now, don't blink!",
    sold: (team: string, amount: number) =>
      `Hammer down! ${team} takes it for $${amount}!`,
  },

  posh: {
    label: "Posh Art House",
    bid: (team: string, amount: number) =>
      `${team} delicately increases to $${amount}.`,
    once: () => "A refined pause… once.",
    twice: () => "Twice… shall we conclude?",
    sold: (team: string, amount: number) =>
      `Exquisite. ${team} secures it for $${amount}.`,
  },

  comedian: {
    label: "Comedian",
    bid: (team: string, amount: number) =>
      `${team} says "eh, why not" at $${amount}.`,
    once: () => "Once! Don't make me beg.",
    twice: () => "Twice! I've got dinner plans.",
    sold: (team: string, amount: number) =>
      `Boom. ${team} overpaid at $${amount}.`,
  },
};
