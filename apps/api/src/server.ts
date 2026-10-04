import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : env.API_PORT;

// Vercel detects this file as the Express entrypoint. Exporting the app
// directly lets Vercel manage the HTTP server; the listener is only needed
// for local development.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`AegisTrace API running on http://localhost:${PORT}`);
  });
}

export default app;
