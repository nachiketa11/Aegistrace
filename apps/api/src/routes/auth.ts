import { randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import { env, isProduction } from "../config/env.js";
import { writeAudit } from "../lib/audit.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { authRateLimit } from "../middleware/rateLimits.js";
import { authenticate, hashToken, sessionCookieName } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../validation/schemas.js";

export const authRouter = Router();
const cookieOptions = { httpOnly: true, secure: isProduction, sameSite: "lax" as const, path: "/", maxAge: 1000 * 60 * 60 * 24 * 7 };

authRouter.post("/register", authRateLimit, validateBody(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password } = req.body as { name: string; email: string; password: string };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "An account with this email already exists");
  const user = await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: Role.ANALYST } });
  await writeAudit(req, "auth.register", "User", user.id);
  res.status(201).json({ data: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));

authRouter.post("/login", authRateLimit, validateBody(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, "Email or password is incorrect");
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + cookieOptions.maxAge) } });
  res.cookie(sessionCookieName, token, cookieOptions);
  req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
  await writeAudit(req, "auth.login", "User", user.id);
  res.json({ data: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));

authRouter.post("/logout", authenticate, asyncHandler(async (req, res) => {
  const token = req.cookies?.[sessionCookieName] as string | undefined;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  await writeAudit(req, "auth.logout", "User", req.user?.id);
  res.clearCookie(sessionCookieName, { httpOnly: true, secure: isProduction, sameSite: "lax", path: "/" });
  res.status(204).end();
}));

authRouter.get("/me", authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, name: true, email: true, role: true } });
  if (!user) throw new HttpError(401, "Authentication required");
  res.json({ data: user });
}));

void env;
