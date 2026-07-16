import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetListing, getGetListingQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'wouter';

export default function Checkout() {
  const searchParams = new URLSearchParams(window.location.search);
  const listingId = searchParams.get('listing');
  const [, setLocation] = useLocation();

  const { data: response, isLoading } = useGetListing(listingId || '', {
    query: { enabled: !!listingId, queryKey: getGetListingQueryKey(listingId || '') }
  });

  useEffect(() => {
    if (!listingId) {
      setLocation('/');
    }
  }, [listingId, setLocation]);

  if (isLoading || !response?.data?.listing) {
    return <div className="min-h-screen flex items-center justify-center">Loading checkout...</div>;
  }

  const { listing, price } = response.data;
  const isService = listing.type === 'service_offer' || listing.type === 'group_session';

  return (
    <div className="min-h-screen bg-muted/20 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button variant="ghost" asChild className="mb-6 -ml-4">
          <Link href={`/listings/${listing.id}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to listing</Link>
        </Button>
        
        <h1 className="text-3xl font-bold font-serif mb-8">Checkout</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <div className="h-20 w-20 bg-muted rounded flex items-center justify-center shrink-0">
                    <span className="font-bold text-muted-foreground">{listing.type.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{listing.title}</h3>
                    <p className="text-muted-foreground text-sm">{listing.type.replace('_', ' ')}</p>
                  </div>
                </div>

                {isService && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm">
                    <p className="font-semibold text-primary mb-1">Schedule your session</p>
                    <p>After checkout, you will be directed to select a time that works for you.</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Payment details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  All transactions are secure and encrypted.
                </p>
                {/* This would be a Stripe Elements form in reality */}
                <div className="p-4 border rounded-lg bg-background text-center text-muted-foreground">
                  Stripe Payment Element Placeholder
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Total</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{price ? `£${(price.amountMinorUnits / 100).toFixed(2)}` : 'Free'}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-xl pt-4 border-t">
                  <span>Total</span>
                  <span>{price ? `£${(price.amountMinorUnits / 100).toFixed(2)}` : 'Free'}</span>
                </div>
                
                <Button size="lg" className="w-full mt-6" asChild>
                  {/* Simulate successful payment redirect */}
                  <Link href="/checkout/success">Complete Payment</Link>
                </Button>
                
                <div className="flex items-start gap-2 mt-4 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <p>Aced uses industry-standard encryption to protect your payment details.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
