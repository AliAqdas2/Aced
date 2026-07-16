import { useGetCreatorDashboard } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, ShoppingBag, Eye, Calendar, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';

export default function StudioOverview() {
  const { data: response, isLoading } = useGetCreatorDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl"></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-muted animate-pulse rounded-xl"></div>
          <div className="h-96 bg-muted animate-pulse rounded-xl"></div>
        </div>
      </div>
    );
  }

  const dashboardData = (response?.data ?? {}) as {
    earningsTotalMinorUnits?: number;
    ordersCount?: number;
    viewsCount?: number;
    upcomingBookingsCount?: number;
  };

  const formatMoney = (minorUnits: number) => {
    return `£${(minorUnits / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif">Overview</h1>
          <p className="text-muted-foreground">Here's how your storefront is performing.</p>
        </div>
        <Button asChild>
          <Link href="/studio/listings">Create New Listing</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(dashboardData.earningsTotalMinorUnits || 0)}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              All-time revenue
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.ordersCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Successful transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Storefront Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.viewsCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total listing views
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.upcomingBookingsCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Scheduled this week
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            No recent activity to display.
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Creator Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-background">
              <div className="h-5 w-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5">
                ✓
              </div>
              <div>
                <h4 className="font-medium text-sm">Profile Approved</h4>
                <p className="text-xs text-muted-foreground">Your academic credentials have been verified.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-background">
              <div className="h-5 w-5 rounded-full border-2 border-primary text-primary flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm">Set up Stripe Payouts</h4>
                <p className="text-xs text-muted-foreground mb-2">Connect your bank account to receive earnings.</p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/studio/earnings">Connect Stripe</Link>
                </Button>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50 opacity-70">
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground text-muted-foreground flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium text-sm">Publish First Listing</h4>
                <p className="text-xs text-muted-foreground">Create a tutoring offer or upload notes.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
