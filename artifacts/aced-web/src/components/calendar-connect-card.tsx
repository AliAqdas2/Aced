/**
 * Reusable "Connected Calendars" card for learner profile and creator studio.
 * Initiates OAuth via server-side redirect so no client-side credentials needed.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useListCalendarConnections, useDisconnectCalendar, getListCalendarConnectionsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Inline SVG icons for Google and Microsoft
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
      <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
    </svg>
  );
}

type Props = {
  returnTo?: string;
};

export function CalendarConnectCard({ returnTo = '/profile' }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();

  const { data: response, isLoading } = useListCalendarConnections({
    query: { queryKey: getListCalendarConnectionsQueryKey() },
  });
  const connections = (response?.data ?? []) as Array<{
    id: string;
    provider: 'google' | 'microsoft';
    providerEmail: string | null;
    createdAt: string;
  }>;

  const disconnectMutation = useDisconnectCalendar({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCalendarConnectionsQueryKey() });
        toast({ title: 'Calendar disconnected' });
      },
      onError: () => {
        toast({ title: 'Failed to disconnect calendar', variant: 'destructive' });
      },
    },
  });

  // Handle OAuth redirect-back query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('calendarConnected');
    const error = params.get('calendarError');

    if (connected) {
      queryClient.invalidateQueries({ queryKey: getListCalendarConnectionsQueryKey() });
      toast({
        title: connected === 'google' ? 'Google Calendar connected' : 'Outlook connected',
        description: 'Confirmed bookings will now appear in your calendar automatically.',
      });
      // Clean up URL params without full reload
      const url = new URL(window.location.href);
      url.searchParams.delete('calendarConnected');
      window.history.replaceState({}, '', url.toString());
    }

    if (error) {
      toast({
        title: 'Calendar connection failed',
        description: 'Please try again. Check that you granted calendar access.',
        variant: 'destructive',
      });
      const url = new URL(window.location.href);
      url.searchParams.delete('calendarError');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const googleConn = connections.find((c) => c.provider === 'google');
  const microsoftConn = connections.find((c) => c.provider === 'microsoft');

  const connectUrl = (provider: 'google' | 'microsoft') =>
    `/api/v1/auth/${provider}/calendar?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5 text-primary" />
          Connected Calendars
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Confirmed bookings are automatically added to your calendar. This is optional — bookings work without a connected calendar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading calendars…
          </div>
        ) : (
          <>
            {/* Google Calendar */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-muted/20">
              <div className="flex items-center gap-3">
                <GoogleIcon className="h-6 w-6 shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Google Calendar</div>
                  {googleConn ? (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {googleConn.providerEmail ?? 'Connected'}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Not connected</div>
                  )}
                </div>
              </div>

              {googleConn ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/5 gap-1.5 rounded-lg"
                  disabled={disconnectMutation.isPending}
                  onClick={() => disconnectMutation.mutate({ provider: 'google' })}
                >
                  <X className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-lg"
                  asChild
                >
                  <a href={connectUrl('google')}>Connect</a>
                </Button>
              )}
            </div>

            {/* Microsoft Outlook */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-muted/20">
              <div className="flex items-center gap-3">
                <MicrosoftIcon className="h-6 w-6 shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Outlook / Office 365</div>
                  {microsoftConn ? (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {microsoftConn.providerEmail ?? 'Connected'}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Not connected</div>
                  )}
                </div>
              </div>

              {microsoftConn ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/5 gap-1.5 rounded-lg"
                  disabled={disconnectMutation.isPending}
                  onClick={() => disconnectMutation.mutate({ provider: 'microsoft' })}
                >
                  <X className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-lg"
                  asChild
                >
                  <a href={connectUrl('microsoft')}>Connect</a>
                </Button>
              )}
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/30">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Aced only creates and deletes events — it never reads your existing calendar entries. You can disconnect at any time.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
