import { useGetAdminDashboard } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, ShoppingBag, AlertTriangle, FileCheck, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const { data: response, isLoading } = useGetAdminDashboard();

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading dashboard data...</div>;
  }

  const data = (response?.data ?? {}) as {
    gmvMinorUnits?: number;
    platformRevenueMinorUnits?: number;
    totalOrders?: number;
    activeCreators?: number;
    pendingApplications?: number;
    pendingListingModeration?: number;
    openReports?: number;
  };

  const formatMoney = (minorUnits: number) => {
    return `£${(minorUnits / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif mb-1">Platform Operations</h1>
        <p className="text-muted-foreground">High-level metrics and pending operational queues.</p>
      </div>

      {/* Financials Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">Gross Merchandise Value (GMV)</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatMoney(data.gmvMinorUnits || 0)}</div>
            <p className="text-xs text-primary/70 mt-1">Total volume processed</p>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Platform Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-700 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-400">{formatMoney(data.platformRevenueMinorUnits || 0)}</div>
            <p className="text-xs text-green-600/70 dark:text-green-500/70 mt-1">Commission & fees earned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All-time transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Operations Queue Row */}
      <h2 className="text-xl font-bold font-serif mt-8 mb-4">Action Queues</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className={(data.pendingApplications ?? 0) > 0 ? "border-amber-200 shadow-md" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Creator Apps</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-4">{data.pendingApplications ?? 0}</div>
            <Button size="sm" variant={(data.pendingApplications ?? 0) > 0 ? "default" : "outline"} className="w-full" asChild>
              <Link href="/admin/applications">Review Applications</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className={(data.pendingListingModeration ?? 0) > 0 ? "border-amber-200 shadow-md" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Listing Moderation</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-4">{data.pendingListingModeration ?? 0}</div>
            <Button size="sm" variant={(data.pendingListingModeration ?? 0) > 0 ? "default" : "outline"} className="w-full" asChild>
              <Link href="/admin/listings">Review Listings</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className={(data.openReports ?? 0) > 0 ? "border-destructive/50 bg-destructive/5 shadow-md" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={`text-sm font-medium ${(data.openReports ?? 0) > 0 ? 'text-destructive' : ''}`}>Open Reports</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${(data.openReports ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold mb-4 ${(data.openReports ?? 0) > 0 ? 'text-destructive' : ''}`}>{data.openReports ?? 0}</div>
            <Button size="sm" variant={(data.openReports ?? 0) > 0 ? "destructive" : "outline"} className="w-full" asChild>
              <Link href="/admin/reports">Handle Reports</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Creators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-4">{data.activeCreators || 0}</div>
            <Button size="sm" variant="outline" className="w-full" asChild>
              <Link href="/admin/users?role=creator">Manage Users</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
