import { SlotGrid, type CellFx } from "@/components/slot/SlotGrid";
import { audio } from "@/components/slot/audio";
import { WalletBridge, isEmbedded } from "@/components/slot/iframe-bridge";
import {
  BigWinOverlay,
  BonusBanner,
  BuyPanel,
  HelpPanel,
  Intro,
  PaytablePanel,
} from "@/components/slot/overlays";
import { winTier } from "@/components/slot/win-tier";
import { STAGE_SRC } from "@/lib/slot/assets";
import { BETS, formatCredits, previewGrid, round2, spinCost as stakeCost } from "@/lib/slot/math";
import type { GridCell, SpinMode, SpinResult } from "@/lib/slot/types";
import { cn } from "@/lib/utils";
import {
  CircleHelp,
  FastForward,
  Minus,
  Plus,
  Table2,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

const DEMO_KEY = "aether-rift-demo-balance";
const DEMO_START = 10000;
const TURBO_KEY = "aether-rift-turbo";

type Panel = "paytable" | "help" | "buy" | null;

function readDemoBalance(): number {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return DEMO_START;
    const n = Number(raw);
    return Number.isFinite(n) ? n : DEMO_START;
  } catch {
    return DEMO_START;
  }
}

function persistDemo(n: number) {
  try {
    localStorage.setItem(DEMO_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function readTurbo(): boolean {
  try {
    return localStorage.getItem(TURBO_KEY) === "1";
  } catch {
    return false;
  }
}

function persistTurbo(on: boolean) {
  try {
    localStorage.setItem(TURBO_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function idleFx(): CellFx[] {
  return Array.from({ length: 25 }, () => "idle");
}

function n25(value = 0): number[] {
  return Array.from({ length: 25 }, () => value);
}

type ReelTime = {
  col: number;
  out: number;
  drop: number;
  bounce: number;
  win: number;
  boom: number;
  gap: number;
  eclipse: number;
  detonate: number;
};

function reelTime(turbo: boolean, reduced: boolean): ReelTime {
  if (reduced) {
    return { col: 0, out: 40, drop: 70, bounce: 0, win: 60, boom: 60, gap: 20, eclipse: 80, detonate: 70 };
  }
  if (turbo) {
    return { col: 50, out: 160, drop: 280, bounce: 40, win: 220, boom: 150, gap: 60, eclipse: 260, detonate: 220 };
  }
  return { col: 150, out: 420, drop: 760, bounce: 100, win: 560, boom: 400, gap: 140, eclipse: 720, detonate: 600 };
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/slot/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export function SlotApp({ embed }: { embed: boolean }) {
  const [started, setStarted] = useState(false);
  const [balance, setBalance] = useState(DEMO_START);
  const [currency, setCurrency] = useState("CR");
  const [betIndex, setBetIndex] = useState(4);
  const [ante, setAnte] = useState(false);
  const [grid, setGrid] = useState<GridCell[]>(previewGrid);
  const [fx, setFx] = useState<CellFx[]>(idleFx);
  const [heatIndex, setHeatIndex] = useState(0);
  const [win, setWin] = useState(0);
  const [busy, setBusy] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [hostOn, setHostOn] = useState(false);
  const [inBonus, setInBonus] = useState(false);
  const [spinsLeft, setSpinsLeft] = useState(0);
  const [bonusToken, setBonusToken] = useState<string | null>(null);
  const [banner, setBanner] = useState<number | null>(null);
  const [bigWin, setBigWin] = useState<{
    amount: number;
    bet: number;
    label: string;
    tier: "big" | "mega" | "epic" | "rift";
  } | null>(null);
  const [skip, setSkip] = useState(false);
  const [motionKey, setMotionKey] = useState(0);
  const [fallRows, setFallRows] = useState<number[]>(() => n25(6.3));
  const [dropDelay, setDropDelay] = useState<number[]>(() => n25(0));
  const [dropMs, setDropMs] = useState<number[]>(() => n25(980));

  const bet = BETS[betIndex] ?? 1;
  const mode: SpinMode = ante ? "ante" : "base";
  const cost = stakeCost(bet, mode);
  const gen = useRef(0);
  const skipRef = useRef(false);
  const autoRef = useRef(0);
  const bridge = useRef<WalletBridge | null>(null);
  const playing = useRef(false);
  const reduced = useRef(false);
  const turboRef = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      if (sessionStorage.getItem("aether-rift-started") === "1") {
        setStarted(true);
      } else if (window.parent !== window) {
        setStarted(true);
        sessionStorage.setItem("aether-rift-started", "1");
      }
    } catch {
      setStarted(true);
    }
    if (!isEmbedded()) setBalance(readDemoBalance());
    const savedTurbo = readTurbo();
    setTurbo(savedTurbo);
    turboRef.current = savedTurbo;
    const b = new WalletBridge({
      onBalance: (n) => {
        setBalance(n);
        setHostOn(true);
      },
      onMute: (m) => {
        setMuted(m);
        audio.setMuted(m);
      },
      onReady: () => {
        setHostOn(true);
        if (b.currency) setCurrency(b.currency);
      },
    });
    bridge.current = b;
    return () => b.dispose();
  }, []);

  useEffect(() => {
    const apply = () => {
      const key = window.location.hash.replace(/^#/, "");
      const demos: Record<string, { amount: number; label: string; tier: "big" | "mega" | "epic" | "rift" }> = {
        "win-big": { amount: 24, label: "Big win", tier: "big" },
        "win-mega": { amount: 88, label: "Mega win", tier: "mega" },
        "win-epic": { amount: 260, label: "Epic win", tier: "epic" },
        "win-rift": { amount: 18400, label: "Rift break", tier: "rift" },
      };
      const hit = demos[key];
      if (!hit) return;
      setStarted(true);
      setBigWin({ ...hit, bet: 1 });
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    if (!hostOn) persistDemo(balance);
  }, [balance, hostOn]);

  const wait = useCallback((ms: number) => {
    const my = gen.current;
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        if (gen.current !== my || skipRef.current) {
          resolve();
          return;
        }
        if (now - start >= ms) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, []);

  const applyFinal = useCallback((result: SpinResult) => {
    setGrid(result.finalGrid);
    setFx(idleFx());
    setHeatIndex(Math.max(0, result.heatIndex - (result.tumbles.length ? 1 : 0)));
    setWin(result.totalWin);
    setSpinsLeft(result.spinsLeft);
  }, []);

  const stampMotion = useCallback((fall: number[], delay: number[], ms: number[]) => {
    setFallRows(fall);
    setDropDelay(delay);
    setDropMs(ms);
    setMotionKey((k) => k + 1);
  }, []);

  const playResult = useCallback(
    async (result: SpinResult) => {
      skipRef.current = false;
      setSkip(false);
      setWin(0);
      setHeatIndex(0);
      const t = reelTime(turboRef.current, reduced.current);
      const my = gen.current;

      const outDelay = n25(0);
      const outMs = n25(t.out);
      for (let i = 0; i < 25; i++) outDelay[i] = (i % 5) * (t.col * 0.28);
      stampMotion(n25(0), outDelay, outMs);
      setFx(Array.from({ length: 25 }, () => "out"));
      audio.spin();
      await wait(t.out + t.col * 0.28 * 4 + 50);
      if (skipRef.current) {
        applyFinal(result);
        return;
      }

      const fall = n25(6.3);
      const delay = n25(0);
      const ms = n25(t.drop);
      for (let i = 0; i < 25; i++) delay[i] = (i % 5) * t.col;
      setGrid(result.initialGrid);
      stampMotion(fall, delay, ms);
      setFx(result.initialGrid.map((c) => (c.symbol ? "drop" : "idle")));
      for (let c = 0; c < 5; c++) {
        window.setTimeout(() => {
          if (gen.current !== my || skipRef.current) return;
          audio.land();
        }, c * t.col + t.drop * 0.72);
      }
      await wait(t.col * 4 + t.drop + t.bounce);
      if (skipRef.current) {
        applyFinal(result);
        return;
      }
      setFx(idleFx());

      for (const step of result.tumbles) {
        if (skipRef.current) break;
        const highlight = idleFx();
        for (const ex of step.explosions) for (const i of ex.cells) highlight[i] = "win";
        setFx(highlight);
        setHeatIndex(step.heatIndex);
        await wait(t.win);
        const boom = idleFx();
        for (const ex of step.explosions) for (const i of ex.cells) boom[i] = "explode";
        for (const i of step.heartSpawns) boom[i] = "spawn";
        setFx(boom);
        audio.explode();
        setWin((w) => round2(w + step.stepWin));
        await wait(t.boom);
        setGrid(step.gridAfterExplode);
        await wait(t.gap);
        if (skipRef.current) break;

        const tFall = n25(0);
        const tDelay = n25(0);
        const tMs = n25(t.drop);
        const dropFx = idleFx();
        for (const d of step.drops) {
          const fromR = Math.floor(d.from / 5);
          const toR = Math.floor(d.to / 5);
          const col = d.to % 5;
          tFall[d.to] = Math.max(1, toR - fromR);
          tDelay[d.to] = col * (t.col * 0.4);
          tMs[d.to] = t.drop * 0.78;
          dropFx[d.to] = "drop";
        }
        for (const i of step.newCells) {
          const col = i % 5;
          const row = Math.floor(i / 5);
          tFall[i] = row + 2.8;
          tDelay[i] = col * t.col + t.col * 0.2;
          tMs[i] = t.drop;
          dropFx[i] = "drop";
        }
        setGrid(step.gridAfterFill);
        stampMotion(tFall, tDelay, tMs);
        setFx(dropFx);
        await wait(t.col * 4 + t.drop + t.bounce);
        setFx(idleFx());
      }

      if (!skipRef.current && result.eclipse) {
        const ecl = idleFx();
        for (const i of result.eclipse.cells) ecl[i] = "collect";
        setFx(ecl);
        audio.eclipse();
        setWin((w) => round2(w + result.eclipse!.pay));
        await wait(t.eclipse);
      }

      if (!skipRef.current && result.detonations.length) {
        const det = idleFx();
        for (const d of result.detonations) det[d.index] = "explode";
        setFx(det);
        audio.charge();
        for (const d of result.detonations) setWin((w) => round2(w + d.pay));
        await wait(t.detonate);
      }

      applyFinal(result);
    },
    [applyFinal, stampMotion, wait],
  );

  const creditWin = useCallback(
    async (roundId: string, amount: number) => {
      if (amount <= 0) return;
      const host = bridge.current;
      if (hostOn && host) {
        const r = await host.requestTxn({
          kind: "credit",
          amount,
          roundId,
          reason: "win",
        });
        if (r.ok && typeof r.balance === "number") setBalance(r.balance);
        else if (r.ok) setBalance((b) => round2(b + amount));
      } else {
        setBalance((b) => round2(b + amount));
      }
    },
    [hostOn],
  );

  const runRound = useCallback(
    async (kind: "spin" | "free" | "buy") => {
      if (playing.current) {
        skipRef.current = true;
        setSkip(true);
        return;
      }
      setError(null);
      setPanel(null);
      const my = ++gen.current;
      playing.current = true;
      setBusy(true);

      try {
        if (kind === "buy") {
          const buyCost = round2(bet * 80);
          if (balance < buyCost) throw new Error("Not enough credits");
          const host = bridge.current;
          const roundId = crypto.randomUUID();
          if (hostOn && host) {
            const debit = await host.requestTxn({
              kind: "debit",
              amount: buyCost,
              roundId,
              reason: "bonus-buy",
            });
            if (!debit.ok) throw new Error(debit.error || "Host declined");
            if (typeof debit.balance === "number") setBalance(debit.balance);
          } else {
            setBalance((b) => round2(b - buyCost));
          }
          const bought = await api<{ bonusToken: string; spinsLeft: number }>("bonus-buy", { bet });
          setBonusToken(bought.bonusToken);
          setInBonus(true);
          setSpinsLeft(bought.spinsLeft);
          setBanner(bought.spinsLeft);
          audio.bonus();
          await wait(turboRef.current ? 600 : 1200);
          setBanner(null);
          return;
        }

        const isFree = kind === "free" || Boolean(bonusToken && inBonus);
        const spinCost = isFree ? 0 : cost;
        if (!isFree && balance < spinCost) throw new Error("Not enough credits");

        const roundId = crypto.randomUUID();
        const host = bridge.current;
        if (!isFree) {
          if (hostOn && host) {
            host.roundStart(roundId, bet, spinCost);
            const debit = await host.requestTxn({
              kind: "debit",
              amount: spinCost,
              roundId,
              reason: ante ? "spin-ante" : "spin",
            });
            if (!debit.ok) throw new Error(debit.error || "Host declined");
            if (typeof debit.balance === "number") setBalance(debit.balance);
          } else {
            setBalance((b) => round2(b - spinCost));
          }
        }

        const data = isFree
          ? await api<{ result: SpinResult }>("free-spin", { token: bonusToken })
          : await api<{ result: SpinResult }>("spin", { bet, mode });

        if (gen.current !== my) return;
        const result = data.result;
        setBonusToken(result.bonusToken);
        setInBonus(Boolean(result.bonusToken) || (result.inBonus && !result.bonusComplete));
        setSpinsLeft(result.spinsLeft);

        await playResult(result);
        if (gen.current !== my) return;

        await creditWin(result.roundId, result.totalWin);
        host?.roundEnd(result.roundId, result.bet, result.totalWin);

        const celebrate = result.bonusComplete
          ? Math.max(result.accumulatedWin, result.totalWin)
          : result.totalWin;
        const x = result.bet > 0 ? celebrate / result.bet : 0;
        const hit = winTier(x);
        const inFeature = result.inBonus && !result.bonusComplete;
        if (hit && (!inFeature || hit.tier !== "big")) {
          audio.bigWin(hit.tier);
          setBigWin({ amount: celebrate, bet: result.bet, label: hit.label, tier: hit.tier });
        } else if (result.totalWin > 0) {
          audio.win();
        }

        if (result.bonusAward && result.bonusToken) {
          setBanner(result.bonusAward.spins);
          audio.bonus();
          await wait(turboRef.current ? 650 : 1300);
          setBanner(null);
          setInBonus(true);
        }

        if (result.bonusComplete) {
          setInBonus(false);
          setBonusToken(null);
          autoRef.current = 0;
          setAutoLeft(0);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Spin failed");
        autoRef.current = 0;
        setAutoLeft(0);
      } finally {
        playing.current = false;
        setBusy(false);
        skipRef.current = false;
        setSkip(false);
      }
    },
    [ante, balance, bet, bonusToken, cost, creditWin, hostOn, inBonus, mode, playResult, wait],
  );

  useEffect(() => {
    if (!started || busy || bigWin || banner) return;
    if (inBonus && bonusToken && spinsLeft > 0) {
      const t = window.setTimeout(() => void runRound("free"), turbo ? 160 : 520);
      return () => window.clearTimeout(t);
    }
    if (autoLeft > 0 && !inBonus) {
      const t = window.setTimeout(() => {
        setAutoLeft((n) => Math.max(0, n - 1));
        void runRound("spin");
      }, turbo ? 120 : 420);
      return () => window.clearTimeout(t);
    }
  }, [autoLeft, banner, bigWin, bonusToken, busy, inBonus, runRound, spinsLeft, started, turbo]);

  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        void runRound(inBonus ? "free" : "spin");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inBonus, runRound, started]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
  };

  const toggleTurbo = () => {
    const next = !turbo;
    turboRef.current = next;
    setTurbo(next);
    persistTurbo(next);
  };

  const startGame = () => {
    setStarted(true);
    try {
      sessionStorage.setItem("aether-rift-started", "1");
    } catch {
      /* ignore */
    }
    try {
      audio.unlock();
    } catch {
      /* Preview iframes can block audio. */
    }
  };

  const canSpin = started && (!busy || playing.current) && (inBonus || balance >= cost);

  const winTone = useMemo(() => (win > 0 ? "text-win" : "text-muted"), [win]);

  if (!started) {
    return <Intro onPlay={startGame} embed={embed} />;
  }

  return (
    <div
      className={cn("slot-shell", embed && "is-embed", turbo && "is-turbo", bigWin && `is-win-${bigWin.tier}`)}
      onPointerDown={() => {
        try {
          audio.unlock();
        } catch {
          /* ignore */
        }
      }}
    >
      <div className="slot-stage" style={{ backgroundImage: `url(${STAGE_SRC})` }} />
      <div className="slot-veil" />

      <header className="slot-top">
        <div>
          <p className="font-display text-lg leading-none tracking-tight text-fg">Aether Rift</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-faint">Very high vol · 96.2% RTP</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-faint">Balance</p>
          <p className="tabular-nums text-lg text-fg">
            {formatCredits(balance)} <span className="text-xs text-muted">{currency}</span>
          </p>
        </div>
      </header>

      <div className="slot-board">
        <SlotGrid
          grid={grid}
          fx={fx}
          heatIndex={heatIndex}
          inBonus={inBonus}
          spinsLeft={spinsLeft}
          motionKey={motionKey}
          fallRows={fallRows}
          dropDelay={dropDelay}
          dropMs={dropMs}
        />
        <div className="mt-4 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-faint">Win</p>
          <p className={cn("font-display text-3xl tabular-nums tracking-tight", winTone)}>
            {formatCredits(win)}
          </p>
        </div>
      </div>

      <footer className="slot-dock">
        <div className="flex items-center gap-1.5">
          <IconBtn label="Paytable" onClick={() => setPanel("paytable")}>
            <Table2 className="size-4" />
          </IconBtn>
          <IconBtn label="How to play" onClick={() => setPanel("help")}>
            <CircleHelp className="size-4" />
          </IconBtn>
          <IconBtn label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </IconBtn>
          <IconBtn
            label={turbo ? "Turbo on" : "Turbo off"}
            onClick={toggleTurbo}
            active={turbo}
          >
            <FastForward className="size-4" />
          </IconBtn>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <div className="flex items-center gap-2">
            <IconBtn
              label="Lower stake"
              onClick={() => setBetIndex((i) => Math.max(0, i - 1))}
              disabled={busy || inBonus}
            >
              <Minus className="size-4" />
            </IconBtn>
            <div className="min-w-24 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-faint">Stake</p>
              <p className="tabular-nums text-fg">{formatCredits(bet)}</p>
            </div>
            <IconBtn
              label="Raise stake"
              onClick={() => setBetIndex((i) => Math.min(BETS.length - 1, i + 1))}
              disabled={busy || inBonus}
            >
              <Plus className="size-4" />
            </IconBtn>
          </div>
          <button
            type="button"
            disabled={busy || inBonus}
            onClick={() => setAnte((v) => !v)}
            className={cn("chip", ante && "chip-on")}
          >
            Tear hunt +{Math.round((1.25 - 1) * 100)}%
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || inBonus}
            onClick={() => setPanel("buy")}
          >
            <Zap className="size-3.5" />
            Buy
          </button>
          <button
            type="button"
            className="btn-spin"
            disabled={!canSpin && !playing.current}
            onClick={() => void runRound(inBonus ? "free" : "spin")}
          >
            {busy ? (skip ? "Skip" : "Stop") : inBonus ? "Free" : "Spin"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || inBonus}
            onClick={() => {
              if (autoLeft > 0) {
                setAutoLeft(0);
                return;
              }
              setAutoLeft(10);
            }}
          >
            Auto{autoLeft > 0 ? ` ${autoLeft}` : ""}
          </button>
        </div>
      </footer>

      <p className="slot-legal">
        Social casino · no real-money gambling
        {!embed ? (
          <>
            {" · "}
            <Link to="/integrator" className="text-accent underline-offset-2 hover:underline">
              Embed API
            </Link>
          </>
        ) : null}
      </p>

      {error ? (
        <div className="slot-toast" role="status">
          {error}
        </div>
      ) : null}

      {panel === "paytable" ? <PaytablePanel onClose={() => setPanel(null)} /> : null}
      {panel === "help" ? <HelpPanel onClose={() => setPanel(null)} /> : null}
      {panel === "buy" ? (
        <BuyPanel
          bet={bet}
          balance={balance}
          busy={busy}
          onClose={() => setPanel(null)}
          onBuy={() => void runRound("buy")}
        />
      ) : null}
      {banner ? <BonusBanner spins={banner} /> : null}
      {bigWin ? (
        <BigWinOverlay
          amount={bigWin.amount}
          bet={bigWin.bet}
          label={bigWin.label}
          tier={bigWin.tier}
          onDone={() => setBigWin(null)}
        />
      ) : null}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("icon-btn", active && "icon-btn-on")}
    >
      {children}
    </button>
  );
}
