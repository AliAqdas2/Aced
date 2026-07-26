/**
 * Background email retry worker.
 *
 * Polls the `failed_emails` dead-letter table every POLL_INTERVAL_MS and
 * attempts re-delivery for any row that:
 *   - has not been manually resolved (resolvedAt IS NULL)
 *   - has not been permanently failed out (permanentlyFailed = false)
 *   - is due for retry (nextRetryAt <= now)
 *
 * Attempt accounting
 * ------------------
 * sendEmailResilient performs (MAX_INLINE_RETRIES + 1) = 4 inline attempts
 * before persisting a row with attempts = 4.  The worker then applies up to
 * BACKOFF_MINUTES.length additional retries, each indexed from 0:
 *
 *   workerRetryIndex = row.attempts - INITIAL_INLINE_ATTEMPTS
 *
 *   index 0 → 5 min   (row.attempts was 4 when worker first ran)
 *   index 1 → 15 min
 *   index 2 →  1 h
 *   index 3 →  6 h
 *   index 4 → 24 h
 *   → permanently failed after 5 worker retries (total = 9 attempts)
 *
 * On permanent failure the row is flagged with permanentlyFailed = true and a
 * structured JSON alert is written to stderr for ops dashboards to pick up.
 */

import { db, failedEmailsTable } from "@workspace/db";
import { and, eq, isNull, lte } from "drizzle-orm";
import { sendEmail } from "./email";
import { logger } from "./logger";

const POLL_INTERVAL_MS = 60_000; // check every 60 s

/**
 * How many attempts sendEmailResilient makes inline before persisting a row.
 * sendEmailResilient calls retryWithBackoff with retries=3, so it tries
 * attempts 0,1,2,3 (= 4 total).  Must stay in sync with that call.
 */
const INITIAL_INLINE_ATTEMPTS = 4;

/** Backoff delay in minutes for worker retry index 0,1,2,3,4 */
const BACKOFF_MINUTES = [5, 15, 60, 360, 1440];

/**
 * Total attempts ceiling.  Once row.attempts reaches this value the email is
 * permanently failed.  = INITIAL_INLINE_ATTEMPTS + BACKOFF_MINUTES.length
 */
const MAX_TOTAL_ATTEMPTS = INITIAL_INLINE_ATTEMPTS + BACKOFF_MINUTES.length; // 9

function nextBackoffMs(workerRetryIndex: number): number {
  const minutes =
    BACKOFF_MINUTES[workerRetryIndex] ??
    BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1]!;
  return minutes * 60 * 1000;
}

async function runRetryPass(): Promise<void> {
  const now = new Date();

  // Pick up to 20 rows that are due for retry
  const due = await db
    .select()
    .from(failedEmailsTable)
    .where(
      and(
        isNull(failedEmailsTable.resolvedAt),
        eq(failedEmailsTable.permanentlyFailed, false),
        lte(failedEmailsTable.nextRetryAt, now)
      )
    )
    .limit(20);

  if (due.length === 0) return;

  logger.info({ count: due.length }, "emailRetryWorker: processing due entries");

  for (const row of due) {
    // Guard: shouldn't happen, but permanently fail rows that somehow hit the ceiling
    if (row.attempts >= MAX_TOTAL_ATTEMPTS) {
      await db
        .update(failedEmailsTable)
        .set({ permanentlyFailed: true, nextRetryAt: null })
        .where(eq(failedEmailsTable.id, row.id));
      continue;
    }

    try {
      await sendEmail({
        to: row.toEmail,
        subject: row.subject,
        html: row.htmlBody,
        ...(row.textBody ? { text: row.textBody } : {}),
      });

      // Success — mark as resolved
      await db
        .update(failedEmailsTable)
        .set({ resolvedAt: new Date(), nextRetryAt: null })
        .where(eq(failedEmailsTable.id, row.id));

      logger.info(
        { id: row.id, to: row.toEmail, context: row.context },
        "emailRetryWorker: retry succeeded"
      );
    } catch (err) {
      const newAttempts = row.attempts + 1;

      if (newAttempts >= MAX_TOTAL_ATTEMPTS) {
        // Permanently give up
        await db
          .update(failedEmailsTable)
          .set({
            attempts: newAttempts,
            errorMessage: err instanceof Error ? err.message : String(err),
            permanentlyFailed: true,
            nextRetryAt: null,
          })
          .where(eq(failedEmailsTable.id, row.id));

        // Structured stderr alert for log aggregators / ops dashboards
        process.stderr.write(
          JSON.stringify({
            event: "email_permanently_failed",
            id: row.id,
            context: row.context,
            to: row.toEmail,
            subject: row.subject,
            totalAttempts: newAttempts,
            error: err instanceof Error ? err.message : String(err),
          }) + "\n"
        );

        logger.error(
          {
            id: row.id,
            to: row.toEmail,
            context: row.context,
            attempts: newAttempts,
          },
          "emailRetryWorker: email permanently failed after max attempts"
        );
      } else {
        // The worker retry index (0-based) determines which backoff stage to use.
        // row.attempts starts at INITIAL_INLINE_ATTEMPTS (4) for a fresh row,
        // so index 0 → 5 min, index 1 → 15 min, etc.
        const workerRetryIndex = row.attempts - INITIAL_INLINE_ATTEMPTS;
        const nextRetryAt = new Date(Date.now() + nextBackoffMs(workerRetryIndex));

        await db
          .update(failedEmailsTable)
          .set({
            attempts: newAttempts,
            errorMessage: err instanceof Error ? err.message : String(err),
            nextRetryAt,
          })
          .where(eq(failedEmailsTable.id, row.id));

        logger.warn(
          {
            id: row.id,
            to: row.toEmail,
            context: row.context,
            attempt: newAttempts,
            nextRetryAt,
          },
          "emailRetryWorker: retry failed, scheduled next attempt"
        );
      }
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Start the background retry worker. Safe to call multiple times (idempotent). */
export function startEmailRetryWorker(): void {
  if (timer !== null) return;

  logger.info({ intervalMs: POLL_INTERVAL_MS }, "emailRetryWorker: started");

  // Run an initial pass shortly after boot so failures from a crash are
  // retried quickly without waiting for the first full interval.
  setTimeout(() => {
    runRetryPass().catch((err) =>
      logger.error({ err }, "emailRetryWorker: initial pass error")
    );
  }, 10_000);

  timer = setInterval(() => {
    runRetryPass().catch((err) =>
      logger.error({ err }, "emailRetryWorker: poll error")
    );
  }, POLL_INTERVAL_MS);

  // Don't hold the event loop open — the worker is background-only
  if (timer.unref) timer.unref();
}

/** Stop the background retry worker (mainly used in tests). */
export function stopEmailRetryWorker(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}
