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
  GraduationCap,
  Clock,
  Calendar,
  ArrowUpRight,
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
  const initials: string = displayName.trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const universityName: string | null = creator.universityName ?? null;
  const courseName: string | null = creator.courseName ?? null;
  const graduationYear: number | null = creator.graduationYear ?? null;
  const academicResult: string | null = creator.academicResult ?? null;
  const headline: string | null = creator.headline ?? null;
  const hasEducation = universityName || courseName;

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

  const publishedListings = listings ?? [];
  const hasSessionListings = publishedListings.some(
    (l: any) => l.type === 'service_offer' || l.type === 'group_session',
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="h-44 md:h-64 w-full bg-foreground relative overflow-hidden">
        {storefront.coverImageUrl ? (
          <img
            src={storefront.coverImageUrl}
            alt="Cover"
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="absolute inset-0 pattern-grid opacity-10" />
        )}
      </div>

      <div className="container mx-auto px-4 pb-24">
        <div className="relative -mt-12 sm:-mt-16 mb-10 flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-8">
          <Avatar className="h-24 w-24 sm:h-36 sm:w-36 border-4 border-background shadow-xl bg-background rounded-2xl shrink-0">
            <AvatarImage src={avatarUrl} className="rounded-2xl object-cover" />
            <AvatarFallback className="text-3xl sm:text-5xl font-serif bg-primary/10 text-primary rounded-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 pb-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-tight">
                {displayName}
              </h1>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0 px-3 py-1 text-xs font-bold tracking-widest uppercase shrink-0">
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                Verified Tutor
              </Badge>
            </div>

            {headline && (
              <p className="text-base text-muted-foreground font-medium mb-2 leading-snug">
                {headline}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
              {avgRating && (
                <span className="flex items-center gap-1.5 text-foreground">
                  <Star className="h-4 w-4 text-primary fill-primary" />
                  {avgRating}
                  <span className="text-muted-foreground">({reviewCount} review{reviewCount !== 1 ? 's' : ''})</span>
                </span>
              )}
              {publishedListings.length > 0 && (
                <span>{publishedListings.length} listing{publishedListings.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {hasSessionListings && (
            <div className="shrink-0 sm:pb-1">
              <Button
                size="lg"
                className="h-12 px-7 rounded-xl font-bold text-base shadow-none"
                asChild
              >
                <Link href="#services">
                  Book a Session
                  <ArrowUpRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 xl:gap-12">
          <div className="xl:col-span-2 space-y-10">
            {/* Bio */}
            <section>
              <h2 className="font-serif text-2xl mb-4">About me</h2>
              {storefront.bio ? (
                <p className="whitespace-pre-wrap leading-relaxed text-foreground/90 font-medium">
                  {storefront.bio}
                </p>
              ) : (
                <p className="italic text-muted-foreground">No biography provided.</p>
              )}
            </section>

            {/* Services & products under bio */}
            <section id="services">
              <h2 className="font-serif text-2xl mb-4">Services & products</h2>
              {publishedListings.length > 0 ? (
                <ul className="divide-y divide-border/60 border border-border/50 rounded-2xl overflow-hidden bg-background">
                  {publishedListings.map((listing: any) => {
                    const isSession =
                      listing.type === 'service_offer' || listing.type === 'group_session';
                    const priceMinorUnits =
                      listing.price ?? listing.activePrice?.amountMinorUnits;
                    const isFree = !priceMinorUnits || priceMinorUnits === 0;
                    return (
                      <li
                        key={listing.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                            {isSession ? <User className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-primary tracking-widest uppercase mb-0.5">
                              {listingTypeLabel(listing.type)}
                              {isSession && listing.serviceOffer?.durationMinutes
                                ? ` · ${listing.serviceOffer.durationMinutes} min`
                                : ''}
                            </div>
                            <h3 className="font-bold text-base leading-snug truncate">{listing.title}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 sm:shrink-0 pl-[52px] sm:pl-0">
                          <span className="font-bold text-sm">
                            {isFree ? 'Free' : `£${(priceMinorUnits / 100).toFixed(2)}`}
                          </span>
                          <Button asChild size="sm" className="rounded-xl gap-1.5">
                            <Link href={`/listings/${listing.id}`}>
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

            {/* Experience, fun facts, FAQs */}
            <section className="space-y-6">
              {(experienceLines.length > 0 || funFacts.length > 0 || faqs.length > 0) && (
                <h2 className="font-serif text-2xl">More about me</h2>
              )}

              {experienceLines.length > 0 && (
                <Collapsible open={experienceOpen} onOpenChange={setExperienceOpen}>
                  <Card className="rounded-2xl shadow-none border-border/50 bg-background">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between p-5 sm:p-6 text-left"
                      >
                        <span className="font-serif text-xl">Experience & qualifications</span>
                        <ChevronDown
                          className={`h-5 w-5 text-muted-foreground transition-transform ${experienceOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 px-5 sm:px-6 pb-5 sm:pb-6">
                        <ul className="space-y-2.5">
                          {experienceLines.map((line, i) => (
                            <li key={i} className="flex gap-2.5 text-sm font-medium text-foreground/90 leading-snug">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                              {line}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {funFacts.length > 0 && (
                <div>
                  <h3 className="font-semibold text-base mb-3">Fun facts</h3>
                  <ul className="flex flex-wrap gap-2">
                    {funFacts.map((fact, i) => (
                      <li
                        key={i}
                        className="text-sm font-medium px-3 py-1.5 rounded-xl bg-muted/50 text-foreground/90 border border-border/40"
                      >
                        {fact}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {faqs.length > 0 && (
                <div>
                  <h3 className="font-semibold text-base mb-3">Frequently asked questions</h3>
                  <div className="space-y-3">
                    {faqs.map((faq, i) => (
                      <div key={i} className="rounded-xl border border-border/50 p-4 bg-muted/20">
                        <p className="font-bold text-sm mb-1.5">{faq.q}</p>
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{faq.a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {storefront.policies && (
                <div>
                  <h3 className="font-semibold text-base mb-3">Policies</h3>
                  <p className="whitespace-pre-wrap leading-relaxed text-sm text-foreground/90 font-medium">
                    {storefront.policies}
                  </p>
                </div>
              )}
            </section>

            {/* Testimonials */}
            {testimonials.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl mb-4">Testimonials</h2>
                <div className="space-y-4">
                  {testimonials.map((t, i) => (
                    <Card key={i} className="rounded-2xl shadow-none border-border/50 bg-background">
                      <CardContent className="p-5 sm:p-6">
                        <Quote className="h-5 w-5 text-primary/40 mb-3" />
                        <p className="text-foreground/90 font-medium leading-relaxed mb-3">
                          &ldquo;{t.quote}&rdquo;
                        </p>
                        <p className="text-sm font-bold text-muted-foreground">— {t.name}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Verified reviews */}
            <section id="reviews">
              <h2 className="font-serif text-2xl mb-4">
                Verified reviews{reviewCount > 0 ? ` (${reviewCount})` : ''}
              </h2>
              {reviewCount > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review: any) => {
                    const rating = review.overallRating ?? review.rating ?? 0;
                    const body = review.body ?? review.comment ?? '';
                    return (
                      <Card key={review.id} className="rounded-2xl shadow-none border-border/50 bg-background">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-1.5 mb-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${i < rating ? 'text-primary fill-primary' : 'text-muted-foreground/30'}`}
                              />
                            ))}
                          </div>
                          {body && (
                            <p className="text-foreground/90 font-medium leading-relaxed">{body}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-3 font-medium">
                            {new Date(review.createdAt).toLocaleDateString('en-GB', {
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="rounded-2xl shadow-none border-border/50 bg-background">
                  <CardContent className="p-10 text-center">
                    <Star className="h-12 w-12 text-primary fill-primary mx-auto mb-4 opacity-20" />
                    <h3 className="text-xl font-serif tracking-tight mb-2">No reviews yet</h3>
                    <p className="text-muted-foreground font-medium">
                      This tutor hasn&apos;t received any reviews yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>

          {/* Sidebar — slim background only */}
          <div className="space-y-6">
            {hasEducation && (
              <Card className="rounded-2xl shadow-none border-border/50 bg-background">
                <CardContent className="p-6">
                  <h3 className="font-serif text-xl mb-5">Background</h3>
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary mt-0.5 shrink-0">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      {universityName && (
                        <div className="font-bold text-foreground mb-0.5">{universityName}</div>
                      )}
                      {courseName && (
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                          {courseName}
                        </div>
                      )}
                      {(graduationYear || academicResult) && (
                        <div className="text-xs font-bold tracking-widest uppercase text-primary">
                          {[
                            graduationYear ? `Class of ${graduationYear}` : null,
                            academicResult,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {avgRating && (
              <Card className="rounded-2xl shadow-none border-border/50 bg-muted/30">
                <CardContent className="p-6 flex items-center gap-3">
                  <Star className="h-5 w-5 text-primary fill-primary" />
                  <div>
                    <div className="font-bold text-lg">{avgRating}</div>
                    <div className="text-xs text-muted-foreground font-medium">
                      {reviewCount} verified review{reviewCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
