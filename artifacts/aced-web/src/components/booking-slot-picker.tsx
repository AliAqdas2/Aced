import { useState } from 'react';
import { Link, useLocation as useWouterLocation } from 'wouter';
import {
  useGetServiceAvailability,
  useCreateBookingHold,
  useCreateCheckoutSession,
  useConfirmFreeBooking,
  getGetMyBookingsQueryKey,
  getGetServiceAvailabilityQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
} from 'lucide-react';
import { format, isBefore, startOfDay, addDays, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function formatSlotTime(iso: string) {
  return format(parseISO(iso), 'HH:mm');
}

interface BookingSlotPickerProps {
  listingId: string;
  serviceOffer: { id: string; durationMinutes: number; bookingHorizonDays: number };
  price: { amountMinorUnits: number } | null;
  onBooked: () => void;
  isOwnListing?: boolean;
}

export function BookingSlotPicker({
  listingId,
  serviceOffer,
  price,
  onBooked,
  isOwnListing = false,
}: BookingSlotPickerProps) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useWouterLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const today = startOfDay(new Date());
  const maxDate = addDays(today, serviceOffer.bookingHorizonDays ?? 60);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

  const availParams = {
    from: dateStr ?? undefined,
    to: dateStr ?? undefined,
    timezone: 'Europe/London',
  };
  const { data: availData, isLoading: slotsLoading } = useGetServiceAvailability(
    listingId,
    availParams,
    {
      query: {
        enabled: !!dateStr && !isOwnListing,
        queryKey: getGetServiceAvailabilityQueryKey(listingId, availParams),
      },
    },
  );

  const availableSlots = (availData?.data?.slots ?? []).filter(
    (s: { startAt: string; endAt: string; available: boolean }) => s.available,
  );

  const isFree = !price || price.amountMinorUnits === 0;

  const holdMutation = useCreateBookingHold();
  const checkoutMutation = useCreateCheckoutSession();
  const confirmFreeMutation = useConfirmFreeBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyBookingsQueryKey() });
        setSuccess(true);
        setConfirmOpen(false);
        onBooked();
      },
      onError: () => {
        toast({ title: 'Could not confirm booking', variant: 'destructive' });
      },
    },
  });

  function handleSlotClick(slot: { startAt: string; endAt: string }) {
    if (!isAuthenticated) {
      setLocation(`/auth/login?redirect=/listings/${listingId}`);
      return;
    }
    setSelectedSlot(slot);
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!selectedSlot) return;
    if (isFree) {
      confirmFreeMutation.mutate({
        data: {
          listingId,
          serviceOfferId: serviceOffer.id,
          startAt: selectedSlot.startAt,
          timezone: 'Europe/London',
        },
      });
    } else {
      holdMutation.mutate(
        {
          data: {
            listingId,
            serviceOfferId: serviceOffer.id,
            startAt: selectedSlot.startAt,
            timezone: 'Europe/London',
          },
        },
        {
          onSuccess: (holdRes) => {
            const holdId = holdRes.data?.id;
            checkoutMutation.mutate(
              { data: { listingId, holdId } },
              {
                onSuccess: (res) => {
                  if (res.data?.checkoutUrl) {
                    window.location.href = res.data.checkoutUrl;
                  }
                },
                onError: () => {
                  toast({ title: 'Could not start checkout', variant: 'destructive' });
                },
              },
            );
          },
          onError: () => {
            toast({ title: 'Slot is no longer available', variant: 'destructive' });
            setConfirmOpen(false);
          },
        },
      );
    }
  }

  const isPending =
    holdMutation.isPending || checkoutMutation.isPending || confirmFreeMutation.isPending;

  if (isOwnListing) {
    return (
      <div className="rounded-2xl border border-border/50 bg-muted/30 p-6 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto opacity-60" />
        <h3 className="text-base font-bold">This is your listing</h3>
        <p className="text-sm text-muted-foreground font-medium">
          You can&apos;t book your own sessions. Manage bookings from Tutor Studio.
        </p>
        <Button asChild variant="outline" className="w-full font-bold">
          <Link href="/studio/listings">Go to my listings</Link>
        </Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-green-200/80 bg-green-50/90 p-8 text-center space-y-4 animate-in fade-in duration-300">
        <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto" />
        <h3 className="text-xl font-bold font-serif text-green-900">Session booked!</h3>
        <p className="text-green-800/80 font-medium">
          Your session on{' '}
          {selectedSlot ? format(parseISO(selectedSlot.startAt), 'EEE, MMM d') : ''} at{' '}
          {selectedSlot ? formatSlotTime(selectedSlot.startAt) : ''} is confirmed.
        </p>
        <Button asChild className="mt-2 rounded-xl font-bold">
          <Link href="/bookings">View my bookings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-serif text-xl tracking-tight">Pick a date</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Times shown in Europe/London · {serviceOffer.durationMinutes} min sessions
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-muted/40 to-background p-3 sm:p-4 shadow-sm">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            setSelectedDate(d);
            setSelectedSlot(null);
          }}
          disabled={(date) => isBefore(startOfDay(date), today) || date > maxDate}
          className={cn(
            'w-full rounded-xl bg-transparent p-0 [--cell-size:2.5rem]',
            '[&_[data-slot=calendar]]:w-full',
            '[&_.rdp-months]:w-full [&_.rdp-month]:w-full',
            '[&_.rdp-caption_label]:font-serif [&_.rdp-caption_label]:text-base [&_.rdp-caption_label]:tracking-tight',
            '[&_.rdp-weekday]:text-[0.7rem] [&_.rdp-weekday]:uppercase [&_.rdp-weekday]:tracking-widest [&_.rdp-weekday]:font-medium',
            '[&_.rdp-day_button]:rounded-xl [&_.rdp-day_button]:transition-colors',
            '[&_[data-selected-single=true]]:shadow-sm',
            '[&_.rdp-today:not([data-selected-single=true])]:bg-transparent',
            '[&_.rdp-today:not([data-selected-single=true])_.rdp-day_button]:ring-1 [&_.rdp-today:not([data-selected-single=true])_.rdp-day_button]:ring-primary/40',
            '[&_.rdp-disabled]:opacity-35',
          )}
        />
      </div>

      {selectedDate && (
        <div
          key={dateStr}
          className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/30 px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarDays className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold truncate">
                {format(selectedDate, 'EEE, MMM d')}
              </span>
            </div>
            <span className="text-xs font-medium text-muted-foreground shrink-0">
              {serviceOffer.durationMinutes} min
            </span>
          </div>

          <h4 className="text-sm font-bold tracking-tight">Available times</h4>

          {slotsLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm font-medium">Loading times…</span>
            </div>
          ) : availableSlots.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableSlots.map(
                (slot: { startAt: string; endAt: string; available: boolean }) => {
                  const isSelected = selectedSlot?.startAt === slot.startAt;
                  return (
                    <button
                      key={slot.startAt}
                      type="button"
                      onClick={() => handleSlotClick(slot)}
                      className={cn(
                        'h-10 rounded-full text-sm font-semibold tabular-nums transition-all duration-200',
                        'border border-border/70 bg-background hover:border-primary hover:bg-primary hover:text-primary-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        isSelected &&
                          'border-primary bg-primary text-primary-foreground shadow-sm scale-[1.02]',
                      )}
                    >
                      {formatSlotTime(slot.startAt)}
                    </button>
                  );
                },
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">No times on this day</p>
              <p className="text-xs text-muted-foreground mt-1">Try another date on the calendar.</p>
            </div>
          )}
        </div>
      )}

      {!selectedDate && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Select a date above to see open times.
        </p>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Confirm booking</DialogTitle>
            <DialogDescription>Review the details before confirming.</DialogDescription>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/40 border border-border/50 p-4 space-y-3">
                <div className="flex items-center gap-2.5 text-sm">
                  <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold">
                    {format(parseISO(selectedSlot.startAt), 'EEE, MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold tabular-nums">
                    {formatSlotTime(selectedSlot.startAt)} – {formatSlotTime(selectedSlot.endAt)}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">Europe/London</span>
                </div>
                <div className="text-sm text-muted-foreground font-medium pl-6">
                  {serviceOffer.durationMinutes} min session
                </div>
              </div>

              <div className="flex justify-between items-center font-bold text-lg pt-2 border-t border-border/50">
                <span>Total</span>
                <span>
                  {isFree ? 'Free' : `£${((price?.amountMinorUnits ?? 0) / 100).toFixed(2)}`}
                </span>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setConfirmOpen(false)}
                  disabled={isPending}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2 rounded-xl font-bold"
                  onClick={handleConfirm}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isFree ? 'Confirming…' : 'Redirecting…'}
                    </>
                  ) : isFree ? (
                    'Confirm booking'
                  ) : (
                    <>
                      Pay & book
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
