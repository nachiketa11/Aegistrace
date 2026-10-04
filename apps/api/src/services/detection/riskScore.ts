import type { Severity } from "@prisma/client";

export function scoreRisk(severity: Severity, confidence: number, occurrences = 1): number {
  const base: Record<Severity, number> = { LOW: 18, MEDIUM: 40, HIGH: 65, CRITICAL: 85 };
  const confidenceBonus = Math.round(Math.max(0, Math.min(confidence, 1)) * 10);
  const occurrenceBonus = Math.min(Math.max(occurrences - 1, 0) * 3, 15);
  const baseValue = base[severity] ?? 18;
  return Math.min(100, baseValue + confidenceBonus + occurrenceBonus);
}

export function severityForScore(score: number): Severity {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}
