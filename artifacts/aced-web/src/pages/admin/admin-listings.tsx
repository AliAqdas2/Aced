import { useState } from 'react';
import { useGetAdminListings, getGetAdminListingsQueryKey } from '@workspace/api-client-react';
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
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type DecisionType = 'approved' | 'rejected';
type StatusFilter = 'pending' | 'draft' | 'submitted';

interface PendingDecision {
  listingId: string;
  listingTitle: string;
  decision: DecisionType;
  notes: string;
}

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
];

export default function AdminListings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const { data: response, isLoading } = useGetAdminListings({ status: statusFilter });

  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const listings = (response?.data ?? []) as Array<any>;

  function openModal(listing: any, decision: DecisionType) {
    setPending({
      listingId: listing.id,
      listingTitle: listing.title ?? 'Untitled listing',
      decision,
      notes: '',
    });
    setSubmitError(null);
  }

  async function confirmDecision() {
    if (!pending) return;
    if (pending.decision === 'rejected' && !pending.notes.trim()) {
      setSubmitError('Please leave feedback explaining why the listing was declined.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/v1/admin/listings/${pending.listingId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: pending.decision,
          notes: pending.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      await queryClient.invalidateQueries({
        queryKey: getGetAdminListingsQueryKey({ status: statusFilter }),
      });
      // Also refresh other queue tabs so counts stay consistent if user switches
      for (const tab of STATUS_TABS) {
        if (tab.value !== statusFilter) {
          await queryClient.invalidateQueries({
            queryKey: getGetAdminListingsQueryKey({ status: tab.value }),
          });
        }
      }
      const action = pending.decision === 'approved' ? 'approved' : 'rejected';
      toast({
        title: `Listing ${action}`,
        description: `"${pending.listingTitle}" has been ${action}.`,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Listing Moderation</h1>
        <p className="text-muted-foreground">Review and moderate marketplace listings pending approval.</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-0">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              statusFilter === tab.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading listings...</div>
          ) : listings.length > 0 ? (
            <div className="divide-y">
              {listings.map((listing: any) => (
                <div key={listing.id} className="p-6 flex flex-col lg:flex-row justify-between gap-4 items-start lg:items-center">
                  <div>
                    <h4 className="font-semibold text-lg">{listing.title ?? '—'}</h4>
                    <p className="text-sm text-muted-foreground capitalize">
                      {listing.type} &bull; <span className="font-medium">{listing.status}</span>
                    </p>
                    {listing.description && (
                      <p className="text-sm text-muted-foreground mt-1 max-w-xl line-clamp-2">{listing.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                      onClick={() => openModal(listing, 'approved')}
                    >
                      <CheckCircle className="mr-1.5 h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openModal(listing, 'rejected')}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-lg font-medium text-foreground">Queue is clear!</p>
              <p>No listings match this filter.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm modal */}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !submitting) setPending(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pending?.decision === 'approved' ? '✅ Approve Listing' : '❌ Reject Listing'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              You are about to{' '}
              <strong>{pending?.decision}</strong> the listing:{' '}
              <span className="font-medium text-foreground">"{pending?.listingTitle}"</span>.
            </p>

            <div className="space-y-1.5">
              <label className="font-medium text-sm">
                {pending?.decision === 'rejected'
                  ? 'Feedback for the tutor (required)'
                  : 'Moderation note (optional)'}
              </label>
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                placeholder={
                  pending?.decision === 'rejected'
                    ? 'Explain why this listing was declined — the tutor will see this…'
                    : 'Any notes for the moderation log…'
                }
                value={pending?.notes ?? ''}
                onChange={(e) =>
                  setPending((p) => (p ? { ...p, notes: e.target.value } : p))
                }
              />
            </div>

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
              disabled={
                submitting ||
                (pending?.decision === 'rejected' && !pending.notes.trim())
              }
              className={
                pending?.decision === 'approved'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              }
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </span>
              ) : pending?.decision === 'approved' ? (
                'Confirm Approval'
              ) : (
                'Confirm Rejection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
