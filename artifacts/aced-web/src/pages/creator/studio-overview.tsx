import { useGetCreatorDashboard } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, ShoppingBag, Eye, Calendar, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';

export default function StudioOverview() {
  const { data: response, isLoading } = useGetCreatorDashboard();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-12 w-64 bg-muted animate-pulse rounded-xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl"></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-[400px] bg-muted animate-pulse rounded-2xl"></div>
          <div className="h-[400px] bg-muted animate-pulse rounded-2xl"></div>
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
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl tracking-tight font-serif mb-3">Overview</h1>
          <p className="text-muted-foreground font-medium text-lg">Here's how your showcase is performing.</p>
        </div>
        <Button asChild className="rounded-xl h-12 px-6 font-bold shadow-none text-base">
          <Link href="/studio/listings">Create New Listing</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-2xl border-border/50 shadow-sm bg-background">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-6">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Earnings</CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-4xl font-serif tracking-tight mb-2 text-foreground">{formatMoney(dashboardData.earningsTotalMinorUnits || 0)}</div>
            <p className="text-sm font-medium text-muted-foreground flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
              All-time revenue
            </p>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl border-border/50 shadow-sm bg-background">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-6">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Orders</CardTitle>
            <ShoppingBag className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-4xl font-serif tracking-tight mb-2 text-foreground">{dashboardData.ordersCount || 0}</div>
            <p className="text-sm font-medium text-muted-foreground">
              Successful transactions
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm bg-background">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-6">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Store Views</CardTitle>
            <Eye className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-4xl font-serif tracking-tight mb-2 text-foreground">{dashboardData.viewsCount || 0}</div>
            <p className="text-sm font-medium text-muted-foreground">
              Total listing views
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm bg-background">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-6">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Up Next</CardTitle>
            <Calendar className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-4xl font-serif tracking-tight mb-2 text-foreground">{dashboardData.upcomingBookingsCount || 0}</div>
            <p className="text-sm font-medium text-muted-foreground">
              Scheduled this week
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="col-span-1 border-dashed border-2 bg-muted/10 rounded-2xl shadow-none">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="font-serif text-2xl">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center text-muted-foreground font-medium p-8">
            <div className="text-center">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No recent activity to display.</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-1 rounded-2xl border-border/50 shadow-sm bg-background">
          <CardHeader className="p-8 pb-6 border-b border-border/50">
            <CardTitle className="font-serif text-2xl">Creator Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-8">
            <div className="flex items-start gap-4 p-5 rounded-2xl border border-border/50 bg-background shadow-sm">
              <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <h4 className="font-bold text-base mb-1">Profile Approved</h4>
                <p className="text-sm font-medium text-muted-foreground">Your academic credentials have been verified.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-5 rounded-2xl border-2 border-primary/20 bg-primary/5 shadow-sm">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-base mb-1 text-foreground">Set up Stripe Payouts</h4>
                <p className="text-sm font-medium text-muted-foreground mb-4">Connect your bank account to receive earnings.</p>
                <Button size="sm" className="rounded-lg font-bold shadow-none" asChild>
                  <Link href="/studio/earnings">Connect Stripe</Link>
                </Button>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-5 rounded-2xl border border-dashed border-border/50 bg-muted/20 opacity-70">
              <div className="h-8 w-8 rounded-full border-2 border-muted-foreground text-muted-foreground flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-bold text-base mb-1">Publish First Listing</h4>
                <p className="text-sm font-medium text-muted-foreground">Create a tutoring offer or upload notes.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
