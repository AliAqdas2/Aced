import { useState } from 'react';
import {
  useGetCreatorListings,
  useCreateListing,
  getGetCreatorListingsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MoreHorizontal, Edit, Trash, FileText, Video, Users, User, Calendar, Clock } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';

const LISTING_TYPE_LABELS: Record<string, string> = {
  service_offer: 'Tutoring Session',
  group_session: 'Group Session',
  recorded_course: 'Recorded Course',
  digital_product: 'Digital Product',
};

const createListingSchema = z.object({
  type: z.enum(['service_offer', 'digital_product', 'recorded_course', 'group_session']),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description is too short'),
  isFree: z.boolean().default(false),
  priceAmount: z.coerce.number().min(0).default(0),
  // Service-offer specific
  durationMinutes: z.coerce.number().int().optional(),
  deliveryMode: z.enum(['online', 'in_person', 'hybrid']).optional(),
  minNoticeHours: z.coerce.number().int().optional(),
  bookingHorizonDays: z.coerce.number().int().optional(),
});

type FormValues = z.infer<typeof createListingSchema>;

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    published: 'bg-green-100 text-green-800',
    draft: 'bg-muted text-muted-foreground',
    submitted: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
    archived: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${variants[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'service_offer': return <User className="h-5 w-5" />;
    case 'group_session': return <Users className="h-5 w-5" />;
    case 'recorded_course': return <Video className="h-5 w-5" />;
    default: return <FileText className="h-5 w-5" />;
  }
}

export default function StudioListings() {
  const { data: response, isLoading } = useGetCreatorListings();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateListing({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCreatorListingsQueryKey() });
        setIsDialogOpen(false);
        form.reset();
        toast({ title: 'Listing created!' });
      },
      onError: () => {
        toast({ title: 'Failed to create listing', variant: 'destructive' });
      },
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      type: 'service_offer',
      title: '',
      description: '',
      isFree: false,
      priceAmount: 0,
      durationMinutes: 60,
      deliveryMode: 'online',
      minNoticeHours: 24,
      bookingHorizonDays: 60,
    },
  });

  const watchType = form.watch('type');
  const watchIsFree = form.watch('isFree');
  const isSession = watchType === 'service_offer' || watchType === 'group_session';

  function onSubmit(values: FormValues) {
    createMutation.mutate({
      data: {
        type: values.type,
        title: values.title,
        description: values.description,
        isFree: values.isFree,
        price: values.isFree
          ? undefined
          : { amountMinorUnits: Math.round(values.priceAmount * 100), currency: 'GBP' },
        ...(isSession && {
          serviceOffer: {
            durationMinutes: (values.durationMinutes ?? 60) as 30 | 45 | 60 | 90,
            deliveryMode: values.deliveryMode ?? 'online',
            minNoticeHours: values.minNoticeHours ?? 24,
            bookingHorizonDays: values.bookingHorizonDays ?? 60,
            cancellationHoursNotice: 24,
            bufferMinutesBefore: 0,
            bufferMinutesAfter: 0,
          },
        }),
      },
    });
  }

  const listings = (response?.data ?? []) as Array<{
    id: string; title: string; type: string; status: string;
    createdAt: string; purchaseCount: number; activePrice?: { amountMinorUnits: number } | null;
  }>;

  const filtered = listings.filter(
    (l) => !searchQuery || l.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif">Listings</h1>
          <p className="text-muted-foreground">Manage your tutoring offers and study materials.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              New listing
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Create listing</DialogTitle>
              <DialogDescription>Add a new offer to your storefront.</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
                {/* Type */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Listing type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="service_offer">
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4" /> Tutoring Session (1:1)
                            </span>
                          </SelectItem>
                          <SelectItem value="group_session">
                            <span className="flex items-center gap-2">
                              <Users className="h-4 w-4" /> Group Session
                            </span>
                          </SelectItem>
                          <SelectItem value="recorded_course">
                            <span className="flex items-center gap-2">
                              <Video className="h-4 w-4" /> Recorded Course
                            </span>
                          </SelectItem>
                          <SelectItem value="digital_product">
                            <span className="flex items-center gap-2">
                              <FileText className="h-4 w-4" /> Digital Product
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1:1 Econometrics Tutoring" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what students will get from this session…"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Session-specific fields */}
                {isSession && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Calendar className="h-4 w-4" />
                      Session settings
                    </div>

                    <FormField
                      control={form.control}
                      name="durationMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Session duration</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(Number(v))}
                            value={String(field.value ?? 60)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="45">45 minutes</SelectItem>
                              <SelectItem value="60">1 hour</SelectItem>
                              <SelectItem value="90">1.5 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="deliveryMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? 'online'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="online">Online (video call)</SelectItem>
                              <SelectItem value="in_person">In person</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="minNoticeHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Min. notice</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(Number(v))}
                              value={String(field.value ?? 24)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1">1 hour</SelectItem>
                                <SelectItem value="4">4 hours</SelectItem>
                                <SelectItem value="12">12 hours</SelectItem>
                                <SelectItem value="24">24 hours</SelectItem>
                                <SelectItem value="48">48 hours</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bookingHorizonDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Booking window</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(Number(v))}
                              value={String(field.value ?? 60)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="14">2 weeks</SelectItem>
                                <SelectItem value="30">1 month</SelectItem>
                                <SelectItem value="60">2 months</SelectItem>
                                <SelectItem value="90">3 months</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Pricing */}
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="isFree"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/20">
                        <div>
                          <FormLabel className="text-sm font-semibold">Free listing</FormLabel>
                          <FormDescription className="text-xs">
                            Students can access this at no cost
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {!watchIsFree && (
                    <FormField
                      control={form.control}
                      name="priceAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price (£)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                £
                              </span>
                              <Input
                                type="number"
                                min="0"
                                step="0.50"
                                placeholder="0.00"
                                className="pl-7"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating…' : 'Create listing'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search listings…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your listings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading…</div>
          ) : filtered.length > 0 ? (
            <div className="divide-y divide-border/50">
              {filtered.map((listing) => {
                const price = listing.activePrice;
                const isFree = !price || price.amountMinorUnits === 0;
                return (
                  <div
                    key={listing.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <TypeIcon type={listing.type} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{listing.title}</div>
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {LISTING_TYPE_LABELS[listing.type] ?? listing.type}
                          </span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                          <span className="text-xs text-muted-foreground">
                            Created {format(new Date(listing.createdAt), 'MMM d, yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                          <span className="text-xs text-muted-foreground">
                            {listing.purchaseCount ?? 0} sales
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={listing.status} />
                        <span className="font-semibold text-sm">
                          {isFree ? 'Free' : `£${((price?.amountMinorUnits ?? 0) / 100).toFixed(2)}`}
                        </span>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive">
                            <Trash className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold mb-1">No listings found</h3>
              <p className="text-muted-foreground mb-4 text-sm max-w-sm">
                {searchQuery
                  ? 'No listings match your search.'
                  : "You haven't created any listings yet."}
              </p>
              {!searchQuery && (
                <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                  Create your first listing
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
