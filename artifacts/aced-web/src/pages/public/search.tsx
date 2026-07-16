import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useSearchMarketplace, useListUniversities } from '@workspace/api-client-react';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Search as SearchIcon, Filter, Star, BookOpen, User, GraduationCap, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export default function Search() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 500);
  
  const [type, setType] = useState<string>('all');
  const [universityId, setUniversityId] = useState<string>('all');
  const [sort, setSort] = useState<string>('recommended');

  const { data: searchResults, isLoading } = useSearchMarketplace({
    q: debouncedQuery || undefined,
    type: type !== 'all' ? type as any : undefined,
    universityId: universityId !== 'all' ? universityId : undefined,
    sort: sort as any,
    limit: 50
  });

  const { data: universities } = useListUniversities();

  const handleClearFilters = () => {
    setQuery('');
    setType('all');
    setUniversityId('all');
    setSort('recommended');
  };

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Search</Label>
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search listings..." 
            className="pl-9"
          />
          {query && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="digital_product">Digital Products</SelectItem>
            <SelectItem value="service_offer">1:1 Tutoring</SelectItem>
            <SelectItem value="group_session">Group Sessions</SelectItem>
            <SelectItem value="recorded_course">Recorded Courses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>University</Label>
        <Select value={universityId} onValueChange={setUniversityId}>
          <SelectTrigger>
            <SelectValue placeholder="All universities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All universities</SelectItem>
            {universities?.data?.map(uni => (
              <SelectItem key={uni.id} value={uni.id}>{uni.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" className="w-full" onClick={handleClearFilters}>
        Clear Filters
      </Button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold">Search Marketplace</h1>
          <p className="text-muted-foreground mt-1">
            {searchResults?.meta?.count || 0} results found
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2">
            <span className="text-sm font-medium">Sort by:</span>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Recommended" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="md:hidden">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <SheetHeader className="mb-6">
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <FilterContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex gap-8 items-start">
        {/* Desktop Sidebar Filters */}
        <div className="hidden md:block w-64 shrink-0 sticky top-24">
          <Card>
            <CardContent className="p-6">
              <FilterContent />
            </CardContent>
          </Card>
        </div>

        {/* Results Grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 bg-muted animate-pulse rounded-xl"></div>
              ))}
            </div>
          ) : searchResults?.data?.length === 0 ? (
            <div className="text-center py-20 border rounded-xl bg-muted/30">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No results found</h3>
              <p className="text-muted-foreground mb-6">Try adjusting your filters or search query.</p>
              <Button onClick={handleClearFilters}>Clear all filters</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults?.data?.map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`}>
                  <Card className="hover-elevate cursor-pointer h-full flex flex-col overflow-hidden group">
                    <div className="aspect-video bg-muted relative overflow-hidden border-b">
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 transition-colors">
                        {listing.type === 'service_offer' ? (
                          <User className="h-10 w-10 text-primary/30" />
                        ) : listing.type === 'group_session' ? (
                          <User className="h-10 w-10 text-primary/30" />
                        ) : (
                          <BookOpen className="h-10 w-10 text-primary/30" />
                        )}
                      </div>
                      <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium uppercase tracking-wider shadow-sm">
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
                        <div className="text-sm font-medium">
                          {listing.activePrice ? `£${(listing.activePrice.amountMinorUnits / 100).toFixed(2)}` : 'Free'}
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-primary">
                          View details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
