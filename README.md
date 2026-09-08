# Aether Rift

Social-casino cluster slot. **Play money / credits only — not real-money gambling.**

5×5 board, orthogonal clusters, tumble / gravity, charged wilds, Void Hearts, Eclipse, and Riftwalk free spins with Fibonacci heat. All RNG runs on the server.

## Stack

- TanStack Start + React 19 + Tailwind v4
- Slot math and RNG in `src/lib/slot/` (mulberry32, HMAC bonus tokens)
- REST under `/api/slot/*` plus an iframe `postMessage` wallet for a host casino

## Run locally

Requires [Node.js](https://nodejs.org/) 22+.

```bash
npm install
npm run dev
```

`npm install` is required. Running `npm run dev` before that fails because Vite is not on disk yet. Then open the URL the server prints.

`npm run build` for production. `npx tsx --test src/lib/slot/engine.test.ts` for the math tests.

Symbol art is stored as WebP base64 under `assets/b64/` and written into `public/` on `npm install`.

## How it plays

| Piece | What it does |
|---|---|
| Clusters | 5+ matching symbols, orthogonal. Pays, then tumbles. |
| Charged wilds | Adjacent wins raise the wild’s multiplier. Highest wild on a cluster is used (not summed). |
| Void Hearts | Persist through Riftwalk. Collect nearby values, then detonate. |
| Eclipse | Board-wide event on a full screen of specials. |
| Heat | Fibonacci multiplier, **Riftwalk only**. Carry cap 3 (5×), index cap 7 (21×). |
| Riftwalk | Free spins. Sticky hearts stay; wilds do not persist between spins. |
| Wins | Uncapped. Big / Mega / Epic / Rift-break overlays from 15× / 40× / 100× / 500×. |

Ante and bonus-buy are on the same board. Turbo is opt-in (saved as `aether-rift-turbo`).

## Embed / wallet API

Point an iframe at `/?embed=1`. The game talks to the parent on channel `aether-rift` (v1):

**Game → host**

- `ready`
- `txn.request` `{ id, kind: "debit" \| "credit", amount, reason }`
- `round.end` with win / balance fields
- `error`

**Host → game**

- `init` `{ balance, currency, autoConfirm }`
- `txn.result` `{ id, ok, balance, error? }`
- `setBalance`

A demo host lives at `/integrator`. CORS is open on the slot API (`content-type`, `x-slot-session`).

### REST

| Method | Path | Purpose |
|---|---|
| `GET` | `/api/slot/config` | Paytable, bets, feature costs |
| `POST` | `/api/slot/session` | Demo session |
| `POST` | `/api/slot/spin` | Play a round (body includes bet, mode, optional bonus token) |
| `POST` | `/api/slot/bonus-buy` | Purchase Riftwalk |

RNG, cluster evaluation, tumbles, heat, and token signing all happen in these handlers — the client only animates the returned `SpinResult`.

## Project layout

```
src/lib/slot/           engine, math, RNG, HMAC tokens, types
src/routes/api/slot/    REST
src/components/slot/    board, overlays, audio, iframe bridge
src/routes/index.tsx    game
src/routes/integrator.tsx
public/slot/            chroma-keyed symbol art (WebP, restored on npm install)
```

## License / use

Built as a **social casino** demo. Do not wire this to real-money payments or prize redemption.
