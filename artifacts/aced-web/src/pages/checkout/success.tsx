import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function CheckoutSuccess() {
  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-12 pb-12 px-6">
          <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold font-serif mb-4">Payment Successful!</h1>
          <p className="text-muted-foreground mb-8 text-lg">
            Thank you for your purchase. A receipt has been sent to your email.
          </p>
          <div className="flex flex-col gap-4">
            <Button size="lg" className="w-full" asChild>
              <Link href="/library">View in My Library <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full" asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CheckoutCancel() {
  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-12 pb-12 px-6">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl font-bold text-muted-foreground">!</span>
          </div>
          <h1 className="text-3xl font-bold font-serif mb-4">Payment Cancelled</h1>
          <p className="text-muted-foreground mb-8 text-lg">
            Your transaction was cancelled and you haven't been charged.
          </p>
          <Button size="lg" className="w-full" asChild>
            <Link href="/search">Return to Marketplace</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
