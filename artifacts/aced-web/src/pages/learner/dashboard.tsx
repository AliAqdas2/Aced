import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useGetMyBookings, useGetMyLibrary } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, BookOpen, Clock, ArrowRight, User } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: bookingsResponse, isLoading: bookingsLoading } = useGetMyBookings();
  const { data: libraryResponse, isLoading: libraryLoading } = useGetMyLibrary();

  const upcomingBookings = bookingsResponse?.data?.filter((b: any) => 
    new Date(b.startAt) > new Date() && b.status !== 'cancelled'
  ).slice(0, 3) || [];

  const recentLibrary = libraryResponse?.data?.slice(0, 3) || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-serif mb-2">Welcome back, {(user?.profile as { displayName?: string } | null)?.displayName?.split(' ')[0] || 'Student'}</h1>
        <p className="text-muted-foreground">Here's what's happening with your studies today.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Bookings */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-lg font-bold flex items-center">
              <Calendar className="mr-2 h-5 w-5 text-primary" />
              Upcoming Sessions
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-8">
              <Link href="/bookings">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {bookingsLoading ? (
              <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
            ) : upcomingBookings.length > 0 ? (
              <div className="divide-y">
                {upcomingBookings.map((booking: any) => (
                  <div key={booking.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">{booking.listing?.title || 'Tutoring Session'}</h4>
                      <div className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded">
                        {format(new Date(booking.startAt), 'HH:mm')}
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground mb-4">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(booking.startAt), 'MMM d, yyyy')}
                      <span className="mx-2">•</span>
                      <User className="h-4 w-4 mr-1" />
                      {booking.creator?.displayName || 'Creator'}
                    </div>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      Join Call
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 opacity-20" />
                <p>No upcoming sessions booked.</p>
                <Button variant="link" className="mt-2" asChild>
                  <Link href="/search?type=service_offer">Find a tutor</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Library Items */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-lg font-bold flex items-center">
              <BookOpen className="mr-2 h-5 w-5 text-secondary" />
              Recent Materials
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-8">
              <Link href="/library">View library</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {libraryLoading ? (
              <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
            ) : recentLibrary.length > 0 ? (
              <div className="divide-y">
                {recentLibrary.map((item: any) => (
                  <div key={item.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-muted h-12 w-12 rounded-lg flex items-center justify-center shrink-0">
                        <BookOpen className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="font-semibold line-clamp-1">{item.listing?.title || 'Digital Product'}</h4>
                        <p className="text-sm text-muted-foreground flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          Acquired {format(new Date(item.createdAt), 'MMM d')}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0" asChild>
                      <Link href={`/library`}><ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mb-4 opacity-20" />
                <p>Your library is empty.</p>
                <Button variant="link" className="mt-2" asChild>
                  <Link href="/search?type=digital_product">Browse study materials</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
