import { createHmac, timingSafeEqual } from "node:crypto";
import type { BonusState } from "./types";

const SECRET = "aether-rift-social-demo-not-real-money";

export function signBonus(payload: BonusState): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyBonus(token: string): BonusState | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as BonusState;
    if (parsed.v !== 1) return null;
    if (parsed.exp < Date.now()) return null;
    if (!(parsed.bet > 0) || parsed.spinsLeft < 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function attachToken<T extends { bonusToken: string | null }>(
  result: T,
  bonus: BonusState | null,
): T {
  if (!bonus) return result;
  return { ...result, bonusToken: signBonus(bonus) };
}
