import { useGetAuditLogs } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

export default function AdminAuditLogs() {
  const { data: response, isLoading } = useGetAuditLogs();
  
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading audit logs...</div>;

  const logs = response?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Audit Logs</h1>
        <p className="text-muted-foreground">Review system events and moderation actions.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {logs.length > 0 ? (
            <div className="divide-y text-sm">
              {logs.map((log: any, i: number) => (
                <div key={i} className="p-4 flex justify-between items-start">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground mb-1">{log.action}</div>
                    <div className="font-medium">Actor: {log.actorId}</div>
                    <div className="text-muted-foreground">Target: {log.targetId} ({log.targetType})</div>
                  </div>
                  <div className="text-right text-muted-foreground text-xs whitespace-nowrap">
                    {format(new Date(log.timestamp || new Date()), 'MMM d, HH:mm:ss')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">No audit logs available.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
