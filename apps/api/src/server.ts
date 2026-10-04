import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";

const PORT = env.API_PORT;

app.listen(PORT, () => {
  console.log(`AegisTrace API running on http://localhost:${PORT}`);
});