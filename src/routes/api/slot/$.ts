import { createFileRoute } from "@tanstack/react-router";
import { peekBonus, playSpin } from "@/lib/slot/engine";
import { emptyCors, errorResponse, jsonResponse } from "@/lib/slot/http";
import { BETS, BONUS_BUY_COST, getGameConfig, round2 } from "@/lib/slot/math";
import { attachToken, signBonus, verifyBonus } from "@/lib/slot/token";
import type { BonusState, SpinMode } from "@/lib/slot/types";

export const Route = createFileRoute("/api/slot/$")({
  server: {
    handlers: {
      OPTIONS: async () => emptyCors(),
      GET: async ({ params }) => {
        if (params._splat === "config") {
          return jsonResponse({ ok: true, config: getGameConfig() });
        }
        return errorResponse("Unknown endpoint", 404);
      },
      POST: async ({ params, request }) => {
        const action = params._splat;
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          body = {};
        }

        if (action === "spin") {
          const parsed = parseBet(body);
          if (!parsed) return errorResponse("Invalid bet");
          const mode: SpinMode = body.mode === "ante" ? "ante" : "base";
          const seed = typeof body.seed === "number" ? (body.seed >>> 0) : undefined;
          const result = playSpin({ bet: parsed, mode, seed });
          const bonus = peekBonus(result);
          const { _bonus: _, ...rest } = result as typeof result & { _bonus?: BonusState };
          return jsonResponse({ ok: true, result: attachToken(rest, bonus) });
        }

        if (action === "bonus-buy") {
          const parsed = parseBet(body);
          if (!parsed) return errorResponse("Invalid bet");
          const bonus: BonusState = {
            v: 1,
            bet: parsed,
            spinsLeft: 8,
            heatIndex: 0,
            sticky: [],
            accumulatedWin: 0,
            exp: Date.now() + 10 * 60 * 1000,
          };
          return jsonResponse({
            ok: true,
            cost: round2(parsed * BONUS_BUY_COST),
            spinsLeft: 8,
            bonusToken: signBonus(bonus),
          });
        }

        if (action === "free-spin") {
          const token = typeof body.token === "string" ? body.token : "";
          const bonus = verifyBonus(token);
          if (!bonus) return errorResponse("Bonus session expired or invalid", 403);
          if (bonus.spinsLeft <= 0) return errorResponse("No free spins remaining");
          const seed = typeof body.seed === "number" ? (body.seed >>> 0) : undefined;
          const result = playSpin({ bet: bonus.bet, mode: "base", seed, bonus });
          const next = peekBonus(result);
          const { _bonus: _, ...rest } = result as typeof result & { _bonus?: BonusState };
          return jsonResponse({ ok: true, result: attachToken(rest, next) });
        }

        return errorResponse("Unknown endpoint", 404);
      },
    },
  },
});

function parseBet(body: Record<string, unknown>): number | null {
  const bet = typeof body.bet === "number" ? body.bet : Number(body.bet);
  if (!Number.isFinite(bet)) return null;
  const matched = BETS.find((b) => Math.abs(b - bet) < 1e-9);
  return matched ?? null;
}
