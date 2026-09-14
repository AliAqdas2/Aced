import { useState, useEffect } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useSearchMarketplace, useListUniversities } from '@workspace/api-client-react';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Search as SearchIcon, Filter, Star, BookOpen, User, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const LISTING_TYPES = new Set([
  'digital_product',
  'service_offer',
  'group_session',
  'recorded_course',
]);

const SORT_OPTIONS = new Set([
  'recommended',
  'rating',
  'newest',
  'price_asc',
  'price_desc',
  'most_booked',
]);

interface SearchFilters {
  q: string;
  type: string;
  universityId: string;
  courseId?: string;
  sort: string;
}

function parseFiltersFromSearch(search: string): SearchFilters {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const q = params.get('q') ?? '';
  const rawType = params.get('type') ?? '';
  const type = LISTING_TYPES.has(rawType) ? rawType : 'all';
  const universityId = params.get('universityId') || 'all';
  const courseId = params.get('courseId') || undefined;
  const rawSort = params.get('sort') ?? 'recommended';
  const sort = SORT_OPTIONS.has(rawSort) ? rawSort : 'recommended';
  return { q, type, universityId, courseId, sort };
}

function buildSearchPath(filters: SearchFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.type !== 'all') params.set('type', filters.type);
  if (filters.universityId !== 'all') params.set('universityId', filters.universityId);
  if (filters.courseId) params.set('courseId', filters.courseId);
  if (filters.sort !== 'recommended') params.set('sort', filters.sort);
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}

