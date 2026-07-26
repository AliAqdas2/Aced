import { useState } from 'react';
import { useGetAdminApplications, getGetAdminApplicationsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, Mail, Loader2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── Email template previews ───────────────────────────────────────────────────
// These functions mirror the EXACT server-side builder functions called by the
// POST /api/v1/admin/applications/:id/decision endpoint in creators.ts:
//   approved          → buildApprovalEmail      (email.ts:224)
//   rejected          → buildRejectionEmail     (email.ts:248)
//   changes_requested → buildChangesRequestedEmail (email.ts:268)
// Subjects are copied verbatim from the sendEmailResilient calls in creators.ts.

const APP_URL = 'https://acedtutoring.co.uk';

/** Mirrors buildApprovalEmail in email.ts — subject: "You're approved — welcome to Aced! 🎉" */
function buildApprovalPreview(name: string): { subject: string; html: string } {
  const studioUrl = `${APP_URL}/studio`;
  return {
    subject: "You're approved — welcome to Aced! 🎉",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7B2FF7;">You're Approved — Welcome to Aced! 🎉</h2>
        <p>Hi ${name},</p>
        <p>Congratulations! Your creator application has been approved. You're now ready to start sharing your expertise and earning on Aced.</p>
        <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;font-weight:bold;color:#15803d;">Get started:</p>
          <ol style="margin:8px 0 0;padding-left:20px;color:#166534;">
            <li>Set up your Stripe account to receive payouts</li>
            <li>Customise your creator studio and storefront</li>
            <li>Create your first listing and go live</li>
          </ol>
        </div>
        <a href="${studioUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7B2FF7,#00D4FF);color:white;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">Go to My Studio</a>
        <p style="color:#666;font-size:12px;margin-top:24px;">Welcome to the Aced community. If you have questions, reply to this email and our team will be happy to help.</p>
      </div>
    `,
  };
}

/** Mirrors buildRejectionEmail in email.ts — subject: "Update on your Aced creator application" */
function buildRejectionPreview(name: string, notes?: string): { subject: string; html: string } {
  return {
    subject: 'Update on your Aced creator application',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7B2FF7;">Your Aced Application Update</h2>
        <p>Hi ${name},</p>
        <p>Thank you for taking the time to apply to become a creator on Aced. After reviewing your application, we are unable to approve it at this time.</p>
        ${notes ? `
        <div style="background:#f9fafb;border-left:4px solid #6b7280;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;font-weight:bold;">Reviewer note:</p>
          <p style="margin:8px 0 0;">${notes}</p>
        </div>` : ''}
        <p>This is usually due to academic credential requirements not being met. You may re-apply once you have additional supporting credentials.</p>
        <p style="color:#666;font-size:12px;margin-top:24px;">If you have questions, reply to this email and our team will be happy to help.</p>
      </div>
    `,
  };
}

/** Mirrors buildChangesRequestedEmail in email.ts — subject: "Changes requested on your Aced creator application" */
function buildChangesRequestedPreview(name: string, notes: string): { subject: string; html: string } {
  const statusUrl = `${APP_URL}/creator/apply/status`;
  return {
    subject: 'Changes requested on your Aced creator application',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7B2FF7;">Changes Requested on Your Aced Application</h2>
        <p>Hi ${name},</p>
        <p>Our team has reviewed your creator application and is asking you to make some changes before we can proceed.</p>
        <div style="background:#f9fafb;border-left:4px solid #7B2FF7;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;font-weight:bold;">Reviewer note:</p>
          <p style="margin:8px 0 0;">${notes || 'Please review the feedback on your application status page.'}</p>
        </div>
        <p>Please visit your application status page to review the feedback and resubmit when you're ready.</p>
        <a href="${statusUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7B2FF7,#00D4FF);color:white;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">View Application Status</a>
        <p style="color:#666;font-size:12px;margin-top:24px;">If you have questions, reply to this email and our team will be happy to help.</p>
      </div>
    `,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DecisionType = 'approved' | 'rejected' | 'changes_requested';

interface PendingDecision {
  appId: string;
  applicantEmail: string;
  applicantName: string;
  decision: DecisionType;
  notes: string;
}

// ── Email preview panel (collapsible) ─────────────────────────────────────────

function EmailPreviewPanel({
  subject,
  html,
  recipientEmail,
}: {
  subject: string;
  html: string;
  recipientEmail: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/60 hover:bg-muted/80 transition-colors text-left"
      >
        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
          Email Preview
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="bg-muted/30">
          {/* Header rows */}
          <div className="px-4 py-3 border-b border-border space-y-1.5">
            <div className="flex gap-2 text-xs">
              <span className="text-muted-foreground w-14 shrink-0">To:</span>
              <span className="font-medium">{recipientEmail}</span>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="text-muted-foreground w-14 shrink-0">Subject:</span>
              <span className="font-medium">{subject}</span>
            </div>
          </div>
          {/* Rendered HTML body */}
          <div className="px-4 py-3">
            <iframe
              srcDoc={`<!DOCTYPE html><html><body style="margin:0;padding:0;">${html}</body></html>`}
              title="Email preview"
              className="w-full border-0 rounded"
              style={{ height: 320 }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminApplications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: response, isLoading } = useGetAdminApplications({ status: 'submitted' });

  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading applications...</div>;
  }

  const applications = (response?.data ?? []) as Array<any>;

  function openModal(app: any, decision: DecisionType) {
    setPending({
      appId: app.creator?.id ?? app.id ?? '',
      applicantEmail: app.user?.email ?? '',
      applicantName: app.profile?.displayName ?? app.user?.email ?? 'Applicant',
      decision,
      notes: '',
    });
    setSubmitError(null);
  }

  async function confirmDecision() {
    if (!pending) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/v1/admin/applications/${pending.appId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: pending.decision,
          notes: pending.notes || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      await queryClient.invalidateQueries({
        queryKey: getGetAdminApplicationsQueryKey({ status: 'submitted' }),
      });
      const label =
        pending.decision === 'approved'
          ? 'approved'
          : pending.decision === 'rejected'
          ? 'rejected'
          : 'sent back for changes';
      toast({
        title: `Application ${pending.decision === 'changes_requested' ? 'updated' : pending.decision}`,
        description: `${pending.applicantName}'s application has been ${label}.`,
      });
      setPending(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setSubmitError(message);
      toast({ title: 'Action failed', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  // Build the email preview shown in the modal
  const emailPreview = pending
    ? pending.decision === 'approved'
      ? buildApprovalPreview(pending.applicantName)
      : pending.decision === 'rejected'
      ? buildRejectionPreview(pending.applicantName, pending.notes)
      : buildChangesRequestedPreview(pending.applicantName, pending.notes)
    : null;

  const modalTitle =
    pending?.decision === 'approved'
      ? '✅ Approve Application'
      : pending?.decision === 'rejected'
      ? '❌ Reject Application'
      : '🔄 Request Changes';

  const confirmLabel =
    pending?.decision === 'approved'
      ? 'Send & Approve'
      : pending?.decision === 'rejected'
      ? 'Send & Reject'
      : 'Send & Request Changes';

  const confirmClass =
    pending?.decision === 'approved'
      ? 'bg-green-600 hover:bg-green-700 text-white'
      : pending?.decision === 'rejected'
      ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
      : 'bg-amber-500 hover:bg-amber-600 text-white';

  const notesRequired = pending?.decision === 'changes_requested';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Creator Applications</h1>
        <p className="text-muted-foreground">Review and approve pending creator applications.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {applications.length > 0 ? (
            <div className="divide-y">
              {applications.map((app: any) => (
                <div key={app.creator?.id ?? app.id} className="p-6">
                  <div className="flex flex-col lg:flex-row justify-between gap-6">
                    <div>
                      <h3 className="text-xl font-bold mb-1">
                        {app.profile?.displayName ?? app.user?.email ?? '—'}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">{app.user?.email}</p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
                        <div className="text-muted-foreground">Headline:</div>
                        <div className="font-medium italic">"{app.creator?.headline ?? '—'}"</div>
                        <div className="text-muted-foreground">Status:</div>
                        <div className="font-medium capitalize">
                          {(app.creator?.status ?? '—').replace('_', ' ')}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row lg:flex-col gap-2 shrink-0">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => openModal(app, 'approved')}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-amber-400 text-amber-600 hover:bg-amber-50"
                        onClick={() => openModal(app, 'changes_requested')}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" /> Request Changes
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => openModal(app, 'rejected')}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-lg font-medium text-foreground">Zero Inbox!</p>
              <p>There are no pending creator applications.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email preview + confirm modal */}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !submitting) setPending(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              The following email will be sent to{' '}
              <strong>{pending?.applicantEmail}</strong> when you confirm.
            </p>

            {/* Notes field — optional for rejection, required for changes_requested */}
            {(pending?.decision === 'rejected' || pending?.decision === 'changes_requested') && (
              <div className="space-y-1.5">
                <label className="font-medium text-sm">
                  Reviewer note{notesRequired ? '' : ' (optional)'}
                  {notesRequired && <span className="text-destructive ml-0.5">*</span>}
                </label>
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={3}
                  placeholder={
                    pending?.decision === 'changes_requested'
                      ? "Describe what needs to change — shown in the email and on the applicant's status page…"
                      : "Reason for rejection — shown in email and on the applicant's status page…"
                  }
                  value={pending?.notes ?? ''}
                  onChange={(e) =>
                    setPending((p) => (p ? { ...p, notes: e.target.value } : p))
                  }
                />
              </div>
            )}

            {/* Collapsible email preview panel */}
            {emailPreview && pending && (
              <EmailPreviewPanel
                subject={emailPreview.subject}
                html={emailPreview.html}
                recipientEmail={pending.applicantEmail}
              />
            )}

            {submitError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {submitError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <DialogClose asChild>
              <Button variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={confirmDecision}
              disabled={submitting || (notesRequired && !pending?.notes?.trim())}
              className={confirmClass}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </span>
              ) : (
                confirmLabel
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
