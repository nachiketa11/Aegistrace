import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { runDetection } from "./detection/engine.js";
import { scoreRisk, severityForScore } from "./detection/riskScore.js";
import type { DetectionInput } from "./detection/types.js";
import type { z } from "zod";
import type { eventSchema } from "../validation/schemas.js";

const asJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

type IncomingEvent = z.infer<typeof eventSchema>;

const isFailedAuth = (event: IncomingEvent) => /login|signin|auth|session/i.test(event.path) && (event.statusCode === 401 || event.statusCode === 403);

export async function ingestEvents(input: IncomingEvent[]) {
  const ipCounts = new Map<string, number>();
  const failCounts = new Map<string, number>();
  for (const event of input) {
    ipCounts.set(event.sourceIp, (ipCounts.get(event.sourceIp) ?? 0) + 1);
    if (isFailedAuth(event)) failCounts.set(event.sourceIp, (failCounts.get(event.sourceIp) ?? 0) + 1);
  }
  const recentCounts = await prisma.event.groupBy({
    by: ["sourceIp"],
    where: { occurredAt: { gte: new Date(Date.now() - 60_000) } },
    _count: { _all: true },
  });
  const recentCountByIp = new Map<string, number>(recentCounts.map((entry) => [entry.sourceIp, entry._count._all ?? 0]));
  const rules = await prisma.detectionRule.findMany({ where: { enabled: true } });
  return prisma.$transaction(async (tx) => {
    const eventResults = [];
    const threatResults = [];
    for (const incoming of input) {
      const event = await tx.event.create({ data: {
        occurredAt: incoming.timestamp ?? new Date(), sourceIp: incoming.sourceIp, method: incoming.method,
        path: incoming.path, statusCode: incoming.statusCode,
        ...(incoming.userAgent ? { userAgent: incoming.userAgent } : {}),
        ...(incoming.username ? { username: incoming.username } : {}),
        requestMetadata: asJsonValue(toRecord(incoming.requestMetadata)), responseMetadata: asJsonValue(toRecord(incoming.responseMetadata)),
        rawEvidence: asJsonValue(toRecord(incoming.rawEvidence)),
      } });
      const normalized: DetectionInput = { sourceIp: event.sourceIp, method: event.method, path: event.path, statusCode: event.statusCode, userAgent: event.userAgent ?? undefined, username: event.username ?? undefined, requestMetadata: toRecord(incoming.requestMetadata), responseMetadata: toRecord(incoming.responseMetadata), rawEvidence: toRecord(incoming.rawEvidence) };
      const recent = recentCountByIp.get(event.sourceIp) ?? 0;
      const context = { sourceRequestCount: ipCounts.get(event.sourceIp) ?? 1, failedAuthCount: failCounts.get(event.sourceIp) ?? 0, recentRequestCount: recent + (ipCounts.get(event.sourceIp) ?? 0) };
      const matches = runDetection(normalized, context, rules);
      const persisted = [];
      for (const match of matches) {
        const riskScore = scoreRisk(match.rule.severity, match.confidence, context.sourceRequestCount);
        const severity = severityForScore(riskScore);
        const threat = await tx.threat.create({ data: {
          ruleId: match.rule.id, sourceIp: event.sourceIp, endpoint: event.path, severity, riskScore,
          evidence: asJsonValue({ ...match.evidence, eventTimestamp: event.occurredAt.toISOString() }), occurrenceCount: context.sourceRequestCount,
          firstSeenAt: event.occurredAt, lastSeenAt: event.occurredAt,
          events: { create: { eventId: event.id } },
        }, include: { rule: true } });
        persisted.push(threat);
      }
      eventResults.push(event);
      threatResults.push(...persisted);
    }
    return { events: eventResults, threats: threatResults };
  }, { timeout: 30000, maxWait: 30000 });
}
