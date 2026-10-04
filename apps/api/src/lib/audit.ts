import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "./prisma.js";

export async function writeAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  const auditData: Prisma.AuditLogCreateInput = {
    action,
    entityType,
    metadata: metadata as Prisma.InputJsonValue,
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    ...(entityId ? { entityId } : {}),
    ...(req.ip ? { ipAddress: req.ip } : {}),
  };

  await prisma.auditLog.create({ data: auditData });
}
