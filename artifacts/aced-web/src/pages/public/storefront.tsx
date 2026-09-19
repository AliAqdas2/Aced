import { useParams, Link } from 'wouter';
import { useGetStorefront, getGetStorefrontQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Star,
  ShieldCheck,
  BookOpen,
  User,
  Calendar,
  ChevronDown,
  Quote,
} from 'lucide-react';
import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FaqItem { q: string; a: string }
interface TestimonialItem { name: string; quote: string }
interface FaqJson {
  faqs: FaqItem[];
  funFacts: string[];
  experience: string[];
  testimonials: TestimonialItem[];
}

function parseFaqJson(raw: unknown): FaqJson {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return {
      faqs: Array.isArray(obj.faqs) ? (obj.faqs as FaqItem[]) : [],
      funFacts: Array.isArray(obj.funFacts) ? (obj.funFacts as string[]) : [],
      experience: Array.isArray(obj.experience) ? (obj.experience as string[]) : [],
      testimonials: Array.isArray(obj.testimonials) ? (obj.testimonials as TestimonialItem[]) : [],
    };
  }
  if (Array.isArray(raw)) {
    return { faqs: raw as FaqItem[], funFacts: [], experience: [], testimonials: [] };
  }
  return { faqs: [], funFacts: [], experience: [], testimonials: [] };
}

function listingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    service_offer: '1:1 coaching',
    group_session: 'Group session',
    digital_product: 'Digital product',
    recorded_course: 'Recorded course',
  };
  return labels[type] ?? type.replace(/_/g, ' ');
}

function listingPriceMinor(listing: { price?: number; activePrice?: { amountMinorUnits?: number } }): number {
  return listing.price ?? listing.activePrice?.amountMinorUnits ?? 0;
}

function formatPrice(minor: number): string {
  if (!minor || minor === 0) return 'Free';
  return `£${(minor / 100).toFixed(minor % 100 === 0 ? 0 : 2)}`;
}

