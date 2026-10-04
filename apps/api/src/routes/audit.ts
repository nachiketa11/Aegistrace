import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

export const auditRouter = Router();
auditRouter.use(authenticate, requireAdmin);
auditRouter.get("/", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const [data, total] = await Promise.all([prisma.auditLog.findMany({ include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.auditLog.count()]);
  res.json({ data, pagination: { page, limit, total } });
}));
