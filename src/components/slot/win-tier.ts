export type WinTier = "big" | "mega" | "epic" | "rift";

export function winTier(x: number): { label: string; tier: WinTier } | null {
  if (x >= 500) return { label: "Rift break", tier: "rift" };
  if (x >= 100) return { label: "Epic win", tier: "epic" };
  if (x >= 40) return { label: "Mega win", tier: "mega" };
  if (x >= 15) return { label: "Big win", tier: "big" };
  return null;
}
