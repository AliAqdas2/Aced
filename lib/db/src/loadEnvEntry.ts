import { loadEnv } from "./loadEnv";

// Side-effect entry: importing `@workspace/db/load-env` loads `.env` immediately.
loadEnv();

export { loadEnv };
