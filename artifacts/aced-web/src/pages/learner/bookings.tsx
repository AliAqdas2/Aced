import { useGetMyBookings } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Video, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function Bookings() {
  const { data: response, isLoading } = useGetMyBookings();

  const bookings = response?.data || [];
  
  const upcomingBookings = bookings.filter((b: any) => new Date(b.startAt) > new Date() && b.status !== 'cancelled');
  const pastBookings = bookings.filter((b: any) => new Date(b.startAt) <= new Date() || b.status === 'cancelled');

  if (isLoading) {
    return <div className="p-8 text-center">Loading bookings...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-serif">My Bookings</h1>
        <p className="text-muted-foreground">Manage your 1:1 sessions and group classes.</p>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold">Upcoming Sessions</h2>
        {upcomingBookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingBookings.map((booking: any) => (
              <Card key={booking.id} className="hover-elevate">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded">
                      {format(new Date(booking.startAt), 'MMM d, yyyy')}
                    </div>
                    <div className="bg-muted text-foreground text-xs font-bold px-2 py-1 rounded">
                      {format(new Date(booking.startAt), 'HH:mm')}
                    </div>
                  </div>
                  <CardTitle className="text-lg line-clamp-1">{booking.listing?.title || 'Session'}</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-sm text-muted-foreground mb-4">With {booking.creator?.displayName || 'Creator'}</p>
                  <Button className="w-full">
                    <Video className="mr-2 h-4 w-4" /> Join Call
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold mb-2">No upcoming sessions</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">You don't have any upcoming bookings.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold">Past Sessions</h2>
        {pastBookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pastBookings.map((booking: any) => (
              <Card key={booking.id} className="opacity-75">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="bg-muted text-muted-foreground text-xs font-bold px-2 py-1 rounded">
                      {format(new Date(booking.startAt), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <CardTitle className="text-lg line-clamp-1">{booking.listing?.title || 'Session'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">With {booking.creator?.displayName || 'Creator'}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground italic">No past sessions.</p>
        )}
      </div>
    </div>
  );
}
