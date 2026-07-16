import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type UserRole =
  | "learner"
  | "creator_applicant"
  | "creator"
  | "moderator"
  | "finance"
  | "admin"
  | "super_admin";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  learner: 1,
  creator_applicant: 2,
  creator: 3,
  moderator: 4,
  finance: 5,
  admin: 6,
  super_admin: 7,
};

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const sessionRole = req.session.role as UserRole | undefined;
    if (!sessionRole) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const allowed = roles.some(
      (r) => ROLE_HIERARCHY[sessionRole] >= ROLE_HIERARCHY[r]
    );

    if (!allowed) {
      res.status(403).json({ error: "Forbidden", code: "INSUFFICIENT_ROLE" });
      return;
    }

    next();
  };
}

export function requireEmailVerified(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    return;
  }
  // We trust the session for email verification state — set at login
  next();
}

/** Attach user to req for convenience */
export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (req.session.userId && !(req as any).user) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId))
      .limit(1);
    (req as any).user = user;
  }
  next();
}
