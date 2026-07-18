import { useState } from 'react';
import {
  useGetMyBookings,
  useCancelBooking,
  getGetMyBookingsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar, Video, Clock, User, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

type Booking = {
  id: string;
  listingId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: string;
  listingTitle?: string | null;
  durationMinutes?: number | null;
  creatorDisplayName?: string | null;
  meetingLink?: string | null;
  cancellationReason?: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800',
    pending_payment: 'bg-yellow-100 text-yellow-800',
    held: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-muted text-muted-foreground',
    in_progress: 'bg-primary/10 text-primary',
    refunded: 'bg-orange-100 text-orange-800',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${styles[status] ?? 'bg-muted text-muted-foreground'}`}
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
        queryClient.invalidateQueries({ queryKey: getGetMyBookingsQueryKey() });
        toast({ title: 'Booking cancelled' });
        onClose();
      },
      onError: () => {
        toast({ title: 'Could not cancel booking', variant: 'destructive' });
      },
    },
  });

  return (
    <div className="space-y-4 mt-2">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Reason for cancellation</Label>
        <Textarea
          placeholder="Please let us know why you're cancelling…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          minLength={5}
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
          {cancelMutation.isPending ? 'Cancelling…' : 'Cancel booking'}
        </Button>
      </div>
    </div>
  );
}

export default function Bookings() {
  const { data: response, isLoading } = useGetMyBookings();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const bookings = (response?.data ?? []) as Booking[];

  const upcoming = bookings.filter(
    (b) => !isPast(parseISO(b.scheduledStartAt)) && b.status !== 'cancelled' && b.status !== 'completed'
  );
  const past = bookings.filter(
    (b) => isPast(parseISO(b.scheduledStartAt)) || b.status === 'cancelled' || b.status === 'completed'
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        Loading bookings…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold font-serif">My Bookings</h1>
        <p className="text-muted-foreground">Manage your tutoring sessions and group classes.</p>
      </div>

      {/* Upcoming */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Upcoming Sessions</h2>
        {upcoming.length > 0 ? (
          <div className="space-y-3">
            {upcoming.map((booking) => (
              <Card key={booking.id} className="border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={booking.status} />
                        {booking.durationMinutes && (
                          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {booking.durationMinutes} min
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-lg truncate">
                        {booking.listingTitle ?? 'Tutoring Session'}
                      </h3>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-primary" />
                          {format(parseISO(booking.scheduledStartAt), 'EEE, MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-primary" />
                          {format(parseISO(booking.scheduledStartAt), 'HH:mm')} –{' '}
                          {format(parseISO(booking.scheduledEndAt), 'HH:mm')} UTC
                        </span>
                        {booking.creatorDisplayName && (
                          <span className="flex items-center gap-1.5">
                            <User className="h-4 w-4 text-primary" />
                            {booking.creatorDisplayName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {booking.meetingLink ? (
                        <Button size="sm" className="gap-1.5 rounded-xl" asChild>
                          <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer">
                            <Video className="h-4 w-4" /> Join Call
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" disabled>
                          <Video className="h-4 w-4" /> Join Call
                        </Button>
                      )}
                      {['confirmed', 'held', 'pending_payment'].includes(booking.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 rounded-xl text-destructive hover:text-destructive"
                          onClick={() => setCancelTarget(booking.id)}
                        >
                          <X className="h-4 w-4" /> Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-muted/30 border-dashed border-border/50 rounded-2xl">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold mb-2">No upcoming sessions</h3>
              <p className="text-muted-foreground mb-4 max-w-sm text-sm">
                Browse tutors and book a session to get started.
              </p>
              <Button asChild className="rounded-xl">
                <Link href="/search?type=service_offer">Find a tutor</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Past Sessions</h2>
          <div className="space-y-3">
            {past.map((booking) => (
              <Card key={booking.id} className="border-border/50 rounded-2xl opacity-75">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={booking.status} />
                      </div>
                      <h3 className="font-semibold truncate">
                        {booking.listingTitle ?? 'Session'}
                      </h3>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>{format(parseISO(booking.scheduledStartAt), 'EEE, MMM d, yyyy')}</span>
                        {booking.creatorDisplayName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {booking.creatorDisplayName}
                          </span>
                        )}
                      </div>
                      {booking.cancellationReason && (
                        <p className="text-xs text-muted-foreground italic">
                          Cancelled: {booking.cancellationReason}
                        </p>
                      )}
                    </div>
                    {booking.status === 'completed' && (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    )}
                    {booking.status === 'cancelled' && (
                      <AlertCircle className="h-5 w-5 text-destructive/50 shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Cancel Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Cancel booking</DialogTitle>
            <DialogDescription>
              This cannot be undone. Paid sessions may be eligible for a refund.
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <CancelDialog bookingId={cancelTarget} onClose={() => setCancelTarget(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
