import { useState } from 'react';
import { useParams, Link, useLocation as useWouterLocation } from 'wouter';
import {
  useGetListing,
  useGetServiceAvailability,
  useCreateBookingHold,
  useCreateCheckoutSession,
  useConfirmFreeBooking,
  useSubscribeToListing,
  getGetMyBookingsQueryKey,
  getGetServiceAvailabilityQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Star,
  ShieldCheck,
  CheckCircle2,
  Clock,
  CalendarDays,
  Download,
  AlertCircle,
  Loader2,
  ChevronRight,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format, isBefore, startOfDay, addDays, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

function formatSlotTime(iso: string) {
  return format(parseISO(iso), 'HH:mm');
}

function SlotPicker({
  listingId,
  serviceOffer,
  price,
  onBooked,
}: {
  listingId: string;
  serviceOffer: { id: string; durationMinutes: number; bookingHorizonDays: number };
  price: { amountMinorUnits: number } | null;
  onBooked: () => void;
}) {
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

  const availParams = { from: dateStr ?? undefined, to: dateStr ?? undefined, timezone: 'Europe/London' };
  const { data: availData, isLoading: slotsLoading } = useGetServiceAvailability(
    listingId,
    availParams,
    { query: { enabled: !!dateStr, queryKey: getGetServiceAvailabilityQueryKey(listingId, availParams) } }
  );

  const availableSlots = (availData?.data?.slots ?? []).filter(
    (s: { startAt: string; endAt: string; available: boolean }) => s.available
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
      // Create hold first, then checkout
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
              }
            );
          },
          onError: () => {
            toast({ title: 'Slot is no longer available', variant: 'destructive' });
            setConfirmOpen(false);
          },
        }
      );
    }
  }

  const isPending =
    holdMutation.isPending || checkoutMutation.isPending || confirmFreeMutation.isPending;

  if (success) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center space-y-4">
        <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto" />
        <h3 className="text-xl font-bold font-serif text-green-900">Session booked!</h3>
        <p className="text-green-700 font-medium">
          Your session on{' '}
          {selectedSlot ? format(parseISO(selectedSlot.startAt), 'EEE, MMM d') : ''} at{' '}
          {selectedSlot ? formatSlotTime(selectedSlot.startAt) : ''} is confirmed.
        </p>
        <Button asChild className="mt-2">
          <Link href="/bookings">View my bookings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Choose a date</h3>

      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(d) => {
          setSelectedDate(d);
          setSelectedSlot(null);
        }}
        disabled={(date) => isBefore(startOfDay(date), today) || date > maxDate}
        className="rounded-xl border border-border/50 bg-muted/20 p-3"
      />

      {dateStr && (
        <div className="space-y-3">
          <h3 className="text-base font-bold">
            Available times — {selectedDate ? format(selectedDate, 'EEE, MMM d') : ''}
          </h3>

          {slotsLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading slots…
            </div>
          ) : availableSlots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {availableSlots.map(
                (slot: { startAt: string; endAt: string; available: boolean }) => (
                  <Button
                    key={slot.startAt}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSlotClick(slot)}
                    className="font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                  >
                    {formatSlotTime(slot.startAt)}
                  </Button>
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic py-4">
              No slots available on this day.
            </p>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Confirm booking</DialogTitle>
            <DialogDescription>Review the details before confirming.</DialogDescription>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/40 border border-border/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="font-semibold">
                    {format(parseISO(selectedSlot.startAt), 'EEE, MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-semibold">
                    {formatSlotTime(selectedSlot.startAt)} – {formatSlotTime(selectedSlot.endAt)}{' '}
                    UTC
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">
                    {serviceOffer.durationMinutes} min session
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center font-bold text-lg pt-2 border-t border-border/50">
                <span>Total</span>
                <span>
                  {isFree
                    ? 'Free'
                    : `£${((price?.amountMinorUnits ?? 0) / 100).toFixed(2)}`}
                </span>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmOpen(false)}
                  disabled={isPending}
                >
                  Back
                </Button>
                <Button className="flex-1 gap-2" onClick={handleConfirm} disabled={isPending}>
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

export default function ListingDetail() {
  const params = useParams();
  const id = params.id as string;
  const [, setLocation] = useWouterLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [booked, setBooked] = useState(false);

  const { data: response, isLoading, error } = useGetListing(id, {
    query: { enabled: !!id, queryKey: ['listing', id] },
  });

  const checkoutMutation = useCreateCheckoutSession();

  // Must be declared before any early returns to satisfy the Rules of Hooks
  const subscribeMutation = useSubscribeToListing({
    mutation: {
      onSuccess: (res: any) => {
        if (res.data?.checkoutUrl) window.location.href = res.data.checkoutUrl;
      },
      onError: () => {
        toast({ title: 'Could not start subscription checkout', variant: 'destructive' });
      },
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  if (error || !response?.data?.listing) {
    return (
      <div className="container mx-auto px-4 py-32 text-center min-h-[70vh] flex flex-col items-center justify-center">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-6 opacity-20" />
        <h1 className="font-serif text-4xl tracking-tight mb-4">Listing not found</h1>
        <p className="text-muted-foreground font-medium mb-8 text-lg">
          This listing may have been removed or is no longer available.
        </p>
        <Button asChild size="lg" className="rounded-xl h-14 px-8 font-bold">
          <Link href="/search">Browse Marketplace</Link>
        </Button>
      </div>
    );
  }

  const {
    listing,
    price,
    serviceOffer,
    product,
    subscriptionPlan,
    isSubscribed,
    sessionsRemaining,
    currentPeriodEnd,
  } = response.data as any;
  const isSubscription = !!subscriptionPlan;
  const priceAmount =
    isSubscription
      ? `£${(subscriptionPlan.amountMinorUnits / 100).toFixed(2)} / ${subscriptionPlan.billingInterval}`
      : !price || (price as any).amountMinorUnits === 0
      ? 'Free'
      : `£${((price as any).amountMinorUnits / 100).toFixed(2)}`;
  const isService = listing.type === 'service_offer' || listing.type === 'group_session';

  const handleSubscribe = () => {
    if (!isAuthenticated) {
      setLocation(`/auth/login?redirect=/listings/${id}`);
      return;
    }
    subscribeMutation.mutate({ data: { subscriptionPlanId: subscriptionPlan.id } });
  };

  const handlePurchase = () => {
    if (!isAuthenticated) {
      setLocation(`/auth/login?redirect=/listings/${id}`);
      return;
    }
    checkoutMutation.mutate(
      { data: { listingId: id } },
      {
        onSuccess: (res) => {
          if (res.data?.checkoutUrl) window.location.href = res.data.checkoutUrl;
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Breadcrumbs */}
      <div className="border-b bg-muted/20">
        <div className="container mx-auto px-4 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="mx-3 opacity-50">/</span>
          <Link href="/search" className="hover:text-primary transition-colors">Marketplace</Link>
          <span className="mx-3 opacity-50">/</span>
          <span className="text-foreground">{listing.title}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-10">
            <div>
              <div className="inline-flex items-center justify-center bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                {listing.type.replace(/_/g, ' ')}
              </div>
              <h1 className="font-serif text-5xl sm:text-6xl font-normal mb-6 leading-[1.1] tracking-tight text-foreground">
                {listing.title}
              </h1>

              <div className="flex items-center gap-6 text-sm mb-10 pb-10 border-b border-border/50">
                <div className="flex items-center text-foreground font-semibold">
                  <Star className="h-5 w-5 fill-primary text-primary mr-1.5" />
                  <span className="text-lg">{listing.averageRating?.toFixed(1) || '5.0'}</span>
                  <span className="text-muted-foreground ml-2 font-medium">
                    ({listing.reviewCount || 0} reviews)
                  </span>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="text-muted-foreground font-medium">
                  {listing.purchaseCount || 0} enrolled
                </div>
              </div>

              <div className="prose prose-lg prose-slate dark:prose-invert max-w-none prose-headings:font-serif prose-headings:font-normal prose-headings:tracking-tight prose-p:font-medium prose-p:text-muted-foreground">
                <h3 className="text-3xl mb-6">Description</h3>
                <p className="whitespace-pre-wrap leading-relaxed">{listing.description}</p>
              </div>

              {listing.tags && listing.tags.length > 0 && (
                <div className="mt-12 pt-10 border-t border-border/50 flex flex-wrap gap-2">
                  {listing.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="bg-muted px-4 py-2 rounded-lg text-sm font-semibold text-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Creator Info */}
            <Card className="rounded-2xl border-border/50 bg-muted/10 shadow-none">
              <CardContent className="p-8 sm:p-10">
                <h3 className="font-serif text-3xl mb-8">About the Creator</h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <Avatar className="h-24 w-24 border bg-background">
                    <AvatarFallback className="bg-primary/10 text-primary text-3xl font-serif">
                      C
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Link
                      href="/search"
                      className="font-bold text-2xl hover:text-primary transition-colors block mb-2"
                    >
                      Top University Scholar
                    </Link>
                    <div className="text-sm font-medium text-muted-foreground flex items-center mb-4">
                      <ShieldCheck className="h-5 w-5 text-primary mr-2" /> Verified Student
                    </div>
                    <Button variant="outline" className="rounded-xl h-10 font-bold" asChild>
                      <Link href="/search">View Profile</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sticky Sidebar */}
          <div className="space-y-6">
            <div className="sticky top-32">
              {isService && serviceOffer && isSubscription ? (
                /* Subscription listing */
                <Card className="shadow-xl border-border/50 rounded-3xl overflow-hidden">
                  <CardContent className="p-6">
                    {isSubscribed ? (
                      /* Already subscribed — show slot picker or no-credits message */
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-xs font-bold uppercase tracking-widest text-green-700">
                            You're subscribed
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-medium text-muted-foreground">Credits remaining</span>
                          <span className={`text-lg font-bold font-serif ${sessionsRemaining > 0 ? 'text-primary' : 'text-destructive'}`}>
                            {sessionsRemaining ?? 0} / {subscriptionPlan.sessionsPerPeriod}
                          </span>
                        </div>
                        <Separator className="mb-4" />
                        {sessionsRemaining > 0 ? (
                          <SlotPicker
                            listingId={id}
                            serviceOffer={serviceOffer as any}
                            price={null}
                            onBooked={() => setBooked(true)}
                          />
                        ) : (
                          <div className="rounded-xl bg-muted/40 border border-border/50 p-4 text-center space-y-2">
                            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                            <p className="text-sm font-semibold text-foreground">No credits remaining</p>
                            {currentPeriodEnd && (
                              <p className="text-xs text-muted-foreground">
                                Renews on{' '}
                                <span className="font-medium">
                                  {format(new Date(currentPeriodEnd), 'EEE, MMM d')}
                                </span>
                              </p>
                            )}
                            <Button variant="outline" size="sm" className="mt-2 w-full" asChild>
                              <Link href="/subscriptions">Manage subscription</Link>
                            </Button>
                          </div>
                        )}
                      </>
                    ) : subscriptionPlan.isActive === false ? (
                      /* Plan paused — no new subscribers */
                      <div className="text-center py-4 space-y-3">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Clock className="h-5 w-5" />
                          <span className="text-sm font-semibold">Subscriptions paused</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          The creator has temporarily paused new subscriptions. Check back later.
                        </p>
                      </div>
                    ) : (
                      /* Not yet subscribed — show Subscribe CTA */
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <RefreshCw className="h-4 w-4 text-primary" />
                          <span className="text-xs font-bold uppercase tracking-widest text-primary">
                            Subscription Plan
                          </span>
                        </div>
                        <div className="text-4xl font-serif tracking-tight mb-2 text-primary">
                          £{(subscriptionPlan.amountMinorUnits / 100).toFixed(2)}
                          <span className="text-lg font-medium text-muted-foreground ml-1">
                            / {subscriptionPlan.billingInterval}
                          </span>
                        </div>
                        <div className="flex gap-3 mb-6 flex-wrap">
                          <Badge variant="secondary" className="text-xs font-semibold">
                            <Clock className="h-3 w-3 mr-1" />
                            {(serviceOffer as any).durationMinutes} min sessions
                          </Badge>
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {(serviceOffer as any).deliveryMode ?? 'Online'}
                          </Badge>
                        </div>
                        <Separator className="mb-6" />
                        <div className="space-y-3 mb-6">
                          <div className="flex items-start gap-3 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span className="font-medium">
                              <strong>{subscriptionPlan.sessionsPerPeriod}</strong> session
                              {subscriptionPlan.sessionsPerPeriod !== 1 ? 's' : ''} per{' '}
                              {subscriptionPlan.billingInterval === 'weekly' ? 'week' : 'month'}
                            </span>
                          </div>
                          <div className="flex items-start gap-3 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span className="font-medium">Credits reset each billing period</span>
                          </div>
                          <div className="flex items-start gap-3 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span className="font-medium">Cancel anytime</span>
                          </div>
                        </div>
                        <Button
                          size="lg"
                          className="w-full h-14 text-base font-bold rounded-xl"
                          onClick={handleSubscribe}
                          disabled={subscribeMutation.isPending}
                        >
                          {subscribeMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting…
                            </>
                          ) : (
                            <>
                              Subscribe — £{(subscriptionPlan.amountMinorUnits / 100).toFixed(2)}/{subscriptionPlan.billingInterval}
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : isService && serviceOffer ? (
                /* Per-session listing — show slot picker inline */
                <Card className="shadow-xl border-border/50 rounded-3xl overflow-hidden">
                  <CardContent className="p-6">
                    <div className="text-4xl font-serif tracking-tight mb-2 text-primary">
                      {priceAmount}
                    </div>
                    <div className="flex gap-3 mb-6 flex-wrap">
                      <Badge variant="secondary" className="text-xs font-semibold">
                        <Clock className="h-3 w-3 mr-1" />
                        {(serviceOffer as any).durationMinutes} min
                      </Badge>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {(serviceOffer as any).deliveryMode ?? 'Online'}
                      </Badge>
                    </div>
                    <Separator className="mb-6" />
                    <SlotPicker
                      listingId={id}
                      serviceOffer={serviceOffer as any}
                      price={price as any}
                      onBooked={() => setBooked(true)}
                    />
                  </CardContent>
                </Card>
              ) : (
                /* Digital product — original checkout flow */
                <Card className="shadow-2xl border-transparent rounded-3xl overflow-hidden bg-foreground text-background">
                  <CardContent className="p-8">
                    <div className="text-5xl font-serif tracking-tight mb-8 text-primary">
                      {priceAmount}
                    </div>
                    <div className="space-y-5 mb-8">
                      <div className="flex items-center gap-4 text-base font-medium text-background/80">
                        <Download className="h-6 w-6 text-primary" />
                        <span>Instant digital download</span>
                      </div>
                      <div className="flex items-center gap-4 text-base font-medium text-background/80">
                        <CheckCircle2 className="h-6 w-6 text-primary" />
                        <span>Lifetime access</span>
                      </div>
                    </div>
                    <Button
                      size="lg"
                      className="w-full h-16 text-lg font-bold rounded-xl shadow-none bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      onClick={handlePurchase}
                      disabled={checkoutMutation.isPending}
                    >
                      {checkoutMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                        </>
                      ) : (
                        'Buy Now'
                      )}
                    </Button>
                    <p className="text-sm font-medium text-center text-background/50 mt-6">
                      Secure payment powered by Stripe
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Trust Badge */}
              <div className="mt-6 flex items-start gap-4 p-6 bg-primary/5 rounded-3xl border border-primary/10">
                <ShieldCheck className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <span className="font-bold block mb-1 text-foreground">Aced Guarantee</span>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                    Verified creators, secure payments, and quality assurance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
