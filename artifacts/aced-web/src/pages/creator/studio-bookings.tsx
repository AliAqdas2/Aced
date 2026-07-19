import { useState } from 'react';
import {
  useGetCreatorBookings,
  useCancelBooking,
  getGetCreatorBookingsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Clock, User, CheckCircle, XCircle, AlertTriangle, Video } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type Booking = {
  id: string;
  listingId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: string;
  listingTitle?: string | null;
  durationMinutes?: number | null;
  learnerDisplayName?: string | null;
  meetingLink?: string | null;
  cancellationReason?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'text-green-700 bg-green-100',
  pending_payment: 'text-yellow-700 bg-yellow-100',
  held: 'text-blue-700 bg-blue-100',
  cancelled: 'text-red-700 bg-red-100',
  completed: 'text-muted-foreground bg-muted',
  in_progress: 'text-primary bg-primary/10',
  refunded: 'text-orange-700 bg-orange-100',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function CancelDialog({
  bookingId,
  onClose,
}: {
  bookingId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cancelMutation = useCancelBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCreatorBookingsQueryKey() });
        toast({ title: 'Booking cancelled and learner notified' });
        onClose();
      },
      onError: () => {
        toast({ title: 'Could not cancel booking', variant: 'destructive' });
      },
    },
  });

  return (
    <div className="space-y-4 mt-2">
      <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 flex gap-3 text-sm">
        <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
        <p className="text-yellow-800 font-medium">
          Cancelling will release the student's slot. Paid bookings may trigger a refund.
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Reason for cancellation</Label>
        <Textarea
          placeholder="Let the student know why you're cancelling…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Keep booking
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          disabled={reason.length < 5 || cancelMutation.isPending}
          onClick={() => cancelMutation.mutate({ id: bookingId, data: { reason } })}
        >
          {cancelMutation.isPending ? 'Cancelling…' : 'Cancel'}
        </Button>
      </div>
    </div>
  );
}

type Filter = 'all' | 'upcoming' | 'past' | 'cancelled';

export default function StudioBookings() {
  const { data: response, isLoading } = useGetCreatorBookings();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const allBookings = (response?.data ?? []) as Booking[];

  const filtered = allBookings.filter((b) => {
    const inPast = isPast(parseISO(b.scheduledStartAt));
    if (filter === 'upcoming') return !inPast && b.status !== 'cancelled';
    if (filter === 'past') return inPast && b.status !== 'cancelled';
    if (filter === 'cancelled') return b.status === 'cancelled';
    return true;
  });

  const upcomingCount = allBookings.filter(
    (b) => !isPast(parseISO(b.scheduledStartAt)) && b.status !== 'cancelled'
  ).length;

  if (isLoading) {
    return (
      <div className="p-8 text-muted-foreground animate-pulse">Loading bookings…</div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif">Bookings</h1>
          <p className="text-muted-foreground">
            {upcomingCount > 0
              ? `${upcomingCount} upcoming session${upcomingCount !== 1 ? 's' : ''}`
              : 'No upcoming sessions'}
          </p>
        </div>

        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50 rounded-2xl shadow-sm">
        <CardContent className="p-0">
          {filtered.length > 0 ? (
            <div className="divide-y divide-border/50">
              {filtered.map((booking) => {
                const inPast = isPast(parseISO(booking.scheduledStartAt));
                const canCancel = ['confirmed', 'held', 'pending_payment'].includes(booking.status);

                return (
                  <div
                    key={booking.id}
                    className={`p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${inPast ? 'opacity-60' : ''}`}
                  >
                    {/* Date block */}
                    <div className="shrink-0 w-14 text-center bg-primary/5 rounded-xl py-2 border border-primary/10">
                      <div className="text-xs font-bold text-primary uppercase tracking-widest">
                        {format(parseISO(booking.scheduledStartAt), 'MMM')}
                      </div>
                      <div className="text-2xl font-bold font-serif leading-tight">
                        {format(parseISO(booking.scheduledStartAt), 'd')}
                      </div>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={booking.status} />
                        {booking.durationMinutes && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {booking.durationMinutes} min
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold truncate">
                        {booking.listingTitle ?? 'Session'}
                      </h3>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary/60" />
                          {format(parseISO(booking.scheduledStartAt), 'HH:mm')} –{' '}
                          {format(parseISO(booking.scheduledEndAt), 'HH:mm')} UTC
                        </span>
                        {booking.learnerDisplayName && (
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-primary/60" />
                            {booking.learnerDisplayName}
                          </span>
                        )}
                      </div>

                      {booking.cancellationReason && (
                        <p className="text-xs text-muted-foreground italic">
                          Cancelled: {booking.cancellationReason}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      {booking.status === 'completed' && (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                          <CheckCircle className="h-4 w-4" /> Completed
                        </span>
                      )}
                      {booking.meetingLink ? (
                        <Button size="sm" className="gap-1.5 rounded-xl" asChild>
                          <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer">
                            <Video className="h-4 w-4" /> Join Call
                          </a>
                        </Button>
                      ) : (
                        !inPast && booking.status !== 'cancelled' && (
                          <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" disabled>
                            <Video className="h-4 w-4" /> Join Call
                          </Button>
                        )
                      )}
                      {canCancel && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive gap-1.5"
                          onClick={() => setCancelTarget(booking.id)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold mb-1">
                {filter === 'upcoming'
                  ? 'No upcoming bookings'
                  : filter === 'past'
                  ? 'No past sessions'
                  : filter === 'cancelled'
                  ? 'No cancelled bookings'
                  : 'No bookings yet'}
              </h3>
              <p className="text-muted-foreground text-sm">
                {filter === 'upcoming'
                  ? "When students book sessions, they'll appear here."
                  : 'Nothing to show for this filter.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Cancel this session</DialogTitle>
            <DialogDescription>
              The student will be notified immediately.
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <CancelDialog
              bookingId={cancelTarget}
              onClose={() => setCancelTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
