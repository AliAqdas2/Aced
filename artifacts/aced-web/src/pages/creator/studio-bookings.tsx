import { useGetCreatorBookings } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function StudioBookings() {
  const { data: response, isLoading } = useGetCreatorBookings();
  
  if (isLoading) return <div className="p-8">Loading bookings...</div>;
  
  const bookings = response?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Manage Bookings</h1>
        <p className="text-muted-foreground">View and manage your upcoming student sessions.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {bookings.length > 0 ? (
            <div className="divide-y">
              {bookings.map((booking: any) => (
                <div key={booking.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{booking.listing?.title || 'Session'}</h3>
                      <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-bold uppercase">
                        {booking.status}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(booking.startAt), 'MMM d, yyyy • HH:mm')}
                    </div>
                    <div className="text-sm mt-1">
                      Student: {booking.user?.displayName || 'Unknown Student'}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="outline" className="flex-1 md:flex-none">Message</Button>
                    <Button className="flex-1 md:flex-none">Join Call</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>You don't have any bookings yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
