import { useGetAdminDashboard, useGetAdminPlatformStats, getGetAdminPlatformStatsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, ShoppingBag, AlertTriangle, FileCheck, GraduationCap, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

const formatMoney = (minorUnits: number) => `£${(minorUnits / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminDashboard() {
  const { data: response, isLoading } = useGetAdminDashboard();
  const { data: statsResponse } = useGetAdminPlatformStats({
    query: { queryKey: getGetAdminPlatformStatsQueryKey() },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading dashboard data…</div>;
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

  const stats = (statsResponse?.data ?? {}) as {
    totalUniversities?: number;
    totalStudents?: number;
    totalCreators?: number;
    gmvMinorUnits?: number;
    commissionEarnedMinorUnits?: number;
    commissionRatePct?: number;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-serif mb-1">Platform Operations</h1>
        <p className="text-muted-foreground">High-level metrics and pending operational queues.</p>
      </div>

      {/* Platform Financials */}
      <section>
        <h2 className="text-xl font-bold font-serif mb-4">Financials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-primary">Gross Merchandise Value</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {formatMoney(stats.gmvMinorUnits ?? data.gmvMinorUnits ?? 0)}
              </div>
              <p className="text-xs text-primary/70 mt-1">Total volume processed</p>
            </CardContent>
          </Card>

          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                Commission Earned
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-700 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                {formatMoney(stats.commissionEarnedMinorUnits ?? data.platformRevenueMinorUnits ?? 0)}
              </div>
              <p className="text-xs text-green-600/70 mt-1">
                {stats.commissionRatePct !== undefined ? `${stats.commissionRatePct}% platform rate` : 'Platform commission'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data.totalOrders ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">All-time transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Aces</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalCreators ?? data.activeCreators ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Approved creators</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Platform Scale */}
      <section>
        <h2 className="text-xl font-bold font-serif mb-4">Platform Scale</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Universities</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalUniversities ?? 0}</div>
              <Button size="sm" variant="outline" className="mt-3 w-full" asChild>
                <Link href="/admin/universities">View All</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Registered Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalStudents ?? 0}</div>
              <Button size="sm" variant="outline" className="mt-3 w-full" asChild>
                <Link href="/admin/users?role=learner">Manage</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved Aces</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalCreators ?? 0}</div>
              <Button size="sm" variant="outline" className="mt-3 w-full" asChild>
                <Link href="/admin/users?role=creator">Manage</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Action Queues */}
      <section>
        <h2 className="text-xl font-bold font-serif mb-4">Action Queues</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card className={(data.pendingApplications ?? 0) > 0 ? "border-amber-200 shadow-md" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Creator Apps</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-3">{data.pendingApplications ?? 0}</div>
              <Button size="sm" variant={(data.pendingApplications ?? 0) > 0 ? "default" : "outline"} className="w-full" asChild>
                <Link href="/admin/applications">Review</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className={(data.pendingListingModeration ?? 0) > 0 ? "border-amber-200 shadow-md" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Listing Moderation</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-3">{data.pendingListingModeration ?? 0}</div>
              <Button size="sm" variant={(data.pendingListingModeration ?? 0) > 0 ? "default" : "outline"} className="w-full" asChild>
                <Link href="/admin/listings">Review</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className={(data.openReports ?? 0) > 0 ? "border-destructive/50 bg-destructive/5 shadow-md" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className={`text-sm font-medium ${(data.openReports ?? 0) > 0 ? 'text-destructive' : ''}`}>
                Open Reports
              </CardTitle>
              <AlertTriangle className={`h-4 w-4 ${(data.openReports ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold mb-3 ${(data.openReports ?? 0) > 0 ? 'text-destructive' : ''}`}>
                {data.openReports ?? 0}
              </div>
              <Button size="sm" variant={(data.openReports ?? 0) > 0 ? "destructive" : "outline"} className="w-full" asChild>
                <Link href="/admin/reports">Handle</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Creators</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-3">{data.activeCreators ?? 0}</div>
              <Button size="sm" variant="outline" className="w-full" asChild>
                <Link href="/admin/users?role=creator">Manage</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
