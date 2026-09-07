import assert from "node:assert/strict";
import { test } from "node:test";
import { applyGravity, findClusters, peekBonus, playSpin } from "./engine";
import { MAX_WIN_X, emptyCell, idx, payFor, round2 } from "./math";
import type { BonusState, GridCell } from "./types";

function cell(symbol: GridCell["symbol"], wildMult = 0, heartValue = 0): GridCell {
  return { symbol, wildMult, heartValue };
}

function blank(): GridCell[] {
  return Array.from({ length: 25 }, emptyCell);
}

test("five in a row is a cluster", () => {
  const g = blank();
  for (let c = 0; c < 5; c++) g[idx(2, c)] = cell("nova");
  const clusters = findClusters(g);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]!.symbol, "nova");
  assert.equal(clusters[0]!.size, 5);
});

test("wilds join a cluster", () => {
  const g = blank();
  for (let c = 0; c < 4; c++) g[idx(0, c)] = cell("iris");
  g[idx(0, 4)] = cell("wild", 1);
  const clusters = findClusters(g);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]!.size, 5);
});

test("gravity drops around sticky hearts", () => {
  const g = blank();
  g[idx(0, 0)] = cell("crown");
  g[idx(3, 0)] = cell("heart", 0, 1);
  const { grid, drops } = applyGravity(g);
  assert.equal(grid[idx(3, 0)]!.symbol, "heart");
  assert.equal(grid[idx(4, 0)]!.symbol, "crown");
  assert.ok(drops.some((d) => d.to === idx(4, 0)));
});

test("seeded spins are deterministic", () => {
  const a = playSpin({ bet: 1, mode: "base", seed: 42 });
  const b = playSpin({ bet: 1, mode: "base", seed: 42 });
  assert.equal(a.totalWin, b.totalWin);
  assert.deepEqual(a.initialGrid, b.initialGrid);
  assert.equal(a.tumbles.length, b.tumbles.length);
});

test("paytable size 5 nova is 1.6x", () => {
  assert.equal(payFor("nova", 5), 1.6);
});

test("round2 half-up cents", () => {
  assert.equal(round2(1.004), 1);
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(1.015), 1.02);
});

test("wins are uncapped", () => {
  assert.equal(MAX_WIN_X, 0);
});

test("base spins stay finite and sometimes pay", () => {
  let hits = 0;
  let max = 0;
  for (let i = 0; i < 400; i++) {
    const r = playSpin({ bet: 1, mode: "base", seed: 1000 + i });
    if (r.totalWin > 0) hits += 1;
    if (r.totalWin > max) max = r.totalWin;
    assert.equal(r.capped, false);
    assert.ok(Number.isFinite(r.totalWin));
    assert.ok(r.initialGrid.length === 25);
  }
  assert.ok(hits > 10, `expected some wins, got ${hits}`);
  assert.ok(max >= 0);
});

test("wilds use the highest multiplier, not the sum", () => {
  const g = blank();
  for (let c = 0; c < 3; c++) g[idx(0, c)] = cell("iris");
  g[idx(0, 3)] = cell("wild", 3);
  g[idx(0, 4)] = cell("wild", 5);
  const clusters = findClusters(g);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]!.size, 5);
  assert.equal(clusters[0]!.wildFactor, 5);
});

test("bonus buy is not a guaranteed million", () => {
  let total = 0;
  for (let i = 0; i < 24; i++) {
    let bonus: BonusState = {
      v: 1,
      bet: 1,
      spinsLeft: 8,
      heatIndex: 0,
      sticky: [],
      accumulatedWin: 0,
      exp: Date.now() + 60_000,
    };
    let spins = 0;
    while (bonus.spinsLeft > 0 && spins < 40) {
      const r = playSpin({ bet: 1, mode: "base", seed: 50_000 + i * 97 + spins, bonus });
      total += r.totalWin;
      const next = peekBonus(r);
      if (!next) break;
      bonus = next;
      spins += 1;
    }
  }
  const avg = total / 24;
  assert.ok(avg < 5_000, `bonus still too hot: avg ${avg}`);
});
