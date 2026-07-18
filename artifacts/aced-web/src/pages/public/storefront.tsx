import { useParams, Link } from 'wouter';
import { useGetStorefront, getGetStorefrontQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, ShieldCheck, MapPin, BookOpen, User, GraduationCap, ArrowUpRight, Clock, Calendar } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Storefront() {
  const params = useParams();
  const slug = params.slug as string;
  
  const { data: response, isLoading, error } = useGetStorefront(slug, {
    query: { enabled: !!slug, queryKey: getGetStorefrontQueryKey(slug) }
  });

  if (isLoading) {
    return <div className="min-h-[70vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (error || !response?.data) {
    return (
      <div className="container mx-auto px-4 py-32 text-center min-h-[70vh] flex flex-col items-center justify-center">
        <h1 className="font-serif text-4xl tracking-tight mb-6">Storefront not found</h1>
        <Button asChild size="lg" className="rounded-xl h-14 px-8 font-bold"><Link href="/search">Browse Marketplace</Link></Button>
      </div>
    );
  }

  const { storefront, creator, listings, reviews } = response.data as any;

  return (
    <div className="min-h-screen bg-background">
      {/* Cover Image */}
      <div className="h-64 md:h-96 w-full bg-foreground relative overflow-hidden pattern-grid">
        {storefront.coverImageUrl ? (
          <img src={storefront.coverImageUrl} alt="Cover" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="absolute inset-0 bg-primary/20 mix-blend-overlay"></div>
        )}
      </div>

      <div className="container mx-auto px-4 pb-24">
        {/* Profile Header */}
        <div className="relative -mt-24 sm:-mt-32 mb-16 flex flex-col md:flex-row items-center md:items-end gap-8 text-center md:text-left">
          <Avatar className="h-40 w-40 sm:h-56 sm:w-56 border-8 border-background shadow-2xl bg-background rounded-3xl">
            <AvatarImage src={undefined} className="rounded-2xl" />
            <AvatarFallback className="text-6xl font-serif bg-primary/10 text-primary rounded-2xl">
              {(storefront.displayName || 'C')[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 pb-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
              <h1 className="font-serif text-5xl sm:text-6xl tracking-tight">{storefront.displayName}</h1>
              <div className="inline-flex items-center justify-center bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold tracking-widest uppercase self-center md:self-auto">
                <ShieldCheck className="h-4 w-4 mr-2" />
                Verified Creator
              </div>
            </div>
            <div className="flex items-center justify-center md:justify-start gap-6 text-base font-medium text-muted-foreground">
              <span className="flex items-center text-foreground"><Star className="h-5 w-5 text-primary fill-primary mr-2" /> 5.0 (24 reviews)</span>
              <span className="flex items-center"><MapPin className="h-5 w-5 mr-2" /> London, UK</span>
            </div>
          </div>

          <div className="pb-4 w-full md:w-auto">
            <Button size="lg" className="w-full md:w-auto h-14 px-8 rounded-xl font-bold text-lg shadow-none">
              Message Creator
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="xl:col-span-2 space-y-10">
            <Tabs defaultValue="listings" className="w-full">
              <TabsList className="w-full justify-start border-b-2 border-border/50 rounded-none h-auto p-0 bg-transparent mb-10 gap-8">
                <TabsTrigger value="listings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-4 font-bold text-lg text-muted-foreground data-[state=active]:text-foreground transition-all">
                  Listings ({listings?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-4 font-bold text-lg text-muted-foreground data-[state=active]:text-foreground transition-all">
                  About
                </TabsTrigger>
                <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-4 font-bold text-lg text-muted-foreground data-[state=active]:text-foreground transition-all">
                  Reviews
                </TabsTrigger>
              </TabsList>

              <TabsContent value="listings" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {listings?.map((listing: any) => {
                    const isSession = listing.type === 'service_offer' || listing.type === 'group_session';
                    const priceMinorUnits = listing.price ?? listing.activePrice?.amountMinorUnits;
                    const isFree = !priceMinorUnits || priceMinorUnits === 0;
                    return (
                      <Card key={listing.id} className="h-full flex flex-col group overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 rounded-2xl bg-background shadow-sm hover:shadow-xl">
                        <Link href={`/listings/${listing.id}`} className="block flex-1">
                          <div className="aspect-[4/3] bg-muted relative border-b border-border/50 overflow-hidden">
                            <div className="absolute inset-0 flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 transition-colors">
                              {isSession
                                ? <User className="h-12 w-12 text-primary/30 group-hover:scale-110 transition-transform duration-500" />
                                : <BookOpen className="h-12 w-12 text-primary/30 group-hover:scale-110 transition-transform duration-500" />}
                            </div>
                            {isSession && listing.serviceOffer?.durationMinutes && (
                              <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm text-foreground text-xs font-bold px-2.5 py-1 rounded-full border border-border/50 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {listing.serviceOffer.durationMinutes} min
                              </div>
                            )}
                          </div>
                          <CardContent className="p-6 flex flex-col flex-1">
                            <div className="text-xs font-bold text-primary tracking-widest uppercase mb-3">
                              {listing.type.replace(/_/g, ' ')}
                            </div>
                            <h3 className="font-bold text-xl mb-4 line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                              {listing.title}
                            </h3>
                            <div className="mt-auto pt-5 flex justify-between items-center text-sm border-t border-border/50">
                              <div className="font-bold text-lg text-foreground">
                                {isFree ? 'Free' : `£${(priceMinorUnits / 100).toFixed(2)}`}
                              </div>
                              <div className="text-muted-foreground font-medium flex items-center">
                                <Star className="h-4 w-4 text-primary fill-primary mr-1.5" /> 5.0
                              </div>
                            </div>
                          </CardContent>
                        </Link>
                        {isSession && (
                          <div className="px-6 pb-5">
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
                  {(!listings || listings.length === 0) && (
                    <div className="col-span-full text-center py-24 border border-dashed rounded-2xl bg-muted/20">
                      <p className="text-muted-foreground font-medium text-lg">No listings available right now.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="about" className="mt-0">
                <Card className="rounded-2xl shadow-none border-border/50 bg-background">
                  <CardContent className="p-8 sm:p-10 prose prose-lg prose-slate dark:prose-invert max-w-none prose-headings:font-serif prose-headings:font-normal prose-headings:tracking-tight prose-p:font-medium prose-p:text-muted-foreground">
                    <h3 className="text-3xl mb-6">About Me</h3>
                    {storefront.bio ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{storefront.bio}</p>
                    ) : (
                      <p className="italic">No biography provided.</p>
                    )}
                    
                    {storefront.policies && (
                      <>
                        <hr className="my-12 border-border/50" />
                        <h3 className="text-3xl mb-6">Policies</h3>
                        <p className="whitespace-pre-wrap leading-relaxed">{storefront.policies}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="mt-0">
                <Card className="rounded-2xl shadow-none border-border/50 bg-background">
                  <CardContent className="p-10">
                    <div className="text-center py-16">
                      <Star className="h-16 w-16 text-primary fill-primary mx-auto mb-6 opacity-20" />
                      <h3 className="text-2xl font-serif tracking-tight mb-3">No reviews yet</h3>
                      <p className="text-muted-foreground font-medium text-lg">This creator hasn't received any reviews.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <Card className="rounded-2xl shadow-none border-border/50 bg-background">
              <CardContent className="p-8">
                <h3 className="font-serif text-3xl mb-6">Background</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-xl text-primary mt-1">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-bold text-lg mb-1 text-foreground">University of Oxford</div>
                      <div className="text-base font-medium text-muted-foreground mb-1">BA Jurisprudence (Law)</div>
                      <div className="text-sm font-bold tracking-widest uppercase text-primary">Class of 2024 • First Class</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-none border-border/50 bg-muted/20">
              <CardContent className="p-8">
                <h3 className="font-serif text-3xl mb-6">Quick Stats</h3>
                <div className="space-y-5">
                  <div className="flex justify-between items-center text-base">
                    <span className="text-muted-foreground font-medium">Response time</span>
                    <span className="font-bold text-foreground">Within 2 hours</span>
                  </div>
                  <div className="flex justify-between items-center text-base">
                    <span className="text-muted-foreground font-medium">Students helped</span>
                    <span className="font-bold text-foreground">50+</span>
                  </div>
                  <div className="flex justify-between items-center text-base">
                    <span className="text-muted-foreground font-medium">Joined</span>
                    <span className="font-bold text-foreground">Sept 2023</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
