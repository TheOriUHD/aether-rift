import type { HostMessage, IframeMessage } from "@/lib/slot/types";

const CHANNEL = "aether-rift" as const;

export function isEmbedded(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

type Txn = {
  kind: "debit" | "credit";
  amount: number;
  roundId: string;
  reason: string;
};

type Pending = {
  resolve: (v: { ok: boolean; balance?: number; error?: string }) => void;
  timer: number;
};

export class WalletBridge {
  balance: number | null = null;
  currency = "CR";
  minBet?: number;
  maxBet?: number;
  autoConfirm = false;
  connected = false;
  private pending = new Map<string, Pending>();
  private onBalance: (n: number) => void;
  private onMute: (m: boolean) => void;
  private onReady: () => void;

  constructor(handlers: {
    onBalance: (n: number) => void;
    onMute: (m: boolean) => void;
    onReady: () => void;
  }) {
    this.onBalance = handlers.onBalance;
    this.onMute = handlers.onMute;
    this.onReady = handlers.onReady;
    window.addEventListener("message", this.onMessage);
    this.post({ channel: CHANNEL, v: 1, type: "ready" });
  }

  dispose() {
    window.removeEventListener("message", this.onMessage);
    for (const p of this.pending.values()) window.clearTimeout(p.timer);
  }

  private post(msg: IframeMessage) {
    try {
      window.parent.postMessage(msg, "*");
    } catch {
      /* ignore */
    }
  }

  private onMessage = (event: MessageEvent) => {
    const data = event.data as HostMessage | null;
    if (!data || data.channel !== CHANNEL || data.v !== 1) return;
    if (data.type === "init") {
      this.connected = true;
      this.currency = data.currency ?? "CR";
      this.minBet = data.minBet;
      this.maxBet = data.maxBet;
      this.autoConfirm = Boolean(data.autoConfirm);
      this.balance = data.balance;
      this.onBalance(data.balance);
      this.onReady();
    } else if (data.type === "balance.set") {
      this.balance = data.balance;
      this.onBalance(data.balance);
    } else if (data.type === "mute") {
      this.onMute(data.muted);
    } else if (data.type === "txn.result") {
      const p = this.pending.get(data.id);
      if (!p) return;
      this.pending.delete(data.id);
      window.clearTimeout(p.timer);
      if (typeof data.balance === "number") {
        this.balance = data.balance;
        this.onBalance(data.balance);
      }
      p.resolve({ ok: data.ok, balance: data.balance, error: data.error });
    }
  };

  requestTxn(txn: Txn): Promise<{ ok: boolean; balance?: number; error?: string }> {
    if (!this.connected) {
      return Promise.resolve({ ok: true });
    }
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: "Host timed out" });
      }, 15000);
      this.pending.set(id, { resolve, timer });
      this.post({
        channel: CHANNEL,
        v: 1,
        type: "txn.request",
        id,
        kind: txn.kind,
        amount: txn.amount,
        roundId: txn.roundId,
        reason: txn.reason,
      });
    });
  }

  roundStart(roundId: string, bet: number, cost: number) {
    this.post({ channel: CHANNEL, v: 1, type: "round.start", roundId, bet, cost });
  }

  roundEnd(roundId: string, bet: number, win: number) {
    this.post({ channel: CHANNEL, v: 1, type: "round.end", roundId, bet, win });
  }

  sync(balance: number) {
    this.post({ channel: CHANNEL, v: 1, type: "balance.sync", balance });
  }
}

export function hostPost(target: Window, msg: HostMessage) {
  target.postMessage(msg, "*");
}
