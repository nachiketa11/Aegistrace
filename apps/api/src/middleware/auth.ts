import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { Role } from "@prisma/client";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const sessionCookieName = "aegistrace_session";
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[sessionCookieName] as string | undefined;
    if (!token) throw new HttpError(401, "Authentication required");
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } });
      throw new HttpError(401, "Session expired. Please sign in again.");
    }
    req.user = { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role };
    next();
  } catch (error) { next(error); }
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user || req.user.role !== Role.ADMIN) return next(new HttpError(403, "Administrator access required"));
  next();
};
