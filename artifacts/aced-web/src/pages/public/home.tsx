import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Star, BookOpen, GraduationCap, ChevronRight, ShieldCheck, Calendar, User, ArrowUpRight } from 'lucide-react';
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
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 lg:pt-32 lg:pb-40 overflow-hidden bg-noise border-b pattern-grid">
        <div className="container relative z-10 mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-semibold mb-8 backdrop-blur-sm tracking-tight transition-transform hover:scale-105">
            <ShieldCheck className="h-4 w-4" />
            <span>Verified UK University Creators</span>
          </div>
          
          <h1 className="font-serif text-6xl md:text-8xl lg:text-9xl mb-6 tracking-tight max-w-5xl mx-auto leading-[0.9] text-foreground">
            Learn. Achieve. <span className="italic text-primary">Ace.</span>
          </h1>
          
          <p className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 font-medium tracking-tight">
            The premium marketplace where top university students share their expertise. 
            Book 1:1 sessions or download proven study materials.
          </p>
          
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto bg-background p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border flex items-center transition-shadow focus-within:shadow-[0_8px_40px_rgb(0,0,0,0.12)]">
            <Search className="h-6 w-6 text-muted-foreground ml-4 mr-2 hidden sm:block" />
            <Input 
              type="text" 
              placeholder="What do you want to learn? (e.g. Contract Law, Python...)" 
              className="border-0 focus-visible:ring-0 text-foreground bg-transparent text-lg h-14 font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button size="lg" className="rounded-xl px-8 h-14 text-base font-bold tracking-tight shadow-none">
              Search
            </Button>
          </form>
        </div>
      </section>

      {/* Stats/Social Proof */}
      <section className="border-b bg-background py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-border">
            <div className="px-4">
              <div className="text-4xl md:text-5xl font-serif text-primary mb-2">50+</div>
              <div className="text-xs md:text-sm text-muted-foreground font-bold tracking-widest uppercase">UK Universities</div>
            </div>
            <div className="px-4">
              <div className="text-4xl md:text-5xl font-serif text-primary mb-2">10k+</div>
              <div className="text-xs md:text-sm text-muted-foreground font-bold tracking-widest uppercase">Study Resources</div>
            </div>
            <div className="px-4">
              <div className="text-4xl md:text-5xl font-serif text-primary mb-2">4.9</div>
              <div className="text-xs md:text-sm text-muted-foreground font-bold tracking-widest uppercase">Average Rating</div>
            </div>
            <div className="px-4">
              <div className="text-4xl md:text-5xl font-serif text-primary mb-2">100%</div>
              <div className="text-xs md:text-sm text-muted-foreground font-bold tracking-widest uppercase">Verified Creators</div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Listings */}
      <section className="py-24 lg:py-32 border-b bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="font-serif text-4xl md:text-5xl tracking-tight mb-4">Trending Right Now</h2>
              <p className="text-muted-foreground text-lg">Fresh study materials and popular tutoring sessions.</p>
            </div>
            <Button variant="outline" className="rounded-full h-12 px-6 font-bold" asChild>
              <Link href="/search">Browse marketplace <ArrowUpRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[400px] bg-muted animate-pulse rounded-2xl"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredData?.data?.recentListings?.map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`}>
                  <Card className="h-full flex flex-col overflow-hidden group border-border/50 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl rounded-2xl bg-background">
                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 transition-colors">
                        {listing.type === 'service_offer' || listing.type === 'group_session' ? (
                          <Calendar className="h-12 w-12 text-primary/40 group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <BookOpen className="h-12 w-12 text-primary/40 group-hover:scale-110 transition-transform duration-500" />
                        )}
                      </div>
                      <div className="absolute top-4 left-4 bg-background px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">
                        {listing.type.replace('_', ' ')}
                      </div>
                    </div>
                    <CardContent className="p-6 flex flex-col flex-1">
                      <div className="flex items-center gap-1 text-sm text-foreground mb-3 font-semibold">
                        <Star className="h-4 w-4 fill-primary text-primary" />
                        <span>{listing.averageRating?.toFixed(1) || 'New'}</span>
                        <span className="text-muted-foreground font-medium">({listing.reviewCount || 0})</span>
                      </div>
                      <h3 className="font-bold text-xl leading-tight line-clamp-2 mb-4 group-hover:text-primary transition-colors">
                        {listing.title}
                      </h3>
                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/50">
                        <div className="text-sm font-semibold flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border">
                            <User className="h-4 w-4 text-muted-foreground" />
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

      {/* Featured Universities */}
      <section className="py-24 lg:py-32 bg-background border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="font-serif text-4xl md:text-5xl tracking-tight mb-4">Top Universities</h2>
              <p className="text-muted-foreground text-lg">Find materials and tutors from specific institutions.</p>
            </div>
            <Button variant="outline" className="rounded-full h-12 px-6 font-bold" asChild>
              <Link href="/search">View all <ArrowUpRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {featuredData?.data?.universities?.map((uni) => (
                <Link key={uni.id} href={`/universities/${uni.slug}`}>
                  <Card className="cursor-pointer border border-border/50 hover:border-primary transition-all duration-300 hover:shadow-lg h-full rounded-2xl group bg-muted/10">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-background border shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                        <GraduationCap className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="font-bold text-sm tracking-tight line-clamp-2">{uni.name}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-foreground text-background relative overflow-hidden">
        <div className="absolute inset-0 bg-noise opacity-10"></div>
        <div className="container relative z-10 mx-auto px-4 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary border border-secondary/20 text-sm font-bold mb-8 uppercase tracking-widest">
            For Creators
          </div>
          <h2 className="font-serif text-5xl md:text-7xl mb-8 tracking-tight">Got a First? Get Paid.</h2>
          <p className="text-xl md:text-2xl text-background/70 max-w-2xl mb-12 font-medium tracking-tight">
            Turn your hard work into income. Join hundreds of top university students selling notes, tutoring, and advice on Aced.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Button size="lg" className="h-16 px-10 text-lg font-bold rounded-xl shadow-none bg-primary text-primary-foreground hover:bg-primary/90" asChild>
              <Link href="/become-a-creator">Join as an Ace</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-10 text-lg font-bold rounded-xl shadow-none border-background/20 text-background hover:bg-background/10 hover:text-background" asChild>
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
