import type { RequestHandler } from "express";

export const parseCookies: RequestHandler = (req, _res, next) => {
  const header = req.headers.cookie;
  const cookies: Record<string, string> = {};
  for (const fragment of header?.split(";") ?? []) {
    const separator = fragment.indexOf("=");
    if (separator < 1) continue;
    try { cookies[fragment.slice(0, separator).trim()] = decodeURIComponent(fragment.slice(separator + 1).trim()); } catch { /* Ignore malformed cookie values. */ }
  }
  req.cookies = cookies;
  next();
};
