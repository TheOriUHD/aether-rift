import { SYMBOL_SRC } from "@/lib/slot/assets";
import { FIBONACCI, formatCredits } from "@/lib/slot/math";
import type { GridCell } from "@/lib/slot/types";
import { cn } from "@/lib/utils";

export type CellFx = "idle" | "drop" | "out" | "win" | "explode" | "spawn" | "collect";

type Props = {
  grid: GridCell[];
  fx: CellFx[];
  heatIndex: number;
  inBonus: boolean;
  spinsLeft: number;
  motionKey?: number;
  fallRows?: number[];
  dropDelay?: number[];
  dropMs?: number[];
};

export function SlotGrid({
  grid,
  fx,
  heatIndex,
  inBonus,
  spinsLeft,
  motionKey = 0,
  fallRows,
  dropDelay,
  dropMs,
}: Props) {
  const dropping = fx.some((f) => f === "drop" || f === "out");
  return (
    <div className="relative mx-auto w-full max-w-[28rem]">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <HeatStrip heatIndex={heatIndex} />
        {inBonus ? (
          <div className="rounded-full border border-rift/40 bg-rift/15 px-3 py-1 text-xs font-medium tracking-wide text-rift">
            Riftwalk {spinsLeft}
          </div>
        ) : (
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">
            Cluster 5+
          </div>
        )}
      </div>
      <div className={cn("slot-frame", dropping && "is-dropping")}>
        <div className={cn("slot-grid", dropping && "is-dropping")} role="grid" aria-label="Aether Rift reels">
          {grid.map((cell, i) => (
            <SlotCell
              key={i}
              cell={cell}
              fx={fx[i] ?? "idle"}
              index={i}
              motionKey={motionKey}
              fallRows={fallRows?.[i] ?? 6.3}
              delay={dropDelay?.[i] ?? 0}
              duration={dropMs?.[i] ?? 760}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeatStrip({ heatIndex }: { heatIndex: number }) {
  const shown = FIBONACCI.slice(0, 7);
  const current = Math.min(Math.max(heatIndex, 0), shown.length - 1);
  return (
    <div className="flex items-center gap-1 overflow-x-auto" aria-label={`Heat ${shown[current]}x`}>
      {shown.map((n, i) => (
        <span
          key={n}
          className={cn(
            "inline-flex min-w-6 items-center justify-center rounded-sm px-1 py-0.5 text-[10px] tabular-nums",
            i === current ? "bg-rift text-void" : i < current ? "text-rift" : "text-faint",
          )}
        >
          {n}x
        </span>
      ))}
    </div>
  );
}

function SlotCell({
  cell,
  fx,
  index,
  motionKey,
  fallRows,
  delay,
  duration,
}: {
  cell: GridCell;
  fx: CellFx;
  index: number;
  motionKey: number;
  fallRows: number;
  delay: number;
  duration: number;
}) {
  const src = cell.symbol ? SYMBOL_SRC[cell.symbol] : null;
  return (
    <div className={cn("slot-cell", `is-${fx}`)} role="gridcell">
      {src ? (
        <div
          key={`${motionKey}-${index}-${fx}`}
          className="slot-gem"
          style={{
            ["--drop-from" as string]: `${-(fallRows * 110)}%`,
            ["--drop-delay" as string]: `${delay}ms`,
            ["--drop-ms" as string]: `${duration}ms`,
          }}
        >
          <img src={src} alt={cell.symbol ?? ""} draggable={false} className="slot-symbol" />
          {cell.symbol === "wild" && cell.wildMult >= 2 ? (
            <span className="slot-badge">{cell.wildMult}x</span>
          ) : null}
          {cell.symbol === "heart" && cell.heartValue > 0 ? (
            <span className="slot-badge slot-badge-heart">{formatCredits(cell.heartValue)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