export default function Search() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const filters = parseFiltersFromSearch(searchString);

  // Local input for q; type/university/sort come from the URL (source of truth)
  const [queryInput, setQueryInput] = useState(filters.q);
  const debouncedQuery = useDebounce(queryInput, 500);

  // Keep input in sync when URL q changes (deep link / back / clear)
  useEffect(() => {
    setQueryInput(filters.q);
  }, [filters.q]);

  // Push debounced text query into the URL without clobbering other filters
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed === filters.q.trim()) return;
    setLocation(
      buildSearchPath({
        q: trimmed,
        type: filters.type,
        universityId: filters.universityId,
        courseId: filters.courseId,
        sort: filters.sort,
      }),
      { replace: true },
    );
    // Intentionally depend on URL-derived fields, not the filters object identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedQuery,
    filters.q,
    filters.type,
    filters.universityId,
    filters.courseId,
    filters.sort,
    setLocation,
  ]);

  function updateFilters(patch: Partial<SearchFilters>) {
    setLocation(
      buildSearchPath({
        ...filters,
        q: queryInput,
        ...patch,
      }),
      { replace: true },
    );
  }

  const { data: searchResults, isLoading } = useSearchMarketplace({
    q: filters.q || undefined,
    type: filters.type !== 'all' ? (filters.type as any) : undefined,
    universityId: filters.universityId !== 'all' ? filters.universityId : undefined,
    courseId: filters.courseId || undefined,
    sort: filters.sort as any,
    limit: 50,
  });

  const { data: universities } = useListUniversities();

  const handleClearFilters = () => {
    setQueryInput('');
    setLocation('/search', { replace: true });
  };

  const FilterContent = () => (
    <div className="space-y-8">
      <div className="space-y-4">
        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Search</Label>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search listings or tutors..."
            className="pl-10 h-12 rounded-xl bg-muted/50 border-transparent focus-visible:bg-background transition-colors font-medium"
          />
          {queryInput && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1.5 h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setQueryInput('');
                updateFilters({ q: '' });
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Type</Label>
        <Select value={filters.type} onValueChange={(value) => updateFilters({ type: value })}>
          <SelectTrigger className="h-12 rounded-xl bg-muted/50 border-transparent font-medium focus:ring-primary focus:ring-offset-0 focus:bg-background transition-colors">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border shadow-xl">
            <SelectItem value="all" className="font-medium rounded-lg">All types</SelectItem>
            <SelectItem value="digital_product" className="font-medium rounded-lg">Digital Products</SelectItem>
            <SelectItem value="service_offer" className="font-medium rounded-lg">1:1 Tutoring</SelectItem>
            <SelectItem value="group_session" className="font-medium rounded-lg">Group Sessions</SelectItem>
            <SelectItem value="recorded_course" className="font-medium rounded-lg">Recorded Courses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">University</Label>
        <Select
          value={filters.universityId}
          onValueChange={(value) => updateFilters({ universityId: value })}
        >
          <SelectTrigger className="h-12 rounded-xl bg-muted/50 border-transparent font-medium focus:ring-primary focus:ring-offset-0 focus:bg-background transition-colors">
            <SelectValue placeholder="All universities" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border shadow-xl max-h-[300px]">
            <SelectItem value="all" className="font-medium rounded-lg">All universities</SelectItem>
            {universities?.data?.map((uni) => (
              <SelectItem key={uni.id} value={uni.id} className="font-medium rounded-lg">
                {uni.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-border" onClick={handleClearFilters}>
        Clear Filters
      </Button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <h1 className="font-serif text-5xl md:text-6xl tracking-tight mb-2">Search Marketplace</h1>
          <p className="text-muted-foreground font-medium text-lg">
            {searchResults?.meta?.count || 0} results found
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3">
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Sort</span>
            <Select value={filters.sort} onValueChange={(value) => updateFilters({ sort: value })}>
              <SelectTrigger className="w-[200px] h-12 rounded-xl border-border font-medium bg-background">
                <SelectValue placeholder="Recommended" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border shadow-xl">
                <SelectItem value="recommended" className="font-medium rounded-lg">Recommended</SelectItem>
                <SelectItem value="rating" className="font-medium rounded-lg">Highest Rated</SelectItem>
                <SelectItem value="newest" className="font-medium rounded-lg">Newest First</SelectItem>
                <SelectItem value="price_asc" className="font-medium rounded-lg">Price: Low to High</SelectItem>
                <SelectItem value="price_desc" className="font-medium rounded-lg">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="md:hidden h-12 rounded-xl font-bold px-6 border-border bg-background">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px] p-6 border-r-border">
              <SheetHeader className="mb-8">
                <SheetTitle className="font-serif text-3xl">Filters</SheetTitle>
              </SheetHeader>
              <FilterContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex gap-10 items-start">
        <div className="hidden md:block w-72 shrink-0 sticky top-32">
          <Card className="rounded-2xl border-border/50 shadow-sm bg-background">
            <CardContent className="p-6">
              <FilterContent />
            </CardContent>
          </Card>
        </div>

        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-[400px] bg-muted animate-pulse rounded-2xl"></div>
              ))}
            </div>
          ) : searchResults?.data?.length === 0 ? (
            <div className="text-center py-32 border border-dashed rounded-2xl bg-muted/20">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-6 opacity-20" />
              <h3 className="text-2xl font-serif tracking-tight mb-3">No results found</h3>
              <p className="text-muted-foreground font-medium mb-8">Try adjusting your filters or search query.</p>
              <Button onClick={handleClearFilters} size="lg" className="rounded-xl h-12 px-8 font-bold">
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {searchResults?.data?.map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`}>
                  <Card className="hover-elevate cursor-pointer h-full flex flex-col overflow-hidden group border-border/50 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl rounded-2xl bg-background">
                    <div className="aspect-[4/3] bg-muted relative overflow-hidden border-b border-border/50">
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 transition-colors">
                        {listing.type === 'service_offer' || listing.type === 'group_session' ? (
                          <User className="h-12 w-12 text-primary/30 group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <BookOpen className="h-12 w-12 text-primary/30 group-hover:scale-110 transition-transform duration-500" />
                        )}
                      </div>
                      <div className="absolute top-4 left-4 bg-background px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">
                        {listing.type.replace('_', ' ')}
                      </div>
                    </div>
                    <CardContent className="p-6 flex flex-col flex-1">
                      <div className="flex items-center gap-1 text-sm mb-3 font-semibold text-foreground">
                        <Star className="h-4 w-4 fill-primary text-primary" />
                        <span>{listing.averageRating?.toFixed(1) || 'New'}</span>
                        <span className="text-muted-foreground font-medium ml-1">({listing.reviewCount || 0})</span>
                      </div>
                      <h3 className="font-bold text-xl leading-tight line-clamp-2 mb-4 group-hover:text-primary transition-colors">
                        {listing.title}
                      </h3>

                      <div className="mt-auto pt-5 flex items-center justify-between border-t border-border/50">
                        <div className="text-lg font-bold text-primary">
                          {listing.activePrice
                            ? `£${(listing.activePrice.amountMinorUnits / 100).toFixed(2)}`
                            : 'Free'}
                        </div>
                        <Button
                          variant="ghost"
                          className="rounded-lg h-10 px-4 font-bold hover:bg-primary/10 hover:text-primary"
                        >
                          Details
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
