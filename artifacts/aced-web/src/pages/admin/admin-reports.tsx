import { useGetAdminReports } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function AdminReports() {
  const { data: response, isLoading } = useGetAdminReports({ status: 'open' });
  
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading reports...</div>;

  const reports = response?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Moderation Reports</h1>
        <p className="text-muted-foreground">Handle user reports regarding content and safety.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {reports.length > 0 ? (
            <div className="divide-y">
              {reports.map((report: any) => (
                <div key={report.id} className="p-4 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <h4 className="font-semibold">{report.category}</h4>
                    </div>
                    <p className="text-sm mt-2">{report.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">Target: {report.subjectType}</p>
                  </div>
                  <Button variant="outline" size="sm">Investigate</Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-medium text-foreground">All clear</p>
              <p>There are no open reports requiring attention.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
