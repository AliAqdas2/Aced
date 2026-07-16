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
    return <div className="min-h-[70vh] flex items-center justify-center">Loading listing details...</div>;
  }

  if (error || !response?.data?.listing) {
    return (
      <div className="container mx-auto px-4 py-20 text-center min-h-[70vh] flex flex-col items-center justify-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-4">Listing not found</h1>
        <p className="text-muted-foreground mb-8">This listing may have been removed or is no longer available.</p>
        <Button asChild><Link href="/search">Browse Marketplace</Link></Button>
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
    <div className="min-h-screen bg-muted/20 pb-20">
      {/* Breadcrumbs */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-3 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/search" className="hover:text-foreground">Marketplace</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">{listing.title}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-background rounded-xl border p-8 shadow-sm">
              <div className="inline-flex items-center justify-center bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                {listing.type.replace('_', ' ')}
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold mb-4 leading-tight">{listing.title}</h1>
              
              <div className="flex items-center gap-4 text-sm mb-8 pb-8 border-b">
                <div className="flex items-center text-yellow-500">
                  <Star className="h-4 w-4 fill-current mr-1" />
                  <span className="font-bold text-foreground">{listing.averageRating?.toFixed(1) || '5.0'}</span>
                  <span className="text-muted-foreground ml-1">({listing.reviewCount || 0} reviews)</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="text-muted-foreground">
                  {listing.purchaseCount || 0} enrolled
                </div>
              </div>

              <div className="prose prose-slate max-w-none">
                <h3 className="font-serif text-xl font-bold mb-4">Description</h3>
                <p className="whitespace-pre-wrap">{listing.description}</p>
              </div>

              {listing.tags && listing.tags.length > 0 && (
                <div className="mt-8 pt-8 border-t flex flex-wrap gap-2">
                  {listing.tags.map(tag => (
                    <span key={tag} className="bg-muted px-3 py-1 rounded-full text-sm text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Creator Info */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-serif text-xl font-bold mb-6">About the Creator</h3>
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">C</AvatarFallback>
                  </Avatar>
                  <div>
                    <Link href={`/storefronts/creator`} className="font-bold text-lg hover:text-primary transition-colors">
                      Top University Scholar
                    </Link>
                    <div className="text-sm text-muted-foreground flex items-center mt-1 mb-2">
                      <ShieldCheck className="h-4 w-4 text-blue-500 mr-1" /> Verified Oxford Student
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/storefronts/creator`}>View Profile</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sticky Sidebar - Checkout/Booking Card */}
          <div className="space-y-6">
            <div className="sticky top-24">
              <Card className="shadow-lg border-primary/20 overflow-hidden">
                <div className="bg-primary h-2 w-full"></div>
                <CardContent className="p-6">
                  <div className="text-3xl font-bold mb-6">{priceAmount}</div>
                  
                  {isService ? (
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center gap-3 text-sm">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <span>{(serviceOffer as any)?.durationMinutes || 60} minutes</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <CalendarDays className="h-5 w-5 text-muted-foreground" />
                        <span>1:1 Video Call</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center gap-3 text-sm">
                        <Download className="h-5 w-5 text-muted-foreground" />
                        <span>Instant digital download</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <span>Lifetime access</span>
                      </div>
                    </div>
                  )}

                  <Button 
                    size="lg" 
                    className="w-full h-14 text-lg font-bold shadow-md"
                    onClick={handlePurchase}
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? 'Processing...' : (isService ? 'Book Session' : 'Buy Now')}
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    Secure payment powered by Stripe.
                  </p>
                </CardContent>
              </Card>

              {/* Trust Badge */}
              <div className="mt-6 flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-900">
                <ShieldCheck className="h-6 w-6 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-bold block mb-1">Aced Guarantee</span>
                  Verified creators, secure payments, and quality assurance.
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
