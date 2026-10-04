import { Router } from "express";
import { asyncHandler, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";
import { validateBody } from "../middleware/validate.js";
import { threatStatusSchema } from "../validation/schemas.js";

export const threatsRouter = Router();
threatsRouter.use(authenticate);
threatsRouter.get("/", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
  const where = { ...(status ? { status: status as "OPEN" } : {}), ...(severity ? { severity: severity as "HIGH" } : {}) };
  const [data, total] = await Promise.all([prisma.threat.findMany({ where, include: { rule: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.threat.count({ where })]);
  res.json({ data, pagination: { page, limit, total } });
}));
threatsRouter.get("/:id", asyncHandler(async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) throw new HttpError(400, "Threat id is required");
  const threat = await prisma.threat.findUnique({ where: { id }, include: { rule: true, events: { include: { event: true } }, incidents: { include: { incident: true } } } });
  if (!threat) throw new HttpError(404, "Threat not found");
  res.json({ data: threat });
}));
threatsRouter.patch("/:id/status", validateBody(threatStatusSchema), asyncHandler(async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) throw new HttpError(400, "Threat id is required");
  const { status } = req.body as { status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "FALSE_POSITIVE" };
  const existing = await prisma.threat.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Threat not found");
  const updated = await prisma.threat.update({ where: { id: existing.id }, data: { status }, include: { rule: true } });
  await writeAudit(req, "threat.status.updated", "Threat", updated.id, { from: existing.status, to: status });
  res.json({ data: updated });
}));
