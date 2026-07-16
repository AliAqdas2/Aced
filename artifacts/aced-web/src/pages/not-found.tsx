import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center p-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-6">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl mb-4">
        Page Not Found
      </h1>
      <p className="text-lg text-muted-foreground max-w-md mb-8">
        We couldn't find the page you're looking for. It might have been moved or deleted.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button asChild size="lg">
          <Link href="/">Return to Homepage</Link>
        </Button>
        <Button variant="outline" asChild size="lg">
          <Link href="/search">Browse Listings</Link>
        </Button>
      </div>
    </div>
  );
}
