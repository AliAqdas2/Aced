import { useState } from 'react';
import { Link, useSearch } from 'wouter';
import { useSubmitReview } from '@workspace/api-client-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SubmitReview() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orderItemId = params.get('orderItemId') ?? '';

  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [body, setBody] = useState('');
  const [done, setDone] = useState(false);

  const submitMutation = useSubmitReview({
    mutation: {
      onSuccess: () => {
        setDone(true);
        toast({ title: 'Thanks for your review ✓' });
      },
      onError: (err: unknown) => {
        const code = (err as { data?: { code?: string } })?.data?.code;
        toast({
          title:
            code === 'ALREADY_REVIEWED'
              ? 'You already reviewed this session'
              : code === 'NOT_PURCHASER'
                ? 'Only the learner who took this session can review'
                : 'Could not submit review',
          variant: 'destructive',
        });
      },
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(`/reviews/submit?orderItemId=${orderItemId}`);
    return (
      <div className="container mx-auto px-4 py-24 max-w-lg text-center">
        <h1 className="font-serif text-3xl mb-4">Sign in to leave a review</h1>
        <p className="text-muted-foreground mb-6">You need to be signed in as the learner who took this session.</p>
        <Button asChild size="lg" className="rounded-xl">
          <Link href={`/auth/login?redirect=${redirect}`}>Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!orderItemId) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-lg text-center">
        <h1 className="font-serif text-3xl mb-4">Invalid review link</h1>
        <p className="text-muted-foreground mb-6">This review link is missing required information.</p>
        <Button asChild variant="outline">
          <Link href="/bookings">Back to bookings</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-lg text-center">
        <CheckCircle2 className="h-14 w-14 text-primary mx-auto mb-4" />
        <h1 className="font-serif text-3xl mb-3">Review submitted</h1>
        <p className="text-muted-foreground mb-6">Thank you — your feedback helps other students.</p>
        <Button asChild className="rounded-xl">
          <Link href="/search">Browse tutors</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-lg">
      <Card className="rounded-2xl shadow-none border-border/50">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Leave a review</CardTitle>
          <CardDescription>Share how your session went. Ratings are verified against your booking.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Overall rating</Label>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => {
                const value = i + 1;
                const active = (hoverRating || rating) >= value;
                return (
                  <button
                    key={value}
                    type="button"
                    className="p-1"
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(value)}
                    aria-label={`${value} star${value !== 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        active ? 'text-primary fill-primary' : 'text-muted-foreground/30'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-body">Your review <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="review-body"
              rows={5}
              maxLength={2000}
              placeholder="What went well? What could be improved?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{body.length}/2000</p>
          </div>

          <Button
            className="w-full rounded-xl h-12 font-bold"
            disabled={submitMutation.isPending}
            onClick={() =>
              submitMutation.mutate({
                data: {
                  orderItemId,
                  overallRating: rating,
                  body: body.trim() || undefined,
                },
              })
            }
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
              </>
            ) : (
              'Submit review'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
