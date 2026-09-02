import { Router, type IRouter } from "express";
import { getLiveDbIdentity, redactDatabaseUrl } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const databaseUrl = process.env.DATABASE_URL;
  const configured = databaseUrl
    ? redactDatabaseUrl(databaseUrl)
    : { parseError: true as const };

  try {
    const live = await getLiveDbIdentity();
    const db =
      "parseError" in configured
        ? {
            connected: true as const,
            database: live.database,
            serverAddr: live.serverAddr,
            user: live.dbUser,
            parseError: true as const,
          }
        : {
            connected: true as const,
            host: configured.host,
            port: configured.port,
            database: live.database ?? configured.database,
            user: configured.user,
            serverAddr: live.serverAddr,
          };

    res.json({ status: "ok", db });
  } catch {
    const db =
      "parseError" in configured
        ? { connected: false as const, parseError: true as const }
        : {
            connected: false as const,
            host: configured.host,
            port: configured.port,
            database: configured.database,
            user: configured.user,
          };

    res.status(503).json({ status: "degraded", db });
  }
});

export default router;
