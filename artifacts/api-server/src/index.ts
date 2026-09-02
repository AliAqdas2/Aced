import "./env";
import app from "./app";
import { logger } from "./lib/logger";
import { startEmailRetryWorker } from "./lib/emailRetryWorker";
import { getLiveDbIdentity, redactDatabaseUrl } from "@workspace/db";

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

async function logDatabaseTarget(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const configured = databaseUrl
    ? redactDatabaseUrl(databaseUrl)
    : { parseError: true as const };

  try {
    const live = await getLiveDbIdentity();
    logger.info(
      { configured, live },
      "Database connection target",
    );
  } catch (err) {
    logger.error(
      { err, configured },
      "Failed to query live database identity",
    );
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  void logDatabaseTarget();

  // Start background workers after the server is bound
  startEmailRetryWorker();
});
