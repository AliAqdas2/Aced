import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Load the nearest `.env` file, walking up from `startDir` (default: cwd)
 * and then from this module's directory. Safe to call multiple times.
 */
export function loadEnv(startDir: string = process.cwd()): void {
  const candidates = collectSearchRoots(startDir);

  for (const dir of candidates) {
    const envPath = path.join(dir, ".env");
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return;
    }
  }

  // Fall back to dotenv's default cwd lookup
  dotenv.config();
}

function collectSearchRoots(startDir: string): string[] {
  const roots: string[] = [];
  const seen = new Set<string>();

  const walk = (from: string) => {
    let dir = path.resolve(from);
    for (;;) {
      if (!seen.has(dir)) {
        seen.add(dir);
        roots.push(dir);
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  };

  walk(startDir);
  walk(path.dirname(fileURLToPath(import.meta.url)));

  return roots;
}
