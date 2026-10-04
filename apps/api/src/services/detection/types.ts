import type { Severity } from "@prisma/client";

export type DetectionInput = {
  sourceIp: string;
  method: string;
  path: string;
  statusCode: number;
  userAgent?: string | undefined;
  username?: string | undefined;
  requestMetadata: Record<string, unknown>;
  responseMetadata: Record<string, unknown>;
  rawEvidence: Record<string, unknown>;
};

export type RuleDefinition = { id: string; code: string; name: string; description: string; severity: Severity; enabled: boolean; config: unknown };
export type DetectionMatch = { rule: RuleDefinition; evidence: Record<string, unknown>; confidence: number };
export type DetectionContext = { sourceRequestCount: number; failedAuthCount: number; recentRequestCount: number };
export type DetectionRuleModule = { code: string; detect(event: DetectionInput, context: DetectionContext, rule: RuleDefinition): DetectionMatch | null };
