import "./env";
import app from "./app";
import { logger } from "./lib/logger";
import { startEmailRetryWorker } from "./lib/emailRetryWorker";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided. Set it in .env.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start background workers after the server is bound
  startEmailRetryWorker();
});
