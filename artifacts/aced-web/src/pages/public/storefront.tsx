import { useParams, Link } from 'wouter';
import { useGetStorefront, getGetStorefrontQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, ShieldCheck, MapPin, Calendar, BookOpen, User, GraduationCap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Storefront() {
  const params = useParams();
  const slug = params.slug as string;
  
  const { data: response, isLoading, error } = useGetStorefront(slug, {
    query: { enabled: !!slug, queryKey: getGetStorefrontQueryKey(slug) }
  });

  if (isLoading) {
    return <div className="p-20 text-center">Loading storefront...</div>;
  }

  if (error || !response?.data) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Storefront not found</h1>
        <Button asChild><Link href="/search">Browse Marketplace</Link></Button>
      </div>
    );
  }

  const { storefront, creator, listings, reviews } = response.data as any;

  return (
    <div className="min-h-screen bg-background">
      {/* Cover Image */}
      <div className="h-64 md:h-80 w-full bg-[#0F1A3C] relative overflow-hidden">
        {storefront.coverImageUrl ? (
          <img src={storefront.coverImageUrl} alt="Cover" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="absolute inset-0 bg-primary-gradient opacity-30"></div>
        )}
      </div>

      <div className="container mx-auto px-4 pb-20">
        {/* Profile Header */}
        <div className="relative -mt-20 sm:-mt-24 mb-10 flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
          <Avatar className="h-32 w-32 sm:h-40 sm:w-40 border-4 border-background shadow-xl">
            <AvatarImage src={undefined} />
            <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
              {(storefront.displayName || 'C')[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 pb-2">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
              <h1 className="font-serif text-3xl sm:text-4xl font-bold">{storefront.displayName}</h1>
              <div className="inline-flex items-center justify-center bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-semibold self-center md:self-auto">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Verified Creator
              </div>
            </div>
            <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center"><Star className="h-4 w-4 text-yellow-500 fill-current mr-1" /> 5.0 (24 reviews)</span>
              <span className="flex items-center"><MapPin className="h-4 w-4 mr-1" /> London, UK</span>
            </div>
          </div>

          <div className="pb-2">
            <Button size="lg" className="w-full md:w-auto shadow-md">
              Message Creator
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <Tabs defaultValue="listings" className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
                <TabsTrigger value="listings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
                  Listings ({listings?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
                  About
                </TabsTrigger>
                <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
                  Reviews
                </TabsTrigger>
              </TabsList>

              <TabsContent value="listings" className="mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {listings?.map((listing: any) => (
                    <Link key={listing.id} href={`/listings/${listing.id}`}>
                      <Card className="hover-elevate cursor-pointer h-full flex flex-col group overflow-hidden">
                        <div className="aspect-video bg-muted relative border-b">
                          <div className="absolute inset-0 flex items-center justify-center">
                            {listing.type === 'service_offer' ? <User className="h-8 w-8 text-primary/30" /> : <BookOpen className="h-8 w-8 text-primary/30" />}
                          </div>
                        </div>
                        <CardContent className="p-4 flex flex-col flex-1">
                          <div className="text-xs font-semibold text-primary uppercase mb-1">{listing.type.replace('_', ' ')}</div>
                          <h3 className="font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors">{listing.title}</h3>
                          <div className="mt-auto pt-3 flex justify-between items-center text-sm">
                            <div className="font-bold">£{(listing.price / 100).toFixed(2)}</div>
                            <div className="text-muted-foreground flex items-center"><Star className="h-3 w-3 text-yellow-500 fill-current mr-1" /> 5.0</div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                  {(!listings || listings.length === 0) && (
                    <div className="col-span-full text-center py-12 border rounded-xl bg-muted/20">
                      <p className="text-muted-foreground">No listings available right now.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="about" className="mt-0">
                <Card>
                  <CardContent className="p-6 prose prose-slate dark:prose-invert max-w-none">
                    <h3 className="font-serif text-xl font-bold mb-4">About Me</h3>
                    {storefront.bio ? (
                      <p className="whitespace-pre-wrap">{storefront.bio}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No biography provided.</p>
                    )}
                    
                    {storefront.policies && (
                      <>
                        <hr className="my-6" />
                        <h3 className="font-serif text-xl font-bold mb-4">Policies</h3>
                        <p className="whitespace-pre-wrap">{storefront.policies}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="mt-0">
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center py-12">
                      <Star className="h-12 w-12 text-yellow-400 fill-current mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-bold mb-2">No reviews yet</h3>
                      <p className="text-muted-foreground">This creator hasn't received any reviews.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold mb-4">Academic Background</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg text-primary mt-0.5">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">University of Oxford</div>
                      <div className="text-sm text-muted-foreground">BA Jurisprudence (Law)</div>
                      <div className="text-xs text-muted-foreground mt-1">Class of 2024 • First Class</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Response time</span>
                    <span className="font-medium">Usually within 2 hours</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Students helped</span>
                    <span className="font-medium">50+</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Joined</span>
                    <span className="font-medium">Sept 2023</span>
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
