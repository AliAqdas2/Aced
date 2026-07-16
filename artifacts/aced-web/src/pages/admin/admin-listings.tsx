import { useGetAdminListings } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminListings() {
  const { data: response, isLoading } = useGetAdminListings();
  
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading listings...</div>;

  const listings = response?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Listing Moderation</h1>
        <p className="text-muted-foreground">Manage and moderate marketplace listings.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {listings.length > 0 ? (
            <div className="divide-y">
              {listings.map((listing: any) => (
                <div key={listing.id} className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold">{listing.title}</h4>
                    <p className="text-sm text-muted-foreground">{listing.type} • {listing.status}</p>
                  </div>
                  <Button variant="outline" size="sm">Review</Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">No listings found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
