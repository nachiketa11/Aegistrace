import type { DetectionInput, DetectionMatch, DetectionContext, RuleDefinition } from "./types.js";
import { detectionRules } from "./rules.js";

export function runDetection(event: DetectionInput, context: DetectionContext, rules: RuleDefinition[]): DetectionMatch[] {
  const enabled = new Map(rules.filter((rule) => rule.enabled).map((rule) => [rule.code, rule]));
  return detectionRules.flatMap((module) => {
    const rule = enabled.get(module.code);
    if (!rule) return [];
    const match = module.detect(event, context, rule);
    return match ? [match] : [];
  });
}
