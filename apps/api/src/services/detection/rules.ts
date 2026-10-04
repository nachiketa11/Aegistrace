import type { DetectionInput, DetectionRuleModule } from "./types.js";

const allText = (event: DetectionInput) => JSON.stringify({ path: event.path, request: event.requestMetadata, response: event.responseMetadata, raw: event.rawEvidence }).toLowerCase();

export const detectionRules: DetectionRuleModule[] = [
  {
    code: "AT-001",
    detect: (event, context, rule) => {
      const authPath = /login|signin|auth|session/i.test(event.path);
      const failures = event.statusCode === 401 || event.statusCode === 403;
      if (!authPath || !failures || context.failedAuthCount < Number((rule.config as { threshold?: unknown })?.threshold ?? 5)) return null;
      return { rule, confidence: Math.min(1, context.failedAuthCount / 10), evidence: { failedAuthCount: context.failedAuthCount, threshold: Number((rule.config as { threshold?: unknown })?.threshold ?? 5), path: event.path } };
    },
  },
  { code: "AT-002", detect: (event, _context, rule) => { const m = allText(event).match(/(?:union\s+select|select\s+.+\s+from|\bor\s+['"\d]+\s*=\s*['"\d]+|--\s|%27|%3d)/i); return m ? { rule, confidence: 0.85, evidence: { pattern: "Potential SQL injection pattern detected", indicator: m[0].slice(0, 100) } } : null; } },
  { code: "AT-003", detect: (event, _context, rule) => { const m = allText(event).match(/(?:<script|javascript:|onerror\s*=|onload\s*=|%3cscript)/i); return m ? { rule, confidence: 0.82, evidence: { pattern: "Potential cross-site scripting pattern detected", indicator: m[0].slice(0, 100) } } : null; } },
  { code: "AT-004", detect: (event, _context, rule) => { const m = allText(event).match(/(?:\.\.\/|\.\.\\|%2e%2e(?:%2f|\/|\\))/i); return m ? { rule, confidence: 0.88, evidence: { pattern: "Path traversal indicator detected", indicator: m[0] } } : null; } },
  { code: "AT-005", detect: (event, _context, rule) => { const suspiciousPath = /(?:\/\.env|\/wp-admin|\/phpmyadmin|\/\.git|\/actuator|\/vendor\/phpunit)/i.test(event.path); const suspiciousAgent = /(?:nmap|sqlmap|nikto|masscan|dirbuster|gobuster|zgrab)/i.test(event.userAgent ?? ""); return suspiciousPath || suspiciousAgent ? { rule, confidence: 0.8, evidence: { suspiciousPath, suspiciousAgent, path: event.path, userAgent: event.userAgent ?? null } } : null; } },
  { code: "AT-006", detect: (_event, context, rule) => { const threshold = Number((rule.config as { threshold?: unknown })?.threshold ?? 30); return context.recentRequestCount >= threshold ? { rule, confidence: Math.min(1, context.recentRequestCount / (threshold * 2)), evidence: { requestsInWindow: context.recentRequestCount, threshold, windowSeconds: 60 } } : null; } },
  { code: "AT-007", detect: (event, _context, rule) => { const agent = event.userAgent ?? ""; const odd = !agent || /(?:curl|python-requests|go-http-client|java\/|headlesschrome|masscan)/i.test(agent); return odd ? { rule, confidence: agent ? 0.65 : 0.55, evidence: { pattern: "Uncommon or missing user agent", userAgent: agent || null } } : null; } },
  { code: "AT-008", detect: (event, _context, rule) => { const auth = /login|signin|auth|session/i.test(event.path); const mismatch = auth && event.statusCode < 400 && !event.username; const oddStatus = auth && event.statusCode >= 500; return mismatch || oddStatus ? { rule, confidence: 0.6, evidence: { pattern: "Authentication event has unusual context", usernamePresent: Boolean(event.username), statusCode: event.statusCode } } : null; } },
];
