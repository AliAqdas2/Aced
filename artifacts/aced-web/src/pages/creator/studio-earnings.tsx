import { useGetCreatorEarnings, useGetStripeStatus, useStartStripeOnboarding } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function StudioEarnings() {
  const { data: earningsResp, isLoading: earningsLoading } = useGetCreatorEarnings();
  const { data: stripeResp, isLoading: stripeLoading } = useGetStripeStatus();
  const startStripeMutation = useStartStripeOnboarding();

  const handleConnectStripe = () => {
    startStripeMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data?.data?.onboardingUrl) {
          window.location.href = data.data.onboardingUrl;
        }
      }
    });
  };

  const stripeStatus = stripeResp?.data;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold font-serif">Earnings & Payouts</h1>
        <p className="text-muted-foreground">Track your revenue and manage your bank connection.</p>
      </div>

      {!stripeLoading && stripeStatus && !stripeStatus.payoutsEnabled && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mt-2">
            <span>You must connect a bank account via Stripe to receive payouts and accept paid bookings.</span>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={handleConnectStripe}
              disabled={startStripeMutation.isPending}
            >
              {startStripeMutation.isPending ? 'Redirecting...' : 'Connect Bank Account'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!stripeLoading && stripeStatus?.payoutsEnabled && (
        <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-900 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle>Payouts Active</AlertTitle>
          <AlertDescription>
            Your Stripe account is connected and ready to receive payouts.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Earnings History</CardTitle>
        </CardHeader>
        <CardContent>
          {earningsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading earnings...</div>
          ) : earningsResp?.data?.length ? (
            <div className="divide-y">
              {earningsResp.data.map((earning: any, i: number) => (
                <div key={i} className="py-4 flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{earning.description || 'Payout'}</div>
                    <div className="text-sm text-muted-foreground">{earning.date}</div>
                  </div>
                  <div className="font-bold">£{(earning.amount / 100).toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No earnings history available yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
