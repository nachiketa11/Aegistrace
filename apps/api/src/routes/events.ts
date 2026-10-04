import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { eventBatchSchema, eventSchema } from "../validation/schemas.js";
import { ingestEvents } from "../services/ingestionService.js";
import { parseCsv } from "../services/csv.js";

export const eventsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1_048_576, files: 1 } });
const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), sourceIp: z.string().max(45).optional(), search: z.string().max(200).optional() });

eventsRouter.use(authenticate);
eventsRouter.get("/", asyncHandler(async (req, res) => {
  const query = querySchema.parse(req.query);
  const where = { ...(query.sourceIp ? { sourceIp: query.sourceIp } : {}), ...(query.search ? { OR: [{ path: { contains: query.search, mode: "insensitive" as const } }, { userAgent: { contains: query.search, mode: "insensitive" as const } }] } : {}) };
  const [data, total] = await Promise.all([
    prisma.event.findMany({ where, orderBy: { occurredAt: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit, include: { threats: { include: { threat: { select: { id: true, riskScore: true, severity: true } } } } } }),
    prisma.event.count({ where }),
  ]);
  res.json({ data, pagination: { page: query.page, limit: query.limit, total } });
}));
eventsRouter.get("/:id", asyncHandler(async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) throw new HttpError(400, "Event id is required");
  const event = await prisma.event.findUnique({ where: { id }, include: { threats: { include: { threat: { include: { rule: true } } } } } });
  if (!event) throw new HttpError(404, "Event not found");
  res.json({ data: event });
}));
eventsRouter.post("/", validateBody(z.union([eventSchema, eventBatchSchema])), asyncHandler(async (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body];
  const result = await ingestEvents(payload);
  res.status(201).json({ data: result });
}));

eventsRouter.post("/upload", upload.single("file"), asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, "Choose a JSON, JSONL, or CSV file");
  const filename = file.originalname.toLowerCase();
  let raw: unknown;
  try {
    const contents = file.buffer.toString("utf8");
    if (filename.endsWith(".json")) raw = JSON.parse(contents);
    else if (filename.endsWith(".jsonl") || filename.endsWith(".ndjson")) raw = contents.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
    else if (filename.endsWith(".csv")) raw = parseCsv(contents);
    else throw new HttpError(415, "Only JSON, JSONL, and CSV files are supported");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "File could not be parsed");
  }
  if (!Array.isArray(raw)) raw = [raw];
  const parsed = eventBatchSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "File rows do not match the event format");
  const result = await ingestEvents(parsed.data);
  res.status(201).json({ data: result });
}));
