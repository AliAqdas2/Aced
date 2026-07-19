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
import { CheckCircle, XCircle, Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── Email template previews (mirrors server-side templates) ──────────────────

function buildApprovalPreview(name: string) {
  return {
    subject: "You're approved — welcome to Aced! 🎉",
    body: `Hi ${name},

Congratulations! Your creator application has been approved. You're now ready to start sharing your expertise and earning on Aced.

Get started:
  1. Set up your Stripe account to receive payouts
  2. Customise your creator studio and storefront
  3. Create your first listing and go live

Welcome to the Aced community. If you have questions, reply to this email and our team will be happy to help.`,
  };
}

function buildRejectionPreview(name: string, notes?: string) {
  return {
    subject: 'Update on your Aced creator application',
    body: `Hi ${name},

Thank you for taking the time to apply to become a creator on Aced. After reviewing your application, we are unable to approve it at this time.
${notes ? `\nReviewer note:\n${notes}\n` : ''}
This is usually due to academic credential requirements not being met. You may re-apply once you have additional supporting credentials.

If you have questions, reply to this email and our team will be happy to help.`,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DecisionType = 'approved' | 'rejected';

interface PendingDecision {
  appId: string;
  applicantEmail: string;
  applicantName: string;
  decision: DecisionType;
  notes: string;
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
      const action = pending.decision === 'approved' ? 'approved' : 'rejected';
      toast({
        title: `Application ${action}`,
        description: `${pending.applicantName}'s application has been ${action}.`,
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
      : buildRejectionPreview(pending.applicantName, pending.notes)
    : null;

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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {pending?.decision === 'approved'
                ? '✅ Approve Application'
                : '❌ Reject Application'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              The following email will be sent to{' '}
              <strong>{pending?.applicantEmail}</strong> when you confirm.
            </p>

            {/* Optional reviewer note for rejections */}
            {pending?.decision === 'rejected' && (
              <div className="space-y-1.5">
                <label className="font-medium text-sm">Reviewer note (optional)</label>
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={3}
                  placeholder="Reason for rejection — shown in email and on the applicant's status page…"
                  value={pending.notes}
                  onChange={(e) =>
                    setPending((p) => (p ? { ...p, notes: e.target.value } : p))
                  }
                />
              </div>
            )}

            {/* Email preview panel */}
            {emailPreview && (
              <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                <div className="border-b border-border px-4 py-2 flex items-center gap-2 bg-muted/60">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Email Preview
                  </span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex gap-2 text-xs">
                    <span className="text-muted-foreground w-14 shrink-0">To:</span>
                    <span className="font-medium">{pending?.applicantEmail}</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-muted-foreground w-14 shrink-0">Subject:</span>
                    <span className="font-medium">{emailPreview.subject}</span>
                  </div>
                  <hr className="border-border" />
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                    {emailPreview.body}
                  </pre>
                </div>
              </div>
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
              disabled={submitting}
              className={
                pending?.decision === 'approved'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              }
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </span>
              ) : pending?.decision === 'approved' ? (
                'Send & Approve'
              ) : (
                'Send & Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
