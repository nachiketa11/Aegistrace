import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get("/overview", asyncHandler(async (_req, res) => {
  const [totalEvents, activeThreats, criticalHighThreats, openIncidents, resolvedIncidents, recentThreats] = await Promise.all([
    prisma.event.count(),
    prisma.threat.count({ where: { status: { notIn: ["RESOLVED", "FALSE_POSITIVE"] } } }),
    prisma.threat.count({ where: { OR: [{ severity: "HIGH" }, { severity: "CRITICAL" }] } }),
    prisma.incident.count({ where: { status: { not: "RESOLVED" } } }),
    prisma.incident.count({ where: { status: "RESOLVED" } }),
    prisma.threat.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { rule: true },
    }),
  ]);

  res.json({
    data: {
      totalEvents,
      activeThreats,
      criticalHighThreats,
      openIncidents,
      resolvedIncidents,
      recentThreats,
    },
  });
}));

dashboardRouter.get("/timeline", asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const events = await prisma.event.findMany({
    where: { occurredAt: { gte: since } },
    select: { occurredAt: true },
    orderBy: { occurredAt: "asc" },
  });

  const buckets = new Map<string, { label: string; events: number; threats: number }>();
  for (const event of events) {
    const label = new Date(event.occurredAt).toISOString().slice(0, 10);
    const existing = buckets.get(label) ?? { label, events: 0, threats: 0 };
    existing.events += 1;
    buckets.set(label, existing);
  }

  const threats = await prisma.threat.findMany({
    where: { firstSeenAt: { gte: since } },
    select: { firstSeenAt: true },
  });

  for (const threat of threats) {
    const label = new Date(threat.firstSeenAt).toISOString().slice(0, 10);
    const existing = buckets.get(label) ?? { label, events: 0, threats: 0 };
    existing.threats += 1;
    buckets.set(label, existing);
  }

  res.json({ data: Array.from(buckets.values()).sort((a, b) => a.label.localeCompare(b.label)) });
}));

dashboardRouter.get("/threat-distribution", asyncHandler(async (_req, res) => {
  const threats = await prisma.threat.findMany({ select: { severity: true } });
  const distribution = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const threat of threats) distribution[threat.severity] += 1;
  res.json({ data: Object.entries(distribution).map(([severity, count]) => ({ severity, count })) });
}));
