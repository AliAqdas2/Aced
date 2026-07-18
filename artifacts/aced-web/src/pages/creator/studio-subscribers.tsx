import { useGetCreatorSubscribers } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Users } from 'lucide-react';

function statusClass(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'past_due': return 'bg-yellow-100 text-yellow-800';
    case 'unpaid': return 'bg-red-100 text-red-800';
    default: return 'bg-muted text-muted-foreground';
  }
}

export default function StudioSubscribers() {
  const { data, isLoading } = useGetCreatorSubscribers();

  const subs = (data?.data ?? []) as Array<{
    id: string;
    status: string;
    sessionsRemaining: number;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    listingTitle: string | null;
    learnerDisplayName: string | null;
    plan: {
      billingInterval: string;
      sessionsPerPeriod: number;
      amountMinorUnits: number;
    } | null;
  }>;

  const activeSubs = subs.filter((s) => s.status === 'active');
  const inactiveSubs = subs.filter((s) => s.status !== 'active');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Subscribers</h1>
        <p className="text-muted-foreground">Students subscribed to your recurring session plans.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Active</p>
            <p className="text-3xl font-bold mt-1">{activeSubs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total revenue / period</p>
            <p className="text-3xl font-bold mt-1">
              £{(activeSubs.reduce((sum, s) => sum + (s.plan?.amountMinorUnits ?? 0), 0) / 100).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : subs.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-lg">No subscribers yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Create a subscription listing to offer weekly or monthly session packs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Active subscribers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Student</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Listing</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Plan</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Credits left</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Renews</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...activeSubs, ...inactiveSubs].map((sub) => (
                    <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {sub.learnerDisplayName ?? 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {sub.listingTitle ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {sub.plan
                          ? `£${(sub.plan.amountMinorUnits / 100).toFixed(2)}/${sub.plan.billingInterval}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-primary">{sub.sessionsRemaining}</span>
                        {sub.plan && (
                          <span className="text-muted-foreground text-xs ml-1">
                            / {sub.plan.sessionsPerPeriod}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {sub.currentPeriodEnd
                          ? format(new Date(sub.currentPeriodEnd), 'MMM d, yyyy')
                          : '—'}
                        {sub.cancelAtPeriodEnd && (
                          <span className="ml-1 text-yellow-600 text-xs">(cancelling)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${statusClass(sub.status)}`}>
                          {sub.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
