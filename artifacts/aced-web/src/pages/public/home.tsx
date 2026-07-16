import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Star, BookOpen, GraduationCap, ChevronRight, ShieldCheck, Calendar, User } from 'lucide-react';
import { useGetFeatured } from '@workspace/api-client-react';

export default function Home() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: featuredData, isLoading } = useGetFeatured();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
    } else {
      setLocation('/search');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-[#0F1A3C] text-white pt-24 pb-32 lg:pt-32 lg:pb-40 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2070')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-primary-gradient opacity-20"></div>
        
        <div className="container relative z-10 mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-8 backdrop-blur-sm">
            <ShieldCheck className="h-4 w-4 text-secondary" />
            <span>Verified UK University Creators</span>
          </div>
          
          <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 tracking-tight max-w-4xl mx-auto leading-tight">
            Learn. Achieve. <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Ace.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10">
            The premium marketplace where top university students share their expertise. 
            Book 1:1 sessions or download proven study materials.
          </p>
          
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto bg-white p-2 rounded-full shadow-xl flex items-center">
            <Search className="h-6 w-6 text-muted-foreground ml-4 mr-2 hidden sm:block" />
            <Input 
              type="text" 
              placeholder="What do you want to learn? (e.g. Contract Law, Python...)" 
              className="border-0 focus-visible:ring-0 text-foreground bg-transparent text-lg h-12"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button size="lg" className="rounded-full px-8 h-12 text-base font-semibold">
              Search
            </Button>
          </form>
        </div>
      </section>

      {/* Stats/Social Proof */}
      <section className="border-b bg-background py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-border/50">
            <div>
              <div className="text-3xl font-bold text-primary mb-1">50+</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">UK Universities</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary mb-1">10k+</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Study Resources</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary mb-1">4.9</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Average Rating</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary mb-1">100%</div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Verified Creators</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Universities */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="font-serif text-3xl font-bold mb-3">Top Universities</h2>
              <p className="text-muted-foreground">Find materials and tutors from specific institutions.</p>
            </div>
            <Button variant="ghost" className="hidden sm:flex" asChild>
              <Link href="/search">View all <ChevronRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-xl"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {featuredData?.data?.universities?.map((uni) => (
                <Link key={uni.id} href={`/universities/${uni.slug}`}>
                  <Card className="hover-elevate cursor-pointer border-transparent hover:border-primary/20 transition-colors h-full">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                      <GraduationCap className="h-8 w-8 text-primary mb-3 opacity-80" />
                      <h3 className="font-semibold text-sm line-clamp-2">{uni.name}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent Listings */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="font-serif text-3xl font-bold mb-3">Trending Right Now</h2>
              <p className="text-muted-foreground">Fresh study materials and popular tutoring sessions.</p>
            </div>
            <Button variant="ghost" className="hidden sm:flex" asChild>
              <Link href="/search">Browse marketplace <ChevronRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-80 bg-muted animate-pulse rounded-xl"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredData?.data?.recentListings?.map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`}>
                  <Card className="hover-elevate cursor-pointer h-full flex flex-col overflow-hidden group">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 transition-colors">
                        {listing.type === 'service_offer' || listing.type === 'group_session' ? (
                          <Calendar className="h-10 w-10 text-primary/40" />
                        ) : (
                          <BookOpen className="h-10 w-10 text-primary/40" />
                        )}
                      </div>
                      <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium uppercase tracking-wider">
                        {listing.type.replace('_', ' ')}
                      </div>
                    </div>
                    <CardContent className="p-5 flex flex-col flex-1">
                      <div className="flex items-center gap-1 text-sm text-yellow-500 mb-2">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="font-medium text-foreground">{listing.averageRating?.toFixed(1) || 'New'}</span>
                        <span className="text-muted-foreground ml-1">({listing.reviewCount || 0})</span>
                      </div>
                      <h3 className="font-semibold text-lg line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                        {listing.title}
                      </h3>
                      <div className="mt-auto pt-4 flex items-center justify-between border-t">
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <span>Top Creator</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-[#0F1A3C] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-primary-gradient opacity-10"></div>
        <div className="container relative z-10 mx-auto px-4 flex flex-col items-center text-center">
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-6">Got a First? Get Paid.</h2>
          <p className="text-lg text-white/80 max-w-2xl mb-10">
            Turn your hard work into income. Join hundreds of top university students selling notes, tutoring, and advice on Aced.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="h-14 px-8 text-lg" asChild>
              <Link href="/become-a-creator">Apply as Creator</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white text-white hover:bg-white/10" asChild>
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
