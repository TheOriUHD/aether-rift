export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-slot-session",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-max-age": "86400",
} as const;

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS,
    },
  });
}

export function emptyCors(): Response {
  return new Response(null, { status: 204, headers: { ...CORS } });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: message }, status);
}
