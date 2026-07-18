import { useGetMySubscriptions, useCancelMySubscription, getGetMySubscriptionsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { CalendarDays, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function statusVariant(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'past_due': return 'bg-yellow-100 text-yellow-800';
    case 'cancelled': case 'expired': return 'bg-muted text-muted-foreground';
    case 'unpaid': return 'bg-red-100 text-red-800';
    default: return 'bg-muted text-muted-foreground';
  }
}

export default function Subscriptions() {
  const { data, isLoading } = useGetMySubscriptions();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const cancelMutation = useCancelMySubscription({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMySubscriptionsQueryKey() });
        toast({ title: 'Subscription will cancel at period end' });
      },
      onError: () => {
        toast({ title: 'Could not cancel subscription', variant: 'destructive' });
      },
    },
  });

  const subs = (data?.data ?? []) as Array<{
    id: string;
    status: string;
    sessionsRemaining: number;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    listingTitle: string | null;
    creatorDisplayName: string | null;
    plan: {
      billingInterval: string;
      sessionsPerPeriod: number;
      amountMinorUnits: number;
      currency: string;
    } | null;
  }>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (subs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-serif">My Subscriptions</h1>
          <p className="text-muted-foreground">Your active tutoring subscription plans.</p>
        </div>
        <Card className="text-center py-16">
          <CardContent>
            <RefreshCw className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-lg">No subscriptions yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Browse creators who offer subscription plans and get sessions at a lower rate.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">My Subscriptions</h1>
        <p className="text-muted-foreground">Your active tutoring subscription plans.</p>
      </div>

      <div className="grid gap-4">
        {subs.map((sub) => {
          const amountGBP = sub.plan ? (sub.plan.amountMinorUnits / 100).toFixed(2) : '—';
          const interval = sub.plan?.billingInterval ?? 'month';
          const isActive = sub.status === 'active';

          return (
            <Card key={sub.id} className="relative overflow-hidden">
              {sub.cancelAtPeriodEnd && (
                <div className="absolute top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-sm text-yellow-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Cancels at end of billing period
                </div>
              )}
              <CardHeader className={sub.cancelAtPeriodEnd ? 'mt-8' : ''}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="font-serif text-lg">
                      {sub.listingTitle ?? 'Subscription'}
                    </CardTitle>
                    {sub.creatorDisplayName && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        with {sub.creatorDisplayName}
                      </p>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${statusVariant(sub.status)}`}>
                    {sub.status.replace('_', ' ')}
                  </span>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">Plan</p>
                    <p className="font-semibold">
                      £{amountGBP} / {interval}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">Sessions/period</p>
                    <p className="font-semibold">{sub.plan?.sessionsPerPeriod ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">Credits left</p>
                    <p className="font-bold text-primary text-base">{sub.sessionsRemaining}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">
                      {sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'}
                    </p>
                    <p className="font-semibold">
                      {sub.currentPeriodEnd
                        ? format(new Date(sub.currentPeriodEnd), 'MMM d, yyyy')
                        : '—'}
                    </p>
                  </div>
                </div>

                {isActive && !sub.cancelAtPeriodEnd && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelMutation.mutate({ id: sub.id })}
                    disabled={cancelMutation.isPending}
                  >
                    Cancel subscription
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
