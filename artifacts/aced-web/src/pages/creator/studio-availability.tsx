import { useState } from 'react';
import {
  useGetAvailabilityRules,
  useCreateAvailabilityRule,
  useDeleteAvailabilityRule,
  useGetAvailabilityExceptions,
  useCreateAvailabilityException,
  useDeleteAvailabilityException,
  getGetAvailabilityRulesQueryKey,
  getGetAvailabilityExceptionsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, CalendarOff, Clock } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate half-hour time options: "08:00" … "22:00"
const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 23; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 23) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function StudioAvailability() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rulesData, isLoading: rulesLoading } = useGetAvailabilityRules();
  const { data: exceptionsData, isLoading: exceptionsLoading } = useGetAvailabilityExceptions();

  const rules = (rulesData?.data ?? []) as Array<{
    id: string; dayOfWeek: number; startTimeUtc: string; endTimeUtc: string; isActive: boolean;
  }>;
  const exceptions = (exceptionsData?.data ?? []) as Array<{
    id: string; exceptionDate: string; isBlocked: boolean; reason?: string | null;
  }>;

  // Add-rule form state
  const [newDay, setNewDay] = useState('1');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('17:00');

  // Add-exception form state
  const [newDate, setNewDate] = useState('');
  const [newReason, setNewReason] = useState('');

  const createRule = useCreateAvailabilityRule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAvailabilityRulesQueryKey() });
        toast({ title: 'Availability rule added' });
      },
      onError: () => toast({ title: 'Failed to add rule', variant: 'destructive' }),
    },
  });

  const deleteRule = useDeleteAvailabilityRule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAvailabilityRulesQueryKey() });
        toast({ title: 'Rule removed' });
      },
      onError: () => toast({ title: 'Failed to remove rule', variant: 'destructive' }),
    },
  });

  const createException = useCreateAvailabilityException({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAvailabilityExceptionsQueryKey() });
        setNewDate('');
        setNewReason('');
        toast({ title: 'Date blocked' });
      },
      onError: () => toast({ title: 'Failed to block date', variant: 'destructive' }),
    },
  });

  const deleteException = useDeleteAvailabilityException({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAvailabilityExceptionsQueryKey() });
        toast({ title: 'Date unblocked' });
      },
      onError: () => toast({ title: 'Failed to unblock date', variant: 'destructive' }),
    },
  });

  function handleAddRule() {
    if (newEnd <= newStart) {
      toast({ title: 'End time must be after start time', variant: 'destructive' });
      return;
    }
    createRule.mutate({
      data: { dayOfWeek: Number(newDay), startTimeUtc: newStart, endTimeUtc: newEnd },
    });
  }

  function handleAddException() {
    if (!newDate) {
      toast({ title: 'Please select a date', variant: 'destructive' });
      return;
    }
    createException.mutate({
      data: { exceptionDate: newDate, isBlocked: true, reason: newReason || undefined },
    });
  }

  // Group rules by day
  const rulesByDay = new Map<number, typeof rules>();
  for (const rule of rules) {
    if (!rulesByDay.has(rule.dayOfWeek)) rulesByDay.set(rule.dayOfWeek, []);
    rulesByDay.get(rule.dayOfWeek)!.push(rule);
  }

  if (rulesLoading || exceptionsLoading) {
    return <div className="p-8 text-muted-foreground animate-pulse">Loading availability…</div>;
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold font-serif">Availability</h1>
        <p className="text-muted-foreground mt-1">
          Set when students can book sessions with you. All times are in UTC.
        </p>
      </div>

      {/* Weekly schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Weekly Schedule
          </CardTitle>
          <CardDescription>
            Your recurring availability. Students can only book within these hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Week grid */}
          {DAYS.map((day, idx) => {
            const dayRules = rulesByDay.get(idx) ?? [];
            return (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="w-24 pt-0.5 shrink-0">
                  <span className="font-semibold text-sm">{day}</span>
                  {dayRules.length === 0 && (
                    <span className="block text-xs text-muted-foreground">Unavailable</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  {dayRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5"
                    >
                      <span className="text-sm font-medium">
                        {formatTime(rule.startTimeUtc)} – {formatTime(rule.endTimeUtc)} UTC
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteRule.mutate({ id: rule.id })}
                        disabled={deleteRule.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Add rule form */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-sm font-semibold mb-3">Add availability window</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Day</Label>
                <Select value={newDay} onValueChange={setNewDay}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From (UTC)</Label>
                <Select value={newStart} onValueChange={setNewStart}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{formatTime(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To (UTC)</Label>
                <Select value={newEnd} onValueChange={setNewEnd}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{formatTime(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddRule} disabled={createRule.isPending} className="gap-2">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Blocked dates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-destructive/70" />
            Blocked Dates
          </CardTitle>
          <CardDescription>
            Holidays, exams, or any day you're unavailable even if it falls within your weekly schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {exceptions.length > 0 ? (
            <div className="divide-y divide-border/50">
              {exceptions.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-medium text-sm">{formatDate(ex.exceptionDate)}</span>
                    {ex.reason && (
                      <span className="ml-2 text-xs text-muted-foreground">— {ex.reason}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteException.mutate({ id: ex.id })}
                    disabled={deleteException.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No blocked dates.</p>
          )}

          {/* Add exception form */}
          <div className="pt-4 border-t border-border/50 flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date to block</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-44"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-1 flex-1 min-w-40">
              <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
              <Input
                placeholder="e.g. Bank holiday, exam week"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleAddException}
              disabled={createException.isPending}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Block date
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary badges */}
      {rules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...rulesByDay.entries()].sort(([a], [b]) => a - b).map(([day, rs]) => (
            <Badge key={day} variant="secondary" className="text-xs">
              {DAY_SHORT[day]}: {rs.map(r => `${formatTime(r.startTimeUtc)}–${formatTime(r.endTimeUtc)}`).join(', ')}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
