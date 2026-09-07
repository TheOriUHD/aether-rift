import {
  ANTE_WEIGHTS,
  BASE_WEIGHTS,
  BONUS_HEAT_CARRY,
  BONUS_WEIGHTS,
  COLLECT,
  HEART_SPAWN_SIZE,
  MAX_HEARTS,
  MAX_HEAT_INDEX,
  MAX_WILD_MULT,
  MIN_CLUSTER,
  cloneGrid,
  colOf,
  emptyCell,
  fibAt,
  idx,
  isPaySymbol,
  isSticky,
  neighbors,
  payFor,
  round2,
  rowOf,
  scatterSpins,
  spinCost,
  type WeightTable,
} from "./math";
import { COLS, PAY_SYMBOLS, ROWS, type BonusState, type Explosion, type GridCell, type PaySymbol, type SpinMode, type SpinResult, type StickyPiece, type TumbleStep } from "./types";
import { mulberry32, pickWeighted, randomSeed, roundId, type Rng } from "./rng";

function matches(cell: GridCell, symbol: PaySymbol): boolean {
  return cell.symbol === symbol || cell.symbol === "wild";
}

function wildFactorOf(grid: GridCell[], cells: number[]): number {
  let max = 0;
  for (const i of cells) {
    const cell = grid[i]!;
    if (cell.symbol === "wild") max = Math.max(max, Math.max(1, cell.wildMult));
  }
  return max > 0 ? max : 1;
}

export function findClusters(grid: GridCell[]): Explosion[] {
  const found: Explosion[] = [];
  for (const symbol of PAY_SYMBOLS) {
    const visited = new Set<number>();
    for (let i = 0; i < grid.length; i++) {
      if (visited.has(i) || grid[i]!.symbol !== symbol) continue;
      const cells: number[] = [];
      const q = [i];
      visited.add(i);
      while (q.length) {
        const cur = q.pop()!;
        cells.push(cur);
        for (const n of neighbors(cur)) {
          if (visited.has(n)) continue;
          if (!matches(grid[n]!, symbol)) continue;
          visited.add(n);
          q.push(n);
        }
      }
      const real = cells.filter((c) => grid[c]!.symbol === symbol).length;
      if (real >= 1 && cells.length >= MIN_CLUSTER) {
        found.push({
          symbol,
          cells: cells.sort((a, b) => a - b),
          size: cells.length,
          pay: 0,
          wildFactor: wildFactorOf(grid, cells),
        });
      }
    }
  }
  return found;
}

export function applyGravity(grid: GridCell[]): { grid: GridCell[]; drops: { from: number; to: number }[] } {
  const next = cloneGrid(grid);
  const drops: { from: number; to: number }[] = [];
  for (let col = 0; col < COLS; col++) {
    const moving: { cell: GridCell; fromRow: number }[] = [];
    for (let row = ROWS - 1; row >= 0; row--) {
      const i = idx(row, col);
      const cell = next[i]!;
      if (isSticky(cell)) continue;
      if (cell.symbol) {
        moving.push({ cell: { ...cell }, fromRow: row });
        next[i] = emptyCell();
      } else {
        next[i] = emptyCell();
      }
    }
    let place = ROWS - 1;
    for (const item of moving) {
      while (place >= 0 && isSticky(next[idx(place, col)]!)) place -= 1;
      if (place < 0) break;
      const to = idx(place, col);
      next[to] = item.cell;
      if (item.fromRow !== place) drops.push({ from: idx(item.fromRow, col), to });
      place -= 1;
    }
  }
  return { grid: next, drops };
}

export function fillEmpties(grid: GridCell[], rng: Rng, weights: WeightTable): { grid: GridCell[]; newCells: number[] } {
  const next = cloneGrid(grid);
  const newCells: number[] = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = ROWS - 1; row >= 0; row--) {
      const i = idx(row, col);
      if (next[i]!.symbol) continue;
      const symbol = pickWeighted(rng, weights);
      next[i] = {
        symbol,
        wildMult: symbol === "wild" ? 1 : 0,
        heartValue: 0,
      };
      newCells.push(i);
    }
  }
  return { grid: next, newCells };
}

export function generateGrid(rng: Rng, weights: WeightTable, sticky: StickyPiece[] = []): GridCell[] {
  const { grid } = fillEmpties(Array.from({ length: ROWS * COLS }, emptyCell), rng, weights);
  for (const piece of sticky) {
    if (piece.index < 0 || piece.index >= grid.length) continue;
    if (piece.kind === "heart") {
      grid[piece.index] = { symbol: "heart", wildMult: 0, heartValue: piece.heartValue ?? 0 };
    } else {
      grid[piece.index] = { symbol: "wild", wildMult: Math.max(2, piece.wildMult ?? 2), heartValue: 0 };
    }
  }
  return grid;
}

