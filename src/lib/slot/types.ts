export const ROWS = 5;
export const COLS = 5;
export const CELL_COUNT = ROWS * COLS;

export const PAY_SYMBOLS = [
  "cinder",
  "shard",
  "mark",
  "crown",
  "iris",
  "nova",
] as const;

export type PaySymbol = (typeof PAY_SYMBOLS)[number];

export type SymbolId = PaySymbol | "wild" | "tear" | "heart";

export type SpinMode = "base" | "ante" | "bonus-buy";

export type GridCell = {
  symbol: SymbolId | null;
  wildMult: number;
  heartValue: number;
};

export type Explosion = {
  symbol: PaySymbol;
  cells: number[];
  size: number;
  pay: number;
  wildFactor: number;
};

export type TumbleStep = {
  explosions: Explosion[];
  heartSpawns: number[];
  wildCharges: { index: number; mult: number }[];
  collects: { index: number; added: number; total: number }[];
  heatIndex: number;
  multiplier: number;
  stepWin: number;
  gridAfterExplode: GridCell[];
  gridAfterFill: GridCell[];
  drops: { from: number; to: number }[];
  newCells: number[];
};

export type HeartDetonation = {
  index: number;
  value: number;
  pay: number;
};

export type EclipseEvent = {
  cells: number[];
  pay: number;
};

export type StickyPiece = {
  index: number;
  kind: "heart" | "wild";
  heartValue?: number;
  wildMult?: number;
};

export type BonusState = {
  v: 1;
  bet: number;
  spinsLeft: number;
  heatIndex: number;
  sticky: StickyPiece[];
  accumulatedWin: number;
  exp: number;
};

export type SpinResult = {
  roundId: string;
  seed: number;
  bet: number;
  cost: number;
  mode: SpinMode;
  initialGrid: GridCell[];
  finalGrid: GridCell[];
  tumbles: TumbleStep[];
  detonations: HeartDetonation[];
  eclipse: EclipseEvent | null;
  totalWin: number;
  accumulatedWin: number;
  scatterCount: number;
  bonusAward: { spins: number } | null;
  bonusToken: string | null;
  spinsLeft: number;
  inBonus: boolean;
  bonusComplete: boolean;
  heatIndex: number;
  multiplier: number;
  capped: boolean;
};

export type GameConfig = {
  name: string;
  version: string;
  rtp: string;
  volatility: string;
  rows: number;
  cols: number;
  minBet: number;
  maxBet: number;
  bets: number[];
  anteCost: number;
  bonusBuyCost: number;
  maxWinX: number;
  currency: string;
  paytable: Record<PaySymbol, number[]>;
  collect: Record<PaySymbol | "wild", number>;
  fibonacci: number[];
  symbols: { id: SymbolId; name: string; role: string }[];
};

export type IframeMessage =
  | { channel: "aether-rift"; v: 1; type: "ready" }
  | { channel: "aether-rift"; v: 1; type: "resize"; height: number }
  | {
      channel: "aether-rift";
      v: 1;
      type: "txn.request";
      id: string;
      kind: "debit" | "credit";
      amount: number;
      roundId: string;
      reason: string;
    }
  | {
      channel: "aether-rift";
      v: 1;
      type: "round.start";
      roundId: string;
      bet: number;
      cost: number;
    }
  | {
      channel: "aether-rift";
      v: 1;
      type: "round.end";
      roundId: string;
      bet: number;
      win: number;
    }
  | { channel: "aether-rift"; v: 1; type: "balance.sync"; balance: number };

export type HostMessage =
  | {
      channel: "aether-rift";
      v: 1;
      type: "init";
      balance: number;
      currency?: string;
      minBet?: number;
      maxBet?: number;
      autoConfirm?: boolean;
    }
  | {
      channel: "aether-rift";
      v: 1;
      type: "txn.result";
      id: string;
      ok: boolean;
      balance?: number;
      error?: string;
    }
  | { channel: "aether-rift"; v: 1; type: "balance.set"; balance: number }
  | { channel: "aether-rift"; v: 1; type: "mute"; muted: boolean };
