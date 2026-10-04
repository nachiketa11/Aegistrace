import { Router } from "express";
import { asyncHandler, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";
import { validateBody } from "../middleware/validate.js";
import { ruleUpdateSchema } from "../validation/schemas.js";

export const rulesRouter = Router();
rulesRouter.use(authenticate);
rulesRouter.get("/", asyncHandler(async (_req, res) => res.json({ data: await prisma.detectionRule.findMany({ orderBy: { code: "asc" } }) })));
rulesRouter.patch("/:id", requireAdmin, validateBody(ruleUpdateSchema), asyncHandler(async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) throw new HttpError(400, "Detection rule id is required");
  const input = req.body as { enabled?: boolean; name?: string; description?: string; severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; config?: object };
  const existing = await prisma.detectionRule.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Detection rule not found");
  const updated = await prisma.detectionRule.update({ where: { id: existing.id }, data: input });
  await writeAudit(req, "detection_rule.updated", "DetectionRule", updated.id, { code: updated.code, fields: Object.keys(input) });
  res.json({ data: updated });
}));
