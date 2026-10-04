import { Router } from "express";
import { asyncHandler, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";
import { validateBody } from "../middleware/validate.js";
import { incidentCreateSchema, incidentUpdateSchema } from "../validation/schemas.js";

export const incidentsRouter = Router();
incidentsRouter.use(authenticate);
incidentsRouter.get("/", asyncHandler(async (_req, res) => {
  const data = await prisma.incident.findMany({ include: { createdBy: { select: { id: true, name: true } }, threats: { include: { threat: { include: { rule: true } } } }, _count: { select: { notes: true } } }, orderBy: { updatedAt: "desc" } });
  res.json({ data });
}));
incidentsRouter.post("/", validateBody(incidentCreateSchema), asyncHandler(async (req, res) => {
  const { title, description, threatIds, note } = req.body as { title: string; description: string; threatIds: string[]; note?: string };
  const incident = await prisma.incident.create({ data: { title, description, createdById: req.user!.id, threats: { create: threatIds.map((threatId) => ({ threat: { connect: { id: threatId } } })) }, ...(note ? { notes: { create: { content: note, authorId: req.user!.id } } } : {}) }, include: { threats: { include: { threat: true } }, notes: true, createdBy: { select: { id: true, name: true } } } });
  await writeAudit(req, "incident.created", "Incident", incident.id, { threatCount: threatIds.length });
  res.status(201).json({ data: incident });
}));
incidentsRouter.get("/:id", asyncHandler(async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) throw new HttpError(400, "Incident id is required");
  const incident = await prisma.incident.findUnique({ where: { id }, include: { createdBy: { select: { id: true, name: true } }, threats: { include: { threat: { include: { rule: true, events: { include: { event: true } } } } } }, notes: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } } } });
  if (!incident) throw new HttpError(404, "Incident not found");
  res.json({ data: incident });
}));
incidentsRouter.patch("/:id", validateBody(incidentUpdateSchema), asyncHandler(async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) throw new HttpError(400, "Incident id is required");
  const input = req.body as { title?: string; description?: string; status?: "OPEN" | "INVESTIGATING" | "RESOLVED"; addThreatIds?: string[]; note?: string };
  const existing = await prisma.incident.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Incident not found");
  const updated = await prisma.incident.update({ where: { id: existing.id }, data: {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status ? { status: input.status, resolvedAt: input.status === "RESOLVED" ? new Date() : null } : {}),
    ...(input.addThreatIds?.length ? { threats: { create: input.addThreatIds.map((threatId) => ({ threat: { connect: { id: threatId } } })) } } : {}),
    ...(input.note ? { notes: { create: { content: input.note, authorId: req.user!.id } } } : {}),
  }, include: { threats: { include: { threat: true } }, notes: { include: { author: { select: { id: true, name: true } } } } } });
  await writeAudit(req, "incident.updated", "Incident", updated.id, { status: updated.status });
  res.json({ data: updated });
}));
incidentsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) throw new HttpError(400, "Incident id is required");
  const existing = await prisma.incident.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, "Incident not found");
  await prisma.incident.delete({ where: { id: existing.id } });
  await writeAudit(req, "incident.deleted", "Incident", existing.id);
  res.status(204).end();
}));
