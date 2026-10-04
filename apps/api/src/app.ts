import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "./lib/http.js";
import { authRouter } from "./routes/auth.js";
import { eventsRouter } from "./routes/events.js";
import { incidentsRouter } from "./routes/incidents.js";
import { rulesRouter } from "./routes/rules.js";
import { threatsRouter } from "./routes/threats.js";
import { auditRouter } from "./routes/audit.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { simulatorRouter } from "./routes/simulator.js";
import { env } from "./config/env.js";

const app = express();

app.use(
  cors({
    origin: [env.FRONTEND_URL, "https://aegistrace-not6.vercel.app"],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "AegisTrace API",
    environment: env.NODE_ENV,
  });
});

app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.use("/api/threats", threatsRouter);
app.use("/api/incidents", incidentsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/audit", auditRouter);
app.use("/api/simulator", simulatorRouter);

app.use((req, res) => {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
});

app.use(errorHandler);

export default app;