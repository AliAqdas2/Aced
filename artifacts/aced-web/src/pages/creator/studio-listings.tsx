import { useState } from 'react';
import { useGetCreatorListings, useCreateListing, getGetCreatorListingsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, MoreHorizontal, Edit, Trash, FileText, Video, Users, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const createListingSchema = z.object({
  type: z.enum(['service_offer', 'digital_product', 'recorded_course', 'group_session']),
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description is too short"),
  priceAmount: z.coerce.number().min(0, "Price cannot be negative"),
});

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
        toast({ title: "Listing created successfully!" });
      },
      onError: () => {
        toast({ 
          title: "Failed to create listing",
          description: "Please check your details and try again.",
          variant: "destructive"
        });
      }
    }
  });

  const form = useForm<z.infer<typeof createListingSchema>>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      type: 'service_offer',
      title: '',
      description: '',
      priceAmount: 0,
    },
  });

  function onSubmit(values: z.infer<typeof createListingSchema>) {
    createMutation.mutate({
      data: {
        type: values.type,
        title: values.title,
        description: values.description,
        price: {
          amountMinorUnits: Math.round(values.priceAmount * 100), // convert to pence
          currency: 'GBP'
        }
      }
    });
  }

  const listings = response?.data || [];
  
  const filteredListings = listings.filter((item: any) => 
    !searchQuery || 
    item.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'service_offer': return <User className="h-5 w-5" />;
      case 'group_session': return <Users className="h-5 w-5" />;
      case 'recorded_course': return <Video className="h-5 w-5" />;
      case 'digital_product': default: return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif">Listings</h1>
          <p className="text-muted-foreground">Manage your tutoring offers and study materials.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Listing
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Listing</DialogTitle>
              <DialogDescription>
                Add a new offering to your storefront. You can edit details later.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="service_offer">1:1 Tutoring Session</SelectItem>
                          <SelectItem value="digital_product">Digital Product / Notes</SelectItem>
                          <SelectItem value="group_session">Group Session</SelectItem>
                          <SelectItem value="recorded_course">Recorded Course</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Constitutional Law Revision Notes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="priceAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (£)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="25.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <textarea 
                          className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Describe what students will get..."
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Listing"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search listings..." 
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading listings...</div>
          ) : filteredListings.length > 0 ? (
            <div className="divide-y">
              {filteredListings.map((listing: any) => (
                <div key={listing.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:bg-muted/30 transition-colors">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
                    {getTypeIcon(listing.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{listing.title}</h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary/10 text-primary whitespace-nowrap">
                        {listing.status}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center flex-wrap gap-x-4 gap-y-1">
                      <span>{listing.type.replace('_', ' ')}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Created {format(new Date(listing.createdAt), 'MMM d, yyyy')}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{listing.purchaseCount || 0} sales</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
                    <div className="font-semibold">
                      {/* Note: In a real app we'd fetch the active price, but using a placeholder or default if not returned in summary */}
                      £--.--
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
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
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold mb-1">No listings found</h3>
              <p className="text-muted-foreground mb-4 text-sm max-w-sm">
                You haven't created any listings yet, or none match your search.
              </p>
              <Button variant="outline" onClick={() => setIsDialogOpen(true)}>Create your first listing</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
