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
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Storefront() {
  const params = useParams();
  const slug = params.slug as string;

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

  // Derived display values
  const avatarUrl: string | undefined = creator.profile?.avatarUrl ?? undefined;
  const displayName: string = storefront.displayName || creator.profile?.displayName || 'Tutor';
  const initials: string = displayName.trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const universityName: string | null = creator.universityName ?? null;
  const courseName: string | null = creator.courseName ?? null;
  const graduationYear: number | null = creator.graduationYear ?? null;
  const academicResult: string | null = creator.academicResult ?? null;
  const headline: string | null = creator.headline ?? null;
  const hasEducation = universityName || courseName;

  const reviewCount: number = reviews?.length ?? 0;
  const avgRating: string | null =
    reviewCount > 0
      ? (reviews.reduce((sum: number, r: any) => sum + (r.rating ?? 0), 0) / reviewCount).toFixed(1)
      : null;

  const joinDate: string | null = creator.createdAt
    ? new Date(creator.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : null;

  const publishedListings = listings ?? [];
  const hasSessionListings = publishedListings.some(
    (l: any) => l.type === 'service_offer' || l.type === 'group_session',
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Cover image */}
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
        {/* Profile header — avatar overlaps the cover bottom */}
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
                <Link href="#listings">
                  Book a Session
                  <ArrowUpRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 xl:gap-12">
          {/* Main content */}
          <div id="listings" className="xl:col-span-2 space-y-8">
            <Tabs defaultValue="listings" className="w-full">
              <TabsList className="w-full justify-start border-b border-border/60 rounded-none h-auto p-0 bg-transparent mb-8 gap-6">
                <TabsTrigger
                  value="listings"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3.5 font-bold text-base text-muted-foreground data-[state=active]:text-foreground"
                >
                  Listings ({publishedListings.length})
                </TabsTrigger>
                <TabsTrigger
                  value="about"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3.5 font-bold text-base text-muted-foreground data-[state=active]:text-foreground"
                >
                  About
                </TabsTrigger>
                <TabsTrigger
                  value="reviews"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3.5 font-bold text-base text-muted-foreground data-[state=active]:text-foreground"
                >
                  Reviews ({reviewCount})
                </TabsTrigger>
              </TabsList>

              {/* Listings tab */}
              <TabsContent value="listings" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {publishedListings.map((listing: any) => {
                    const isSession =
                      listing.type === 'service_offer' || listing.type === 'group_session';
                    const priceMinorUnits =
                      listing.price ?? listing.activePrice?.amountMinorUnits;
                    const isFree = !priceMinorUnits || priceMinorUnits === 0;
                    return (
                      <Card
                        key={listing.id}
                        className="h-full flex flex-col group overflow-hidden border-border/50 hover:border-primary/40 transition-all duration-300 hover:-translate-y-0.5 rounded-2xl bg-background shadow-sm hover:shadow-lg"
                      >
                        <Link href={`/listings/${listing.id}`} className="block flex-1">
                          <div className="aspect-[4/3] bg-muted relative border-b border-border/50 overflow-hidden">
                            <div className="absolute inset-0 flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 transition-colors">
                              {isSession ? (
                                <User className="h-12 w-12 text-primary/30 group-hover:scale-110 transition-transform duration-500" />
                              ) : (
                                <BookOpen className="h-12 w-12 text-primary/30 group-hover:scale-110 transition-transform duration-500" />
                              )}
                            </div>
                            {isSession && listing.serviceOffer?.durationMinutes && (
                              <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm text-foreground text-xs font-bold px-2.5 py-1 rounded-full border border-border/50 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {listing.serviceOffer.durationMinutes} min
                              </div>
                            )}
                          </div>
                          <CardContent className="p-5 flex flex-col flex-1">
                            <div className="text-xs font-bold text-primary tracking-widest uppercase mb-2">
                              {listing.type.replace(/_/g, ' ')}
                            </div>
                            <h3 className="font-bold text-lg mb-4 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                              {listing.title}
                            </h3>
                            <div className="mt-auto pt-4 flex justify-between items-center text-sm border-t border-border/50">
                              <div className="font-bold text-lg text-foreground">
                                {isFree ? 'Free' : `£${(priceMinorUnits / 100).toFixed(2)}`}
                              </div>
                            </div>
                          </CardContent>
                        </Link>
                        {isSession && (
                          <div className="px-5 pb-5">
                            <Link href={`/listings/${listing.id}`}>
                              <Button className="w-full gap-2 rounded-xl" size="sm">
                                <Calendar className="h-4 w-4" />
                                Book a session
                              </Button>
                            </Link>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                  {publishedListings.length === 0 && (
                    <div className="col-span-full text-center py-20 border border-dashed rounded-2xl bg-muted/20">
                      <p className="text-muted-foreground font-medium">No listings available right now.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* About tab */}
              <TabsContent value="about" className="mt-0">
                <Card className="rounded-2xl shadow-none border-border/50 bg-background">
                  <CardContent className="p-6 sm:p-8">
                    {storefront.bio ? (
                      <p className="whitespace-pre-wrap leading-relaxed text-foreground/90 font-medium">
                        {storefront.bio}
                      </p>
                    ) : (
                      <p className="italic text-muted-foreground">No biography provided.</p>
                    )}
                    {storefront.policies && (
                      <>
                        <hr className="my-8 border-border/50" />
                        <h3 className="font-serif text-2xl mb-4">Policies</h3>
                        <p className="whitespace-pre-wrap leading-relaxed text-foreground/90 font-medium">
                          {storefront.policies}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reviews tab */}
              <TabsContent value="reviews" className="mt-0">
                {reviewCount > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((review: any) => (
                      <Card key={review.id} className="rounded-2xl shadow-none border-border/50 bg-background">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-1.5 mb-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${i < (review.rating ?? 0) ? 'text-primary fill-primary' : 'text-muted-foreground/30'}`}
                              />
                            ))}
                          </div>
                          {review.comment && (
                            <p className="text-foreground/90 font-medium leading-relaxed">{review.comment}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-3 font-medium">
                            {new Date(review.createdAt).toLocaleDateString('en-GB', {
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="rounded-2xl shadow-none border-border/50 bg-background">
                    <CardContent className="p-10 text-center">
                      <Star className="h-12 w-12 text-primary fill-primary mx-auto mb-4 opacity-20" />
                      <h3 className="text-xl font-serif tracking-tight mb-2">No reviews yet</h3>
                      <p className="text-muted-foreground font-medium">
                        This tutor hasn't received any reviews yet.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Education background — only if data exists */}
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

            {/* Stats — only meaningful real data */}
            {(publishedListings.length > 0 || reviewCount > 0 || joinDate) && (
              <Card className="rounded-2xl shadow-none border-border/50 bg-muted/30">
                <CardContent className="p-6">
                  <h3 className="font-serif text-xl mb-5">Quick Stats</h3>
                  <div className="space-y-4">
                    {publishedListings.length > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Listings</span>
                        <span className="font-bold text-foreground">{publishedListings.length}</span>
                      </div>
                    )}
                    {reviewCount > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Reviews</span>
                        <span className="font-bold text-foreground">{reviewCount}</span>
                      </div>
                    )}
                    {avgRating && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Rating</span>
                        <span className="font-bold text-foreground flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                          {avgRating}
                        </span>
                      </div>
                    )}
                    {joinDate && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Joined</span>
                        <span className="font-bold text-foreground">{joinDate}</span>
                      </div>
                    )}
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
