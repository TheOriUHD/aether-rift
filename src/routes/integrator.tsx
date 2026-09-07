import { hostPost } from "@/components/slot/iframe-bridge";
import { formatCredits, round2 } from "@/lib/slot/math";
import type { HostMessage, IframeMessage } from "@/lib/slot/types";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/integrator")({
  ssr: false,
  component: Integrator,
});

type LogItem = { t: string; dir: "in" | "out"; text: string };

function Integrator() {
  const [balance, setBalance] = useState(5000);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [log, setLog] = useState<LogItem[]>([]);
  const [pending, setPending] = useState<Extract<IframeMessage, { type: "txn.request" }> | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  const originNote = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const push = (dir: "in" | "out", text: string) => {
    setLog((items) => [{ t: new Date().toLocaleTimeString(), dir, text }, ...items].slice(0, 40));
  };

  const send = (msg: HostMessage) => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    hostPost(win, msg);
    push("out", msg.type);
  };

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      const data = event.data as IframeMessage | null;
      if (!data || data.channel !== "aether-rift" || data.v !== 1) return;
      push("in", data.type);
      if (data.type === "ready") {
        send({
          channel: "aether-rift",
          v: 1,
          type: "init",
          balance,
          currency: "CR",
          autoConfirm,
        });
      } else if (data.type === "txn.request") {
        if (autoConfirm) {
          let next = balance;
          if (data.kind === "debit") {
            if (balance < data.amount) {
              send({
                channel: "aether-rift",
                v: 1,
                type: "txn.result",
                id: data.id,
                ok: false,
                error: "Insufficient host balance",
                balance,
              });
              return;
            }
            next = round2(balance - data.amount);
          } else {
            next = round2(balance + data.amount);
          }
          setBalance(next);
          send({
            channel: "aether-rift",
            v: 1,
            type: "txn.result",
            id: data.id,
            ok: true,
            balance: next,
          });
        } else {
          setPending(data);
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [autoConfirm, balance]);

  const resolvePending = (ok: boolean) => {
    if (!pending) return;
    let next = balance;
    if (ok && pending.kind === "debit") next = round2(balance - pending.amount);
    if (ok && pending.kind === "credit") next = round2(balance + pending.amount);
    if (ok) setBalance(next);
    send({
      channel: "aether-rift",
      v: 1,
      type: "txn.result",
      id: pending.id,
      ok,
      balance: ok ? next : balance,
      error: ok ? undefined : "Host rejected",
    });
    setPending(null);
  };

  return (
    <main className="min-h-dvh bg-void px-4 py-6 text-fg">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-faint">
          Social casino iframe
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl tracking-tight">Embed Aether Rift</h1>
          <Link to="/" className="text-sm text-accent underline-offset-4 hover:underline">
            Back to game
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Drop the game in an iframe. The parent holds the wallet. Every debit and
          credit is a postMessage transaction the host must confirm. RNG stays on
          the game server — this page never sees reel outcomes, only money
          movement.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <iframe
              ref={frame}
              title="Aether Rift"
              src="/?embed=1"
              className="h-[720px] w-full bg-void"
            />
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-sm font-medium">Host wallet</h2>
              <p className="mt-3 font-display text-3xl tabular-nums">
                {formatCredits(balance)} <span className="text-sm text-muted">CR</span>
              </p>
              <label className="mt-4 flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={autoConfirm}
                  onChange={(e) => setAutoConfirm(e.target.checked)}
                />
                Auto-confirm transactions
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn-ghost h-10 flex-1 text-xs"
                  onClick={() => {
                    const next = round2(balance + 1000);
                    setBalance(next);
                    send({ channel: "aether-rift", v: 1, type: "balance.set", balance: next });
                  }}
                >
                  +1000
                </button>
                <button
                  type="button"
                  className="btn-ghost h-10 flex-1 text-xs"
                  onClick={() => send({ channel: "aether-rift", v: 1, type: "mute", muted: true })}
                >
                  Mute
                </button>
              </div>
              {pending ? (
                <div className="mt-4 rounded-xl border border-line bg-elevated p-3 text-sm">
                  <p className="text-fg">
                    {pending.kind} {formatCredits(pending.amount)} · {pending.reason}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="btn-primary h-10 flex-1 text-sm" onClick={() => resolvePending(true)}>
                      Confirm
                    </button>
                    <button type="button" className="btn-ghost h-10 flex-1 text-sm" onClick={() => resolvePending(false)}>
                      Reject
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="min-h-40 flex-1 overflow-auto rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-sm font-medium">Message log</h2>
              <ul className="mt-3 space-y-1.5 font-mono text-[11px] text-muted">
                {log.map((item, i) => (
                  <li key={`${item.t}-${i}`}>
                    <span className="text-faint">{item.t}</span>{" "}
                    <span className={item.dir === "in" ? "text-rift" : "text-win"}>
                      {item.dir}
                    </span>{" "}
                    {item.text}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
