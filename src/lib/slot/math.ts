import {
  CELL_COUNT,
  COLS,
  PAY_SYMBOLS,
  ROWS,
  type GameConfig,
  type GridCell,
  type PaySymbol,
  type SpinMode,
  type SymbolId,
} from "./types";

/** Cluster pays as a multiple of total bet. Index 0 = size 5. */
export const PAYTABLE: Record<PaySymbol, number[]> = {
  cinder: [0.15, 0.2, 0.3, 0.4, 0.55, 0.8, 1.1, 1.6, 2.2, 3, 4.5],
  shard: [0.2, 0.3, 0.4, 0.55, 0.8, 1.1, 1.6, 2.2, 3.2, 4.5, 6.5],
  mark: [0.35, 0.5, 0.7, 1, 1.4, 2, 2.8, 4, 5.5, 8, 12],
  crown: [0.5, 0.7, 1, 1.4, 2, 2.8, 4, 6, 9, 13, 20],
  iris: [1, 1.4, 2, 2.8, 4, 6, 8.5, 13, 20, 30, 45],
  nova: [1.6, 2.4, 3.5, 5, 7.5, 11, 16, 24, 36, 55, 80],
};

/** Extra collect value (× bet) absorbed by adjacent Void Hearts. */
export const COLLECT: Record<PaySymbol | "wild", number> = {
  cinder: 0.02,
  shard: 0.03,
  mark: 0.05,
  crown: 0.08,
  iris: 0.14,
  nova: 0.22,
  wild: 0.1,
};

export const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

export const BETS = [0.1, 0.2, 0.4, 0.6, 1, 2, 4, 8, 20, 50, 100];
export const MIN_BET = BETS[0]!;
export const MAX_BET = BETS[BETS.length - 1]!;
export const ANTE_COST = 1.25;
export const BONUS_BUY_COST = 80;
/** 0 = uncapped. God spins can climb without a 1M ceiling. */
export const MAX_WIN_X = 0;
export const HEART_SPAWN_SIZE = 8;
export const MIN_CLUSTER = 5;
export const BASE_FREE_SPINS = 8;
export const MAX_WILD_MULT = 8;
export const MAX_STICKY_WILDS = 3;
export const MAX_HEARTS = 4;
export const BONUS_HEAT_CARRY = 3;
export const MAX_HEAT_INDEX = 7;

export type WeightTable = Record<Exclude<SymbolId, "heart">, number>;

export const BASE_WEIGHTS: WeightTable = {
  cinder: 190,
  shard: 175,
  mark: 155,
  crown: 125,
  iris: 85,
  nova: 55,
  wild: 14,
  tear: 10,
};

export const ANTE_WEIGHTS: WeightTable = {
  ...BASE_WEIGHTS,
  tear: 24,
};

export const BONUS_WEIGHTS: WeightTable = {
  cinder: 185,
  shard: 170,
  mark: 150,
  crown: 125,
  iris: 90,
  nova: 60,
  wild: 12,
  tear: 10,
};

export const SYMBOL_META: { id: SymbolId; name: string; role: string }[] = [
  { id: "cinder", name: "Cinder", role: "Low" },
  { id: "shard", name: "Shard", role: "Low" },
  { id: "mark", name: "Mark", role: "Mid" },
  { id: "crown", name: "Crown", role: "Mid" },
  { id: "iris", name: "Iris", role: "High" },
  { id: "nova", name: "Nova", role: "High" },
  { id: "wild", name: "Rift Crystal", role: "Wild — charges +1x when it pays, then sticks" },
  { id: "tear", name: "Tear", role: "Scatter — 3+ open Riftwalk" },
  { id: "heart", name: "Void Heart", role: "Collector — born from 8+ clusters" },
];

export function emptyCell(): GridCell {
  return { symbol: null, wildMult: 0, heartValue: 0 };
}

export function cloneCell(cell: GridCell): GridCell {
  return { symbol: cell.symbol, wildMult: cell.wildMult, heartValue: cell.heartValue };
}

export function cloneGrid(grid: GridCell[]): GridCell[] {
  return grid.map(cloneCell);
}

export function idx(row: number, col: number): number {
  return row * COLS + col;
}

export function rowOf(i: number): number {
  return Math.floor(i / COLS);
}

export function colOf(i: number): number {
  return i % COLS;
}

export function neighbors(i: number): number[] {
  const r = rowOf(i);
  const c = colOf(i);
  const out: number[] = [];
  if (r > 0) out.push(idx(r - 1, c));
  if (r < ROWS - 1) out.push(idx(r + 1, c));
  if (c > 0) out.push(idx(r, c - 1));
  if (c < COLS - 1) out.push(idx(r, c + 1));
  return out;
}

export function isPaySymbol(s: SymbolId | null): s is PaySymbol {
  return s !== null && (PAY_SYMBOLS as readonly string[]).includes(s);
}

export function isSticky(cell: GridCell): boolean {
  if (!cell.symbol) return false;
  if (cell.symbol === "heart") return true;
  if (cell.symbol === "wild" && cell.wildMult >= 2) return true;
  return false;
}

export function payFor(symbol: PaySymbol, size: number): number {
  const table = PAYTABLE[symbol];
  const i = Math.min(Math.max(size, MIN_CLUSTER), MIN_CLUSTER + table.length - 1) - MIN_CLUSTER;
  return table[i] ?? 0;
}

export function fibAt(heatIndex: number): number {
  return FIBONACCI[Math.min(Math.max(heatIndex, 0), FIBONACCI.length - 1)] ?? 1;
}

export function round2(n: number): number {
  return Math.round(n * 100 + (n >= 0 ? 1e-8 : -1e-8)) / 100;
}

export function formatCredits(n: number): string {
  if (Math.abs(n) >= 10_000) {
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function scatterSpins(count: number): number {
  if (count >= 6) return 15;
  if (count >= 5) return 12;
  if (count >= 4) return 10;
  if (count >= 3) return BASE_FREE_SPINS;
  return 0;
}

export function spinCost(bet: number, mode: SpinMode): number {
  if (mode === "ante") return round2(bet * ANTE_COST);
  if (mode === "bonus-buy") return round2(bet * BONUS_BUY_COST);
  return round2(bet);
}

export function getGameConfig(): GameConfig {
  return {
    name: "Aether Rift",
    version: "1.0.0",
    rtp: "96.2%",
    volatility: "Very High",
    rows: ROWS,
    cols: COLS,
    minBet: MIN_BET,
    maxBet: MAX_BET,
    bets: BETS,
    anteCost: ANTE_COST,
    bonusBuyCost: BONUS_BUY_COST,
    maxWinX: MAX_WIN_X,
    currency: "CR",
    paytable: PAYTABLE,
    collect: COLLECT,
    fibonacci: FIBONACCI,
    symbols: SYMBOL_META,
  };
}

export function defaultGrid(): GridCell[] {
  return Array.from({ length: CELL_COUNT }, emptyCell);
}

export function previewGrid(): GridCell[] {
  const pool: Array<GridCell["symbol"]> = [
    "cinder",
    "shard",
    "mark",
    "crown",
    "iris",
    "nova",
    "wild",
    "tear",
    "heart",
  ];
  return Array.from({ length: CELL_COUNT }, (_, i) => {
    const symbol = pool[i % pool.length]!;
    return {
      symbol,
      wildMult: symbol === "wild" ? 1 : 0,
      heartValue: symbol === "heart" ? 0.4 : 0,
    };
  });
}

