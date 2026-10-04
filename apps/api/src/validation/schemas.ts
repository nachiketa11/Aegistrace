import { z } from "zod";

const metadata = z.record(z.string(), z.unknown()).default({});
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128).regex(/[a-z]/, "Password must include a lowercase letter").regex(/[A-Z]/, "Password must include an uppercase letter").regex(/[0-9]/, "Password must include a number"),
});
export const loginSchema = z.object({ email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()), password: z.string().min(1).max(128) });
export const eventSchema = z.object({
  timestamp: z.coerce.date().optional(),
  sourceIp: z.string().trim().min(1).max(45),
  method: z.string().trim().toUpperCase().regex(/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/),
  path: z.string().trim().startsWith("/").max(2048),
  statusCode: z.number().int().min(100).max(599),
  userAgent: z.string().max(1024).optional(),
  username: z.string().max(320).optional(),
  requestMetadata: metadata,
  responseMetadata: metadata,
  rawEvidence: metadata,
});
export const eventBatchSchema = z.array(eventSchema).min(1).max(500);
export const incidentCreateSchema = z.object({ title: z.string().trim().min(3).max(200), description: z.string().trim().max(4000).default(""), threatIds: z.array(z.string().cuid()).max(100).default([]), note: z.string().trim().max(4000).optional() });
export const incidentUpdateSchema = z.object({ title: z.string().trim().min(3).max(200).optional(), description: z.string().trim().max(4000).optional(), status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED"]).optional(), addThreatIds: z.array(z.string().cuid()).max(100).optional(), note: z.string().trim().min(1).max(4000).optional() }).refine((value) => Object.keys(value).length > 0);
export const threatStatusSchema = z.object({ status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"]) });
export const ruleUpdateSchema = z.object({ enabled: z.boolean().optional(), name: z.string().trim().min(3).max(120).optional(), description: z.string().trim().min(3).max(500).optional(), severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(), config: z.record(z.string(), z.unknown()).optional() }).refine((value) => Object.keys(value).length > 0);
export const simulatorSchema = z.object({ scenario: z.enum(["NORMAL", "BRUTE_FORCE", "SQL_INJECTION", "XSS", "SCANNER", "MIXED"]), count: z.number().int().min(1).max(100).default(20) });
