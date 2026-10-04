import bcrypt from "bcrypt";
import { PrismaClient, Role, Severity } from "@prisma/client";

const prisma = new PrismaClient();

const rules = [
  {
    code: "AT-001",
    name: "Brute Force",
    description: "Repeated failed authentication attempts against the same target",
    severity: Severity.HIGH,
    enabled: true,
    config: { threshold: 5 },
  },
  {
    code: "AT-002",
    name: "Potential SQL Injection",
    description: "Request contains common SQL injection indicators or payload patterns",
    severity: Severity.CRITICAL,
    enabled: true,
    config: { threshold: 1 },
  },
  {
    code: "AT-003",
    name: "Potential XSS",
    description: "Request contains HTML or JavaScript payloads indicative of reflected XSS",
    severity: Severity.HIGH,
    enabled: true,
    config: { threshold: 1 },
  },
  {
    code: "AT-004",
    name: "Path Traversal",
    description: "Request path includes traversal sequences or encoded traversal patterns",
    severity: Severity.HIGH,
    enabled: true,
    config: { threshold: 1 },
  },
  {
    code: "AT-005",
    name: "Scanner Activity",
    description: "Suspicious scanners, admin discovery probes, or common recon paths",
    severity: Severity.MEDIUM,
    enabled: true,
    config: { threshold: 1 },
  },
  {
    code: "AT-006",
    name: "High Request Rate",
    description: "Traffic spike exceeds the configured burst threshold within a short window",
    severity: Severity.MEDIUM,
    enabled: true,
    config: { threshold: 30 },
  },
  {
    code: "AT-007",
    name: "Suspicious User Agent",
    description: "Requests originate from automation tooling, scanners, or an empty/malformed user-agent",
    severity: Severity.MEDIUM,
    enabled: true,
    config: { threshold: 1 },
  },
  {
    code: "AT-008",
    name: "Authentication Anomaly",
    description: "Authentication-related requests show unusual status or missing identity context",
    severity: Severity.MEDIUM,
    enabled: true,
    config: { threshold: 1 },
  },
] as const;

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed the admin account.");
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: "Aegis Admin", role: Role.ADMIN, passwordHash },
    create: {
      email: adminEmail,
      name: "Aegis Admin",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  for (const rule of rules) {
    await prisma.detectionRule.upsert({
      where: { code: rule.code },
      update: {
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        enabled: rule.enabled,
        config: rule.config,
      },
      create: {
        code: rule.code,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        enabled: rule.enabled,
        config: rule.config,
      },
    });
  }

  console.log("Seed completed: admin account and detection rules are ready.");
}

void main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
