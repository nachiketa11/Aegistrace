import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../lib/http.js";
import { ingestEvents } from "../services/ingestionService.js";
import { simulatorSchema } from "../validation/schemas.js";

export const simulatorRouter = Router();
simulatorRouter.use(authenticate);

const scenarioMap: Record<"NORMAL" | "BRUTE_FORCE" | "SQL_INJECTION" | "XSS" | "SCANNER" | "MIXED", string[]> = {
  NORMAL: ["GET", "POST", "GET"],
  BRUTE_FORCE: ["POST", "POST", "POST", "POST", "POST"],
  SQL_INJECTION: ["GET", "POST", "GET"],
  XSS: ["GET", "POST"],
  SCANNER: ["GET", "GET", "GET"],
  MIXED: ["GET", "POST", "GET", "POST", "GET"],
};

function buildScenarioEvents(scenario: keyof typeof scenarioMap, count: number) {
  const events: Array<{
    timestamp: Date;
    sourceIp: string;
    method: string;
    path: string;
    statusCode: number;
    userAgent?: string;
    username?: string;
    requestMetadata: Record<string, unknown>;
    responseMetadata: Record<string, unknown>;
    rawEvidence: Record<string, unknown>;
  }> = [];
  const requested = Math.max(1, Math.min(count, 100));

  for (let index = 0; index < requested; index += 1) {
    const variant = scenarioMap[scenario][index % scenarioMap[scenario].length] ?? "GET";
    const timestamp = new Date(Date.now() - index * 30000);
    const baseIp = `10.0.0.${(index % 250) + 1}`;

    if (scenario === "BRUTE_FORCE") {
      events.push({
        timestamp,
        sourceIp: baseIp,
        method: "POST",
        path: "/api/auth/login",
        statusCode: index % 3 === 0 ? 401 : 403,
        userAgent: "curl/8.0.0",
        username: `attacker${index}`,
        requestMetadata: { email: `user${index}@example.com`, password: "password123" },
        responseMetadata: { message: "Authentication failed" },
        rawEvidence: { attempts: index + 1, failureReason: "invalid credentials" },
      });
      continue;
    }

    if (scenario === "SQL_INJECTION") {
      const payload = index % 2 === 0 ? "admin' OR 1=1 --" : "UNION SELECT password FROM users";
      events.push({
        timestamp,
        sourceIp: baseIp,
        method: "GET",
        path: `/api/search?q=${encodeURIComponent(payload)}`,
        statusCode: 200,
        userAgent: "python-requests/2.31",
        username: "analyst",
        requestMetadata: { query: payload },
        responseMetadata: { latencyMs: 42 },
        rawEvidence: { pattern: "Potential SQL injection pattern detected", query: payload },
      });
      continue;
    }

    if (scenario === "XSS") {
      const payload = "<script>alert('x')</script>";
      events.push({
        timestamp,
        sourceIp: baseIp,
        method: "GET",
        path: `/api/search?q=${encodeURIComponent(payload)}`,
        statusCode: 200,
        userAgent: "Mozilla/5.0 (compatible; XSSBot)",
        username: "analyst",
        requestMetadata: { search: payload },
        responseMetadata: { latencyMs: 88 },
        rawEvidence: { pattern: "Potential cross-site scripting pattern detected", payload },
      });
      continue;
    }

    if (scenario === "SCANNER") {
      events.push({
        timestamp,
        sourceIp: baseIp,
        method: "GET",
        path: index % 2 === 0 ? "/.git/config" : "/phpmyadmin",
        statusCode: 404,
        userAgent: "nmap/7.94",
        requestMetadata: { scanner: true },
        responseMetadata: { message: "Not found" },
        rawEvidence: { fingerprint: "scanner activity" },
      });
      continue;
    }

    if (scenario === "MIXED") {
      const mix = [
        { path: "/api/auth/login", statusCode: 401 },
        { path: "/api/search?q=admin%27%20OR%201%3D1%20--", statusCode: 200 },
        { path: "/api/search?q=%3Cscript%3Ealert%281%29%3C%2Fscript%3E", statusCode: 200 },
        { path: "/api/health", statusCode: 200 },
        { path: "/.git/config", statusCode: 404 },
      ];
      const current = mix[Math.min(index % mix.length, mix.length - 1)];
      if (!current) {
        throw new Error("Mixed scenario definition is empty.");
      }
      events.push({
        timestamp,
        sourceIp: baseIp,
        method: variant,
        path: current.path,
        statusCode: current.statusCode,
        userAgent: current.path.includes("auth") ? "curl/8.0.0" : "Mozilla/5.0",
        ...(current.path.includes("auth") ? { username: `user${index}` } : {}),
        requestMetadata: { scenario: "mixed" },
        responseMetadata: { message: current.statusCode === 200 ? "ok" : "not found" },
        rawEvidence: { eventIndex: index, scenario: "mixed" },
      });
      continue;
    }

    events.push({
      timestamp,
      sourceIp: baseIp,
      method: variant,
      path: index % 2 === 0 ? "/api/dashboard/overview" : "/api/events",
      statusCode: 200,
      userAgent: "Mozilla/5.0 (compatible; AegisTrace-Agent)",
      username: "analyst",
      requestMetadata: { page: index },
      responseMetadata: { message: "ok" },
      rawEvidence: { eventIndex: index },
    });
  }

  return events;
}

simulatorRouter.post("/generate", validateBody(simulatorSchema), asyncHandler(async (req, res) => {
  const { scenario, count } = req.body as { scenario: keyof typeof scenarioMap; count: number };
  const incoming = buildScenarioEvents(scenario, count);
  const result = await ingestEvents(incoming);

  res.status(201).json({
    data: {
      scenario,
      generated: incoming.length,
      persistedEvents: result.events.length,
      persistedThreats: result.threats.length,
      sampleThreats: result.threats.slice(0, 5).map((threat) => ({
        id: threat.id,
        rule: threat.rule.code,
        severity: threat.severity,
        riskScore: threat.riskScore,
        sourceIp: threat.sourceIp,
      })),
    },
  });
}));