function extractSticky(grid: GridCell[]): StickyPiece[] {
  const hearts: StickyPiece[] = [];
  grid.forEach((cell, index) => {
    if (cell.symbol === "heart") {
      hearts.push({ index, kind: "heart", heartValue: cell.heartValue });
    }
  });
  return hearts.slice(0, MAX_HEARTS);
}

function countTears(grid: GridCell[]): number {
  return grid.filter((c) => c.symbol === "tear").length;
}

export function weightsFor(mode: SpinMode, inBonus: boolean): WeightTable {
  if (inBonus) return BONUS_WEIGHTS;
  if (mode === "ante") return ANTE_WEIGHTS;
  return BASE_WEIGHTS;
}

export type EngineInput = {
  bet: number;
  mode: SpinMode;
  seed?: number;
  bonus?: BonusState | null;
};

export function playSpin(input: EngineInput): SpinResult {
  const seed = input.seed ?? randomSeed();
  const rng = mulberry32(seed);
  const bet = input.bet;
  const inBonus = Boolean(input.bonus && input.bonus.spinsLeft > 0);
  const mode: SpinMode = inBonus ? "base" : input.mode;
  const weights = weightsFor(mode, inBonus);
  const cost = inBonus ? 0 : spinCost(bet, input.mode);

  let heatIndex = inBonus ? input.bonus!.heatIndex : 0;
  let grid = generateGrid(rng, weights, inBonus ? input.bonus!.sticky : []);
  const initialGrid = cloneGrid(grid);
  const scatterCount = countTears(initialGrid);

  const tumbles: TumbleStep[] = [];
  let spinWin = 0;
  let eclipsed = false;
  let eclipse: SpinResult["eclipse"] = null;

  for (let safety = 0; safety < 16; safety++) {
    const clusters = findClusters(grid);
    if (clusters.length === 0) break;

    const multiplier = inBonus ? fibAt(heatIndex) : 1;
    const exploding = new Set<number>();
    const explosions: Explosion[] = [];
    const wildCharges: { index: number; mult: number }[] = [];
    let stepWin = 0;

    for (const cluster of clusters) {
      const factor = wildFactorOf(grid, cluster.cells);
      const pay = round2(payFor(cluster.symbol, cluster.size) * bet * factor * multiplier);
      explosions.push({ ...cluster, pay, wildFactor: factor });
      stepWin = round2(stepWin + pay);
      for (const i of cluster.cells) {
        const cell = grid[i]!;
        if (isPaySymbol(cell.symbol)) exploding.add(i);
        if (cell.symbol === "wild") {
          cell.wildMult = Math.min(MAX_WILD_MULT, Math.max(1, cell.wildMult) + 1);
          wildCharges.push({ index: i, mult: cell.wildMult });
        }
      }
    }

    const collects: TumbleStep["collects"] = [];
    for (const i of exploding) {
      const exploded = grid[i]!;
      const key = exploded.symbol === "wild" ? "wild" : exploded.symbol;
      if (!key || key === "tear" || key === "heart") continue;
      const added = round2((COLLECT[key as PaySymbol | "wild"] ?? 0) * bet);
      for (const n of neighbors(i)) {
        const nb = grid[n]!;
        if (nb.symbol !== "heart") continue;
        nb.heartValue = round2(nb.heartValue + added);
        collects.push({ index: n, added, total: nb.heartValue });
      }
    }

    const heartSpawns: number[] = [];
    const spawnTaken = new Set<number>();
    const heartCount = grid.filter((c) => c.symbol === "heart").length;
    for (const cluster of explosions) {
      if (cluster.size < HEART_SPAWN_SIZE) continue;
      if (heartCount + heartSpawns.length >= MAX_HEARTS) break;
      const candidates = cluster.cells.filter((i) => exploding.has(i) && !spawnTaken.has(i));
      if (!candidates.length) continue;
      const pick = candidates[Math.floor(rng() * candidates.length)]!;
      spawnTaken.add(pick);
      heartSpawns.push(pick);
    }

    for (const i of exploding) {
      if (spawnTaken.has(i)) {
        grid[i] = { symbol: "heart", wildMult: 0, heartValue: 0 };
      } else {
        grid[i] = emptyCell();
      }
    }

    spinWin = round2(spinWin + stepWin);
    const gridAfterExplode = cloneGrid(grid);
    const grav = applyGravity(grid);
    const filled = fillEmpties(grav.grid, rng, weights);
    grid = filled.grid;

    tumbles.push({
      explosions,
      heartSpawns,
      wildCharges,
      collects,
      heatIndex,
      multiplier,
      stepWin,
      gridAfterExplode,
      gridAfterFill: cloneGrid(grid),
      drops: grav.drops,
      newCells: filled.newCells,
    });

    heatIndex += inBonus ? 1 : 0;
    if (heatIndex > MAX_HEAT_INDEX) heatIndex = MAX_HEAT_INDEX;
  }

  const hearts = grid
    .map((c, i) => ({ c, i }))
    .filter((x) => x.c.symbol === "heart");

  if (!eclipsed && hearts.length >= 3) {
    const cells: number[] = [];
    let pay = 0;
    const multiplier = inBonus ? fibAt(Math.max(0, heatIndex - (tumbles.length ? 1 : 0))) : 1;
    grid.forEach((cell, i) => {
      if (!isPaySymbol(cell.symbol) && cell.symbol !== "wild") return;
      const key = cell.symbol === "wild" ? "wild" : cell.symbol;
      const added = round2((COLLECT[key as PaySymbol | "wild"] ?? 0) * bet * multiplier);
      pay = round2(pay + added);
      const share = round2(added / hearts.length);
      for (const h of hearts) h.c.heartValue = round2(h.c.heartValue + share);
      cells.push(i);
      if (isPaySymbol(cell.symbol)) grid[i] = emptyCell();
    });
    if (cells.length) {
      eclipse = { cells, pay };
      spinWin = round2(spinWin + pay);
      const grav = applyGravity(grid);
      const filled = fillEmpties(grav.grid, rng, weights);
      grid = filled.grid;
    }
    eclipsed = true;
  }

  const lastSpinOfBonus = inBonus && input.bonus!.spinsLeft <= 1;
  const shouldDetonate = !inBonus || lastSpinOfBonus;
  const detonations: SpinResult["detonations"] = [];
  if (shouldDetonate) {
    const multiplier = inBonus ? fibAt(Math.max(0, heatIndex - (tumbles.length ? 1 : 0))) : 1;
    grid.forEach((cell, i) => {
      if (cell.symbol !== "heart") return;
      const pay = round2(cell.heartValue * multiplier);
      detonations.push({ index: i, value: cell.heartValue, pay });
      spinWin = round2(spinWin + pay);
      if (!inBonus || lastSpinOfBonus) grid[i] = emptyCell();
      else cell.heartValue = 0;
    });
  }

  let spinsAwarded = scatterSpins(scatterCount);
  let bonus: BonusState | null = null;
  let bonusAward: SpinResult["bonusAward"] = null;
  let spinsLeft = 0;
  let bonusComplete = false;
  let bonusToken: string | null = null;
  let accumulatedWin = spinWin;

  if (inBonus) {
    const prev = input.bonus!;
    spinsLeft = Math.max(0, prev.spinsLeft - 1);
    if (scatterCount >= 5) spinsLeft += 3;
    else if (scatterCount >= 4) spinsLeft += 2;
    else if (scatterCount >= 3) spinsLeft += 1;
    accumulatedWin = round2(prev.accumulatedWin + spinWin);
    bonusComplete = spinsLeft <= 0;
    bonus = {
      v: 1,
      bet,
      spinsLeft,
      heatIndex: bonusComplete ? 0 : Math.min(heatIndex, BONUS_HEAT_CARRY),
      sticky: bonusComplete ? [] : extractSticky(grid),
      accumulatedWin,
      exp: Date.now() + 10 * 60 * 1000,
    };
  } else if (spinsAwarded > 0) {
    bonusAward = { spins: spinsAwarded };
    spinsLeft = spinsAwarded;
    bonus = {
      v: 1,
      bet,
      spinsLeft,
      heatIndex: 0,
      sticky: extractSticky(grid),
      accumulatedWin: spinWin,
      exp: Date.now() + 10 * 60 * 1000,
    };
    accumulatedWin = spinWin;
  }

  return {
    roundId: roundId(),
    seed,
    bet,
    cost,
    mode: input.mode,
    initialGrid,
    finalGrid: cloneGrid(grid),
    tumbles,
    detonations,
    eclipse,
    totalWin: spinWin,
    accumulatedWin,
    scatterCount,
    bonusAward,
    bonusToken,
    spinsLeft,
    inBonus,
    bonusComplete,
    heatIndex,
    multiplier: fibAt(Math.max(0, heatIndex - (tumbles.length ? 1 : 0))),
    capped: false,
    ...(bonus ? { _bonus: bonus } : {}),
  } as SpinResult & { _bonus?: BonusState };
}

export function peekBonus(result: SpinResult): BonusState | null {
  return (result as SpinResult & { _bonus?: BonusState })._bonus ?? null;
}

export { COLS, ROWS, idx, rowOf, colOf };
