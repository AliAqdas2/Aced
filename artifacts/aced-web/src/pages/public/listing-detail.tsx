import { useParams, Link, useLocation as useWouterLocation } from 'wouter';
import { useGetListing, useCreateCheckoutSession } from '@workspace/api-client-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, ShieldCheck, CheckCircle2, Clock, CalendarDays, Download, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function ListingDetail() {
  const params = useParams();
  const id = params.id as string;
  const [, setLocation] = useWouterLocation();
  const { isAuthenticated } = useAuth();
  
  const { data: response, isLoading, error } = useGetListing(id, {
    query: { enabled: !!id, queryKey: ['listing', id] }
  });

  const checkoutMutation = useCreateCheckoutSession();

  if (isLoading) {
    return <div className="min-h-[70vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (error || !response?.data?.listing) {
    return (
      <div className="container mx-auto px-4 py-32 text-center min-h-[70vh] flex flex-col items-center justify-center">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-6 opacity-20" />
        <h1 className="font-serif text-4xl tracking-tight mb-4">Listing not found</h1>
        <p className="text-muted-foreground font-medium mb-8 text-lg">This listing may have been removed or is no longer available.</p>
        <Button asChild size="lg" className="rounded-xl h-14 px-8 font-bold"><Link href="/search">Browse Marketplace</Link></Button>
      </div>
    );
  }

  const { listing, price, serviceOffer, product } = response.data;
  const priceAmount = price ? `£${(price.amountMinorUnits / 100).toFixed(2)}` : 'Free';
  const isService = listing.type === 'service_offer' || listing.type === 'group_session';

  const handlePurchase = () => {
    if (!isAuthenticated) {
      setLocation(`/auth/login?redirect=/listings/${id}`);
      return;
    }
    
    // For digital products, go straight to checkout
    if (!isService) {
      checkoutMutation.mutate({ data: { listingId: id } }, {
        onSuccess: (res) => {
          if (res.data?.checkoutUrl) {
            window.location.href = res.data.checkoutUrl;
          }
        }
      });
    } else {
      // For services, we'd ideally show a booking calendar first
      // But for MVP, if no hold is required by API, we create session
      setLocation(`/checkout?listing=${id}`);
    }
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
                {listing.type.replace('_', ' ')}
              </div>
              <h1 className="font-serif text-5xl sm:text-6xl font-normal mb-6 leading-[1.1] tracking-tight text-foreground">{listing.title}</h1>
              
              <div className="flex items-center gap-6 text-sm mb-10 pb-10 border-b border-border/50">
                <div className="flex items-center text-foreground font-semibold">
                  <Star className="h-5 w-5 fill-primary text-primary mr-1.5" />
                  <span className="text-lg">{listing.averageRating?.toFixed(1) || '5.0'}</span>
                  <span className="text-muted-foreground ml-2 font-medium">({listing.reviewCount || 0} reviews)</span>
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
                  {listing.tags.map(tag => (
                    <span key={tag} className="bg-muted px-4 py-2 rounded-lg text-sm font-semibold text-foreground">
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
                    <AvatarFallback className="bg-primary/10 text-primary text-3xl font-serif">C</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Link href={`/storefronts/creator`} className="font-bold text-2xl hover:text-primary transition-colors block mb-2">
                      Top University Scholar
                    </Link>
                    <div className="text-sm font-medium text-muted-foreground flex items-center mb-4">
                      <ShieldCheck className="h-5 w-5 text-primary mr-2" /> Verified Oxford Student
                    </div>
                    <Button variant="outline" className="rounded-xl h-10 font-bold" asChild>
                      <Link href={`/storefronts/creator`}>View Profile</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sticky Sidebar - Checkout/Booking Card */}
          <div className="space-y-6">
            <div className="sticky top-32">
              <Card className="shadow-2xl border-transparent rounded-3xl overflow-hidden bg-foreground text-background">
                <CardContent className="p-8">
                  <div className="text-5xl font-serif tracking-tight mb-8 text-primary">{priceAmount}</div>
                  
                  {isService ? (
                    <div className="space-y-5 mb-8">
                      <div className="flex items-center gap-4 text-base font-medium text-background/80">
                        <Clock className="h-6 w-6 text-primary" />
                        <span>{(serviceOffer as any)?.durationMinutes || 60} minutes</span>
                      </div>
                      <div className="flex items-center gap-4 text-base font-medium text-background/80">
                        <CalendarDays className="h-6 w-6 text-primary" />
                        <span>1:1 Video Call</span>
                      </div>
                    </div>
                  ) : (
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
                  )}

                  <Button 
                    size="lg" 
                    className="w-full h-16 text-lg font-bold rounded-xl shadow-none bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    onClick={handlePurchase}
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? 'Processing...' : (isService ? 'Book Session' : 'Buy Now')}
                  </Button>
                  
                  <p className="text-sm font-medium text-center text-background/50 mt-6">
                    Secure payment powered by Stripe
                  </p>
                </CardContent>
              </Card>

              {/* Trust Badge */}
              <div className="mt-8 flex items-start gap-4 p-6 bg-primary/5 rounded-3xl border border-primary/10">
                <ShieldCheck className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <span className="font-bold block mb-1 text-foreground">Aced Guarantee</span>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed">Verified creators, secure payments, and quality assurance.</p>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
