/**
 * HTML entity encode/decode without putting named-entity literals in source.
 * MCP/XML upload historically decoded those literals and left invalid JS.
 */
const AMP = String.fromCharCode(38);
const LT = String.fromCharCode(60);
const GT = String.fromCharCode(62);
const QUOT = String.fromCharCode(34);
const APOS = String.fromCharCode(39);

export { AMP };

export function escapeHtml(value) {
  const named = {
    [AMP]: AMP + "amp;",
    [LT]: AMP + "lt;",
    [GT]: AMP + "gt;",
    [QUOT]: AMP + "quot;",
    [APOS]: AMP + "#39;",
  };
  const input = String(value);
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    out += named[ch] ?? ch;
  }
  return out;
}

/** Inverse of escapeHtml. Decode amp last so a single pass undoes one encode. */
export function unescapeHtml(value) {
  return String(value)
    .replaceAll(AMP + "lt;", LT)
    .replaceAll(AMP + "gt;", GT)
    .replaceAll(AMP + "quot;", QUOT)
    .replaceAll(AMP + "#39;", APOS)
    .replaceAll(AMP + "amp;", AMP);
}
