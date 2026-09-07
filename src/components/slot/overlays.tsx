import { audio } from "@/components/slot/audio";
import type { WinTier } from "@/components/slot/win-tier";
import { SYMBOL_SRC } from "@/lib/slot/assets";
import { ANTE_COST, BONUS_BUY_COST, PAYTABLE, SYMBOL_META, formatCredits } from "@/lib/slot/math";
import type { PaySymbol } from "@/lib/slot/types";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Panel({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="slot-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button className="slot-modal-backdrop" onClick={onClose} aria-label="Close" />
      <div className={cn("slot-modal-card", wide && "slot-modal-wide")}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl tracking-tight text-fg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PaytablePanel({ onClose }: { onClose: () => void }) {
  const sizes = [5, 6, 7, 8, 9, 10, 12, 15];
  return (
    <Panel title="Paytable" onClose={onClose} wide>
      <p className="mb-4 text-sm text-muted">
        Pays are multiples of your stake for clusters of matching symbols. The
        highest wild in a cluster multiplies it. Fibonacci heat only applies
        during Riftwalk. Wins are uncapped.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.14em] text-faint">
              <th className="pb-2 font-medium">Symbol</th>
              {sizes.map((s) => (
                <th key={s} className="pb-2 text-right font-medium">
                  {s}{s === 15 ? "+" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SYMBOL_META.filter((s) => s.id in PAYTABLE).map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="py-2">
                  <span className="inline-flex items-center gap-2">
                    <img src={SYMBOL_SRC[s.id]} alt="" className="size-8 object-contain" />
                    <span>
                      <span className="block text-fg">{s.name}</span>
                      <span className="text-xs text-faint">{s.role}</span>
                    </span>
                  </span>
                </td>
                {sizes.map((size) => {
                  const table = PAYTABLE[s.id as PaySymbol];
                  const i = Math.min(size, 15) - 5;
                  return (
                    <td key={size} className="py-2 text-right tabular-nums text-win">
                      {table[i]}x
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="How it plays" onClose={onClose}>
      <ol className="space-y-3 text-sm leading-relaxed text-muted">
        <li>
          <strong className="text-fg">Cluster pays.</strong> Five or more matching
          symbols touching on sides explode and pay.
        </li>
        <li>
          <strong className="text-fg">Tumble.</strong> Remaining symbols fall.
          New ones drop from the rift. Sequences can chain.
        </li>
        <li>
          <strong className="text-fg">Fibonacci heat.</strong> During Riftwalk
          each tumble climbs 1x, 2x, 3x, 5x, 8x… up to 21x. Base game stays 1x.
        </li>
        <li>
          <strong className="text-fg">Charged wilds.</strong> Rift Crystals
          substitute. When they pay they gain +1x (max 8x). The highest wild in
          the cluster multiplies the pay.
        </li>
        <li>
          <strong className="text-fg">Void Hearts.</strong> An 8+ cluster leaves a
          collector that absorbs neighbouring explode values.
        </li>
        <li>
          <strong className="text-fg">Eclipse.</strong> Three hearts on the grid
          suck remaining paying symbols into the collectors.
        </li>
        <li>
          <strong className="text-fg">Riftwalk.</strong> Three Tears award free
          spins. Heat carries a little between those spins, then climbs again.
          Hearts stay until the feature detonates. Wins are uncapped — a real
          rift break can run as far as the board lets it.
        </li>
        <li>
          <strong className="text-fg">Turbo.</strong> Off by default. At normal
          speed the board dumps, then columns drop in left to right. Tap
          fast-forward only when you want that shortened.
        </li>
      </ol>
      <p className="mt-5 text-xs text-faint">
        Social casino. Credits have no cash value. Outcomes are decided on the
        server. Play responsibly.
      </p>
    </Panel>
  );
}

export function BuyPanel({
  bet,
  balance,
  onClose,
  onBuy,
  busy,
}: {
  bet: number;
  balance: number;
  onClose: () => void;
  onBuy: () => void;
  busy: boolean;
}) {
  const cost = bet * BONUS_BUY_COST;
  const can = balance >= cost && !busy;
  return (
    <Panel title="Feature buy" onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        Skip the hunt. Open Riftwalk immediately — 8 free spins, persistent heat,
        sticky Void Hearts.
      </p>
      <div className="mb-5 rounded-xl border border-line bg-elevated px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Stake</span>
          <span className="tabular-nums text-fg">{formatCredits(bet)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted">Buy cost</span>
          <span className="tabular-nums text-win">{formatCredits(cost)}</span>
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-faint">
          {BONUS_BUY_COST}x stake
        </div>
      </div>
      <button
        type="button"
        disabled={!can}
        onClick={onBuy}
        className="btn-primary w-full"
      >
        Buy Riftwalk
      </button>
    </Panel>
  );
}

export function Intro({ onPlay, embed }: { onPlay: () => void; embed: boolean }) {
  const label = embed ? "Play" : "Enter the rift";
  return (
    <button type="button" className="slot-intro" onClick={onPlay} aria-label={label}>
      <div className="slot-intro-copy">
        <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-rift">
          Social casino
        </p>
        <h1 className="font-display text-5xl leading-none tracking-tight text-fg sm:text-6xl">
          Aether
          <span className="block text-rift">Rift</span>
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
          Cluster tumble. Fibonacci heat. Charged wilds. Void Hearts that eat
          the grid. High volatility. No real money.
        </p>
        <span className="btn-primary pointer-events-none relative z-10 mt-8 min-w-44">
          {label}
        </span>
        <p className="mt-6 text-xs text-faint">
          Entertainment only. Credits have no cash value.
        </p>
      </div>
    </button>
  );
}

export function BigWinOverlay({
  amount,
  bet,
  label,
  tier,
  onDone,
}: {
  amount: number;
  bet: number;
  label: string;
  tier: WinTier;
  onDone: () => void;
}) {
  const x = bet > 0 ? amount / bet : 0;
  const [skip, setSkip] = useState(false);
  const [shown, setShown] = useState(0);
  const reduced = useRef(false);
  const landedRef = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    landedRef.current = false;
    if (skip || reduced.current) {
      setShown(amount);
      audio.winLand(tier);
      landedRef.current = true;
      return;
    }
    const duration = TIER_MS[tier];
    let raf = 0;
    let lastBucket = -1;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(amount * eased);
      const bucket = Math.floor(t * (tier === "rift" ? 36 : 22));
      if (bucket !== lastBucket) {
        lastBucket = bucket;
        audio.countTick(tier, t);
      }
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setShown(amount);
        if (!landedRef.current) {
          landedRef.current = true;
          audio.winLand(tier);
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [amount, skip, tier]);

  const land = () => {
    if (shown < amount - 0.01) {
      setSkip(true);
      setShown(amount);
      return;
    }
    onDone();
  };

  const sparks = SPARK_COUNT[tier];
  const shards = SHARD_COUNT[tier];
  const landed = shown >= amount - 0.01;
  const multLabel = x >= 100 ? `${Math.round(x).toLocaleString("en-US")}x stake` : `${x.toFixed(1)}x stake`;

  return (
    <div
      className={cn("win-fx", `is-${tier}`)}
      role="dialog"
      aria-label={label}
      onClick={land}
    >
      <div className="win-flash" />
      <div className="win-rays" />
      <div className="win-bloom" />
      <span className="win-ring" />
      <span className="win-ring win-ring-2" />
      {tier === "epic" || tier === "rift" ? <span className="win-ring win-ring-3" /> : null}
      {Array.from({ length: sparks }, (_, i) => (
        <span
          key={`p${i}`}
          className="win-spark"
          style={{
            left: `${(i * 37 + 11) % 100}%`,
            animationDelay: `${(i % 12) * 0.08}s`,
            animationDuration: `${1.4 + (i % 5) * 0.22}s`,
            width: `${4 + (i % 4) * 3}px`,
            height: `${4 + (i % 3) * 3}px`,
            ["--drift" as string]: `${((i * 17) % 80) - 40}px`,
          }}
        />
      ))}
      {Array.from({ length: shards }, (_, i) => (
        <span
          key={`h${i}`}
          className="win-shard"
          style={{
            left: `${(i * 29 + 7) % 100}%`,
            top: `${(i * 13) % 28}%`,
            animationDelay: `${(i % 9) * 0.11}s`,
            animationDuration: `${1.8 + (i % 4) * 0.35}s`,
            ["--spin" as string]: `${((i * 47) % 240) - 120}deg`,
            ["--drift" as string]: `${((i * 23) % 120) - 60}px`,
          }}
        />
      ))}
      {tier === "epic" || tier === "rift" ? (
        <svg className="win-bolts" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d="M54 0 38 36 56 38 30 100" />
          <path d="M18 6 30 40 12 46 28 94" />
          <path d="M84 2 70 34 90 42 62 98" />
        </svg>
      ) : null}
      <div className="win-copy">
        <p className="win-kicker">{label}</p>
        <p
          className={cn("win-amount tabular-nums", landed && "is-landed")}
          aria-live="polite"
        >
          {formatCredits(shown)}
        </p>
        <p className="win-mult">{multLabel}</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            land();
          }}
          className="btn-ghost mt-6"
        >
          {landed ? "Continue" : "Skip"}
        </button>
      </div>
    </div>
  );
}

const TIER_MS: Record<WinTier, number> = {
  big: 1400,
  mega: 2400,
  epic: 3800,
  rift: 5600,
};

const SPARK_COUNT: Record<WinTier, number> = {
  big: 18,
  mega: 32,
  epic: 48,
  rift: 72,
};

const SHARD_COUNT: Record<WinTier, number> = {
  big: 6,
  mega: 12,
  epic: 18,
  rift: 26,
};

export function BonusBanner({ spins }: { spins: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="rounded-2xl border border-rift/40 bg-void/85 px-8 py-6 text-center shadow-xl">
        <p className="text-[11px] uppercase tracking-[0.28em] text-rift">Riftwalk</p>
        <p className="mt-1 font-display text-4xl text-fg">{spins} free spins</p>
      </div>
    </div>
  );
}

export { ANTE_COST };
