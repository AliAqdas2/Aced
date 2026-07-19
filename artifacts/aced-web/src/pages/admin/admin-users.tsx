import { useState } from 'react';
import { useGetAdminUsers, getGetAdminUsersQueryKey } from '@workspace/api-client-react';
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
import { ShieldOff, ShieldCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ActionType = 'suspend' | 'restore';

interface PendingAction {
  userId: string;
  userEmail: string;
  action: ActionType;
  reason: string;
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: response, isLoading } = useGetAdminUsers();

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading users...</div>;

  const users = (response?.data ?? []) as Array<any>;

  function openModal(user: any, action: ActionType) {
    const email = user.user?.email ?? user.email ?? 'Unknown';
    const userId = user.user?.id ?? user.id ?? '';
    setPending({ userId, userEmail: email, action, reason: '' });
    setSubmitError(null);
  }

  async function confirmAction() {
    if (!pending) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/v1/admin/users/${pending.userId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: pending.action,
          reason: pending.reason || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      await queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
      const label = pending.action === 'suspend' ? 'suspended' : 'restored';
      toast({
        title: `User ${label}`,
        description: `${pending.userEmail} has been ${label}.`,
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

  function getStatusBadgeClass(status: string | undefined) {
    switch (status) {
      case 'suspended': return 'bg-destructive/10 text-destructive border border-destructive/30';
      case 'closed': return 'bg-muted text-muted-foreground border';
      default: return 'bg-green-500/10 text-green-700 border border-green-500/30';
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Users</h1>
        <p className="text-muted-foreground">Manage platform users, roles, and account status.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {users.length > 0 ? (
            <div className="divide-y">
              {users.map((userRow: any) => {
                const email = userRow.user?.email ?? userRow.email ?? '—';
                const role = userRow.user?.role ?? userRow.role ?? '—';
                const status = userRow.user?.status ?? userRow.status ?? 'active';
                const userId = userRow.user?.id ?? userRow.id;
                const displayName = userRow.profile?.displayName;

                return (
                  <div key={userId} className="p-4 flex justify-between items-center gap-4">
                    <div className="min-w-0">
                      {displayName && (
                        <h4 className="font-semibold truncate">{displayName}</h4>
                      )}
                      <p className={displayName ? 'text-sm text-muted-foreground truncate' : 'font-semibold truncate'}>
                        {email}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        Role: <span className="font-medium">{role.replace('_', ' ')}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase ${getStatusBadgeClass(status)}`}>
                        {status}
                      </span>

                      {status !== 'closed' && (
                        status === 'suspended' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openModal(userRow, 'restore')}
                            className="text-green-700 border-green-500/40 hover:bg-green-500/10"
                          >
                            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Restore
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openModal(userRow, 'suspend')}
                            className="text-destructive border-destructive/40 hover:bg-destructive/10"
                          >
                            <ShieldOff className="mr-1.5 h-3.5 w-3.5" /> Suspend
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">No users found.</div>
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
              {pending?.action === 'suspend' ? '⚠️ Suspend User' : '✅ Restore User'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              You are about to{' '}
              <strong>{pending?.action}</strong> the account for{' '}
              <span className="font-medium text-foreground">{pending?.userEmail}</span>.
              {pending?.action === 'suspend' && (
                <span className="block mt-1 text-destructive">
                  The user will not be able to log in until their account is restored.
                </span>
              )}
            </p>

            <div className="space-y-1.5">
              <label className="font-medium text-sm">Reason (optional)</label>
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                placeholder="Internal reason for this action — logged in audit trail…"
                value={pending?.reason ?? ''}
                onChange={(e) =>
                  setPending((p) => (p ? { ...p, reason: e.target.value } : p))
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
              onClick={confirmAction}
              disabled={submitting}
              variant={pending?.action === 'suspend' ? 'destructive' : 'default'}
              className={pending?.action === 'restore' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </span>
              ) : pending?.action === 'suspend' ? (
                'Confirm Suspension'
              ) : (
                'Confirm Restore'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