export default function Storefront() {
  const params = useParams();
  const slug = params.slug as string;
  const [experienceOpen, setExperienceOpen] = useState(true);

  const { data: response, isLoading, error } = useGetStorefront(slug, {
    query: { enabled: !!slug, queryKey: getGetStorefrontQueryKey(slug) },
  });

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !response?.data) {
    return (
      <div className="container mx-auto px-4 py-32 text-center min-h-[70vh] flex flex-col items-center justify-center">
        <h1 className="font-serif text-4xl tracking-tight mb-6">Showcase not found</h1>
        <Button asChild size="lg" className="rounded-xl h-14 px-8 font-bold">
          <Link href="/search">Browse Marketplace</Link>
        </Button>
      </div>
    );
  }

  const { storefront, creator, listings, reviews } = response.data as any;

  const avatarUrl: string | undefined = creator.profile?.avatarUrl ?? undefined;
  const displayName: string = storefront.displayName || creator.profile?.displayName || 'Tutor';
  const tutorFirst = displayName.trim().split(/\s+/)[0] || displayName;
  const initials: string = displayName.trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const universityName: string | null = creator.universityName ?? null;
  const courseName: string | null = creator.courseName ?? null;
  const graduationYear: number | null = creator.graduationYear ?? null;
  const academicResult: string | null = creator.academicResult ?? null;
  const headline: string | null = creator.headline ?? null;

  const faqData = parseFaqJson(storefront.faqJson);
  const experienceLines = faqData.experience.filter((e) => e.trim());
  const funFacts = faqData.funFacts.filter((f) => f.trim());
  const faqs = faqData.faqs.filter((f) => f.q?.trim() && f.a?.trim());
  const testimonials = faqData.testimonials.filter((t) => t.name?.trim() && t.quote?.trim());

  const reviewCount: number = reviews?.length ?? 0;
  const avgRating: string | null =
    reviewCount > 0
      ? (
          reviews.reduce(
            (sum: number, r: any) => sum + (r.overallRating ?? r.rating ?? 0),
            0,
          ) / reviewCount
        ).toFixed(1)
      : null;

  const publishedListings = (listings ?? []) as any[];
  const hasSessionListings = publishedListings.some(
    (l) => l.type === 'service_offer' || l.type === 'group_session',
  );
  const sessionListings = publishedListings.filter(
    (l) => l.type === 'service_offer' || l.type === 'group_session',
  );
  const bookHref =
    sessionListings.length === 1
      ? `/listings/${sessionListings[0].id}?book=1`
      : '#services';

  const fromPriceMinor =
    publishedListings.length > 0
      ? Math.min(...publishedListings.map((l) => listingPriceMinor(l)))
      : null;

  const studiesLabel = [universityName, courseName].filter(Boolean).join(' · ') || null;

  const ProfileCard = (
    <Card className="rounded-3xl border-border/40 bg-card shadow-md overflow-hidden">
      <CardContent className="p-6 sm:p-8 flex flex-col items-center text-center">
        <Avatar className="h-28 w-28 sm:h-32 sm:w-32 mb-5 ring-4 ring-background shadow-sm">
          <AvatarImage src={avatarUrl} className="object-cover" />
          <AvatarFallback className="text-3xl font-serif bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
          <h1 className="font-serif text-3xl tracking-tight leading-none">{displayName}</h1>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 gap-1 text-[10px] font-bold tracking-wider uppercase">
            <ShieldCheck className="h-3 w-3" />
            Verified
          </Badge>
        </div>

        {avgRating ? (
          <div className="flex items-center gap-1.5 text-sm font-semibold mb-6">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span>
              {avgRating}{' '}
              <span className="text-muted-foreground font-medium">
                ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
              </span>
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-6">New on Aced</p>
        )}

        <dl className="w-full space-y-3 text-sm border-t border-border/50 pt-5 mb-6">
          {fromPriceMinor !== null && (
            <div className="flex justify-between items-center gap-3">
              <dt className="text-muted-foreground font-medium">From</dt>
              <dd className="font-bold text-foreground">{formatPrice(fromPriceMinor)}</dd>
            </div>
          )}
          {publishedListings.length > 0 && (
            <div className="flex justify-between items-center gap-3">
              <dt className="text-muted-foreground font-medium">Listings</dt>
              <dd className="font-bold text-foreground">{publishedListings.length}</dd>
            </div>
          )}
          {studiesLabel && (
            <div className="flex justify-between items-start gap-3 text-left">
              <dt className="text-muted-foreground font-medium shrink-0">Studies</dt>
              <dd className="font-semibold text-foreground text-right leading-snug">{studiesLabel}</dd>
            </div>
          )}
          {(graduationYear || academicResult) && (
            <div className="flex justify-between items-center gap-3">
              <dt className="text-muted-foreground font-medium">Result</dt>
              <dd className="font-bold text-foreground">
                {[graduationYear ? `Class of ${graduationYear}` : null, academicResult]
                  .filter(Boolean)
                  .join(' · ')}
              </dd>
            </div>
          )}
        </dl>

        {hasSessionListings ? (
          <Button asChild size="lg" className="w-full h-12 rounded-full font-bold text-base shadow-none">
            <Link href={bookHref}>Book a session</Link>
          </Button>
        ) : publishedListings.length > 0 ? (
          <Button asChild size="lg" className="w-full h-12 rounded-full font-bold text-base shadow-none">
            <Link href="#services">View offerings</Link>
          </Button>
        ) : null}

        <Button asChild variant="link" className="mt-3 text-muted-foreground">
          <Link href="/search">Browse more tutors</Link>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {storefront.coverImageUrl && (
        <div className="h-28 sm:h-36 w-full overflow-hidden bg-muted">
          <img
            src={storefront.coverImageUrl}
            alt=""
            className="w-full h-full object-cover opacity-90"
          />
        </div>
      )}

      <div className="container mx-auto px-4 py-8 sm:py-12 pb-24 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10 items-start">
          {/* Mobile: profile first */}
          <aside className="lg:hidden">{ProfileCard}</aside>

          {/* Main column */}
          <div className="lg:col-span-2 space-y-10 order-2 lg:order-1">
            {headline && (
              <section>
                <p className="text-lg sm:text-xl text-foreground/85 font-medium leading-relaxed">
                  {headline}
                </p>
              </section>
            )}

            <section>
              <h2 className="font-serif text-2xl mb-4">About me</h2>
              {storefront.bio ? (
                <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                  {storefront.bio}
                </p>
              ) : (
                <p className="italic text-muted-foreground">No biography provided yet.</p>
              )}
            </section>

            <section id="services">
              <h2 className="font-serif text-2xl mb-4">Services & products</h2>
              {publishedListings.length > 0 ? (
                <ul className="rounded-2xl border border-border/50 bg-card overflow-hidden divide-y divide-border/50">
                  {publishedListings.map((listing) => {
                    const isSession =
                      listing.type === 'service_offer' || listing.type === 'group_session';
                    const priceMinor = listingPriceMinor(listing);
                    return (
                      <li
                        key={listing.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:px-5 sm:py-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                            {isSession ? <User className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-primary tracking-widest uppercase mb-0.5">
                              {listingTypeLabel(listing.type)}
                              {isSession && listing.serviceOffer?.durationMinutes
                                ? ` · ${listing.serviceOffer.durationMinutes} min`
                                : ''}
                            </div>
                            <h3 className="font-semibold text-base leading-snug">{listing.title}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 sm:shrink-0 pl-[52px] sm:pl-0">
                          <span className="font-bold text-sm tabular-nums">{formatPrice(priceMinor)}</span>
                          <Button asChild size="sm" className="rounded-full gap-1.5 px-4">
                            <Link href={`/listings/${listing.id}${isSession ? '?book=1' : ''}`}>
                              {isSession ? (
                                <>
                                  <Calendar className="h-3.5 w-3.5" /> Book
                                </>
                              ) : (
                                'View'
                              )}
                            </Link>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-center py-12 border border-dashed rounded-2xl bg-muted/20">
                  <p className="text-muted-foreground font-medium">No listings available right now.</p>
                </div>
              )}
            </section>

            {experienceLines.length > 0 && (
              <section>
                <Collapsible open={experienceOpen} onOpenChange={setExperienceOpen}>
                  <div className="rounded-2xl border border-border/50 bg-card">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between p-5 sm:px-6 text-left"
                      >
                        <span className="font-serif text-xl">Experience & qualifications</span>
                        <ChevronDown
                          className={`h-5 w-5 text-muted-foreground transition-transform ${experienceOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                        <ul className="space-y-2.5">
                          {experienceLines.map((line, i) => (
                            <li key={i} className="flex gap-2.5 text-sm text-foreground/90 leading-snug">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </section>
            )}

            {funFacts.length > 0 && (
              <section>
                <h3 className="font-serif text-xl mb-3">Fun facts</h3>
                <ul className="flex flex-wrap gap-2">
                  {funFacts.map((fact, i) => (
                    <li
                      key={i}
                      className="text-sm px-3.5 py-1.5 rounded-full bg-muted/60 text-foreground/90 border border-border/30"
                    >
                      {fact}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {faqs.length > 0 && (
              <section>
                <h3 className="font-serif text-xl mb-3">Frequently asked questions</h3>
                <div className="space-y-3">
                  {faqs.map((faq, i) => (
                    <div key={i} className="rounded-2xl border border-border/40 bg-muted/20 p-4 sm:p-5">
                      <p className="font-semibold text-sm mb-1.5">{faq.q}</p>
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {storefront.policies && (
              <section>
                <h3 className="font-serif text-xl mb-3">Policies</h3>
                <p className="whitespace-pre-wrap leading-relaxed text-sm text-foreground/80">
                  {storefront.policies}
                </p>
              </section>
            )}

            {testimonials.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl mb-4">Testimonials</h2>
                <div className="space-y-3">
                  {testimonials.map((t, i) => (
                    <div key={i} className="rounded-2xl border border-border/40 bg-card p-5">
                      <Quote className="h-4 w-4 text-primary/40 mb-2" />
                      <p className="text-foreground/90 leading-relaxed mb-2">&ldquo;{t.quote}&rdquo;</p>
                      <p className="text-sm font-semibold text-muted-foreground">— {t.name}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section id="reviews">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-serif text-2xl">Verified reviews</h2>
                {avgRating && (
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span>
                      {avgRating} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
                    </span>
                  </div>
                )}
              </div>
              {reviewCount > 0 ? (
                <div className="space-y-3">
                  {reviews.map((review: any) => {
                    const rating = review.overallRating ?? review.rating ?? 0;
                    const body = review.body ?? review.comment ?? '';
                    const reviewerName =
                      (review.reviewerDisplayName as string | undefined)?.trim() || 'Student';
                    const initial = reviewerName.charAt(0).toUpperCase();
                    return (
                      <div
                        key={review.id}
                        className="rounded-2xl bg-card border border-border/40 p-5 sm:p-6 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold shrink-0">
                              {initial}
                            </div>
                            <span className="font-semibold truncate">{reviewerName}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 text-sm font-bold">
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                            {rating}
                          </div>
                        </div>
                        {body && (
                          <p className="text-foreground/90 leading-relaxed">{body}</p>
                        )}
                        {review.creatorResponse && (
                          <div className="mt-4 ml-2 sm:ml-6 pl-4 border-l-2 border-border/50">
                            <div className="flex items-center gap-2.5 mb-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={avatarUrl} className="object-cover" />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {tutorFirst.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-semibold text-muted-foreground">
                                {tutorFirst}&apos;s response
                              </span>
                            </div>
                            <p className="text-sm text-foreground/80 leading-relaxed">
                              {review.creatorResponse}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-border/40 bg-card p-10 text-center">
                  <Star className="h-10 w-10 text-primary fill-primary mx-auto mb-3 opacity-20" />
                  <h3 className="text-lg font-serif tracking-tight mb-1">No reviews yet</h3>
                  <p className="text-sm text-muted-foreground">
                    This tutor hasn&apos;t received any reviews yet.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Desktop sticky sidebar */}
          <aside className="hidden lg:block lg:col-span-1 order-1 lg:order-2">
            <div className="sticky top-24">{ProfileCard}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
