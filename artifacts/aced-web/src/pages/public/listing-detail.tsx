import { useState } from 'react';
import { useParams, Link, useLocation as useWouterLocation } from 'wouter';
import {
  useGetListing,
  useCreateCheckoutSession,
  useSubscribeToListing,
  useGetAssetDownloadUrl,
  getGetListingQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Star,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
  AlertCircle,
  Loader2,
  ChevronRight,
  MapPin,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { BookingSlotPicker } from '@/components/booking-slot-picker';
import { format } from 'date-fns';

export default function ListingDetail() {
  const params = useParams();
  const id = params.id as string;
  const [, setLocation] = useWouterLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [booked, setBooked] = useState(false);
  const [freeDigitalPending, setFreeDigitalPending] = useState(false);
  const [downloadingAssetId, setDownloadingAssetId] = useState<string | null>(null);
  const [claimedLocal, setClaimedLocal] = useState(false);
  const queryClient = useQueryClient();

  const { data: response, isLoading, error, refetch } = useGetListing(id, {
    query: { enabled: !!id, queryKey: ['listing', id] },
  });

  const checkoutMutation = useCreateCheckoutSession();
  const downloadUrlMutation = useGetAssetDownloadUrl();

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
    owned: serverOwned,
  } = response.data as any;
  const productFiles: Array<{ id: string; assetId: string; fileName: string; sizeBytes?: number }> =
    product?.files ?? [];
  const owned = claimedLocal || !!serverOwned;
  const creatorProfileId = (user?.creatorProfile as { id?: string } | null | undefined)?.id;
  const isOwnListing = Boolean(creatorProfileId && listing.creatorId === creatorProfileId);
  const isSubscription = !!subscriptionPlan;
  const priceAmount =
    isSubscription
      ? `£${(subscriptionPlan.amountMinorUnits / 100).toFixed(2)} / ${subscriptionPlan.billingInterval}`
      : !price || (price as any).amountMinorUnits === 0
      ? 'Free'
      : `£${((price as any).amountMinorUnits / 100).toFixed(2)}`;
  const isService = listing.type === 'service_offer' || listing.type === 'group_session';
  const isFreeDigital = !isService && priceAmount === 'Free';

  const handleDownloadAsset = (assetId: string, fileName: string) => {
    setDownloadingAssetId(assetId);
    downloadUrlMutation.mutate(
      { id: assetId },
      {
        onSuccess: (data) => {
          if (data.data.url) {
            const a = document.createElement('a');
            a.href = data.data.url;
            a.download = data.data.fileName || fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast({ title: 'Download started', description: fileName });
          }
        },
        onError: () => {
          toast({
            title: 'Download failed',
            description: 'Could not generate download link. Please try again.',
            variant: 'destructive',
          });
        },
        onSettled: () => setDownloadingAssetId(null),
      },
    );
  };

  const handleSubscribe = () => {
    if (!isAuthenticated) {
      setLocation(`/auth/login?redirect=/listings/${id}`);
      return;
    }
    if (isOwnListing) {
      toast({ title: "You can't subscribe to your own listing", variant: 'destructive' });
      return;
    }
    subscribeMutation.mutate({ data: { subscriptionPlanId: subscriptionPlan.id } });
  };

  const handlePurchase = () => {
    if (!isAuthenticated) {
      setLocation(`/auth/login?redirect=/listings/${id}`);
      return;
    }
    if (isOwnListing) {
      toast({ title: "You can't buy your own listing", variant: 'destructive' });
      return;
    }

    const isFree = !price || (price as any).amountMinorUnits === 0;
    if (isFree) {
      setFreeDigitalPending(true);
      fetch('/api/v1/checkout/confirm-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: id }),
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            const code = body.code;
            throw Object.assign(new Error(body.error || 'Failed'), { code });
          }
          setClaimedLocal(true);
          toast({
            title: body.data?.alreadyOwned ? 'Already in your library' : 'Ready to download ✓',
            description: 'Your files are available below.',
          });
          void queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(id) });
          void refetch();
        })
        .catch((err: { code?: string; message?: string }) => {
          toast({
            title:
              err.code === 'CANNOT_PURCHASE_OWN_LISTING'
                ? "You can't buy your own listing"
                : err.code === 'NO_ASSET'
                  ? 'This product has no file uploaded yet'
                  : err.message || 'Could not claim free product',
            variant: 'destructive',
          });
        })
        .finally(() => setFreeDigitalPending(false));
      return;
    }

    checkoutMutation.mutate(
      { data: { listingId: id } },
      {
        onSuccess: (res) => {
          if (res.data?.checkoutUrl) window.location.href = res.data.checkoutUrl;
        },
        onError: (err: unknown) => {
          const code = (err as { data?: { code?: string } })?.data?.code;
          toast({
            title:
              code === 'CANNOT_PURCHASE_OWN_LISTING'
                ? "You can't buy your own listing"
                : 'Could not start checkout',
            variant: 'destructive',
          });
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
                <h3 className="font-serif text-3xl mb-8">About the Tutor</h3>
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
                          <BookingSlotPicker
                            listingId={id}
                            serviceOffer={serviceOffer as any}
                            price={null}
                            onBooked={() => setBooked(true)}
                            isOwnListing={isOwnListing}
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
                    ) : isOwnListing ? (
                      <div className="rounded-2xl border border-border/50 bg-muted/30 p-6 text-center space-y-3">
                        <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto opacity-60" />
                        <h3 className="text-base font-bold">This is your listing</h3>
                        <p className="text-sm text-muted-foreground font-medium">
                          You can&apos;t subscribe to your own plan. Manage it from Tutor Studio.
                        </p>
                        <Button asChild variant="outline" className="w-full font-bold">
                          <Link href="/studio/listings">Go to my listings</Link>
                        </Button>
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
                    <BookingSlotPicker
                      listingId={id}
                      serviceOffer={serviceOffer as any}
                      price={price as any}
                      onBooked={() => setBooked(true)}
                      isOwnListing={isOwnListing}
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
                    {isOwnListing ? (
                      <div className="rounded-2xl border border-background/20 bg-background/10 p-6 text-center space-y-3">
                        <AlertCircle className="h-10 w-10 text-background/60 mx-auto" />
                        <h3 className="text-base font-bold text-background">This is your listing</h3>
                        <p className="text-sm font-medium text-background/60">
                          You can&apos;t buy your own digital product. Manage it from Tutor Studio.
                        </p>
                        <Button asChild variant="secondary" className="w-full font-bold">
                          <Link href="/studio/listings">Go to my listings</Link>
                        </Button>
                      </div>
                    ) : owned && (isFreeDigital || productFiles.length > 0) ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-background/70 text-center">
                          In your library — download below
                        </p>
                        {productFiles.length > 0 ? (
                          <ul className="space-y-2">
                            {productFiles.map((f) => (
                              <li
                                key={f.id}
                                className="flex items-center gap-3 rounded-xl border border-background/20 bg-background/10 px-3 py-2.5"
                              >
                                <FileText className="h-4 w-4 shrink-0 text-primary" />
                                <span
                                  className="min-w-0 flex-1 truncate text-sm font-medium text-background"
                                  title={f.fileName}
                                >
                                  {f.fileName}
                                </span>
                                <Button
                                  size="sm"
                                  className="shrink-0 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                                  onClick={() => handleDownloadAsset(f.assetId, f.fileName)}
                                  disabled={downloadingAssetId === f.assetId}
                                >
                                  {downloadingAssetId === f.assetId ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Download className="mr-1.5 h-3.5 w-3.5" />
                                  )}
                                  Download
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : product?.paidAssetId ? (
                          <div className="flex items-center gap-3 rounded-xl border border-background/20 bg-background/10 px-3 py-2.5">
                            <FileText className="h-4 w-4 shrink-0 text-primary" />
                            <span
                              className="min-w-0 flex-1 truncate text-sm font-medium text-background"
                              title={listing.title}
                            >
                              {listing.title}
                            </span>
                            <Button
                              size="sm"
                              className="shrink-0 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={() =>
                                handleDownloadAsset(product.paidAssetId, listing.title)
                              }
                              disabled={!!downloadingAssetId}
                            >
                              {downloadingAssetId === product.paidAssetId ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Download
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-center text-background/50">
                            No files available yet.
                          </p>
                        )}
                        <Button asChild variant="link" className="w-full text-background/60">
                          <Link href="/library">Open library</Link>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="lg"
                        className="w-full h-16 text-lg font-bold rounded-xl shadow-none bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        onClick={handlePurchase}
                        disabled={checkoutMutation.isPending || freeDigitalPending}
                      >
                        {checkoutMutation.isPending || freeDigitalPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                          </>
                        ) : priceAmount === 'Free' ? (
                          'Get for free'
                        ) : (
                          'Buy Now'
                        )}
                      </Button>
                    )}
                    {!isOwnListing && !owned && priceAmount !== 'Free' && (
                      <p className="text-sm font-medium text-center text-background/50 mt-6">
                        Secure payment powered by Stripe
                      </p>
                    )}
                    {!isOwnListing && !owned && priceAmount === 'Free' && (
                      <p className="text-sm font-medium text-center text-background/50 mt-6">
                        Instant access — no payment required
                      </p>
                    )}
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
