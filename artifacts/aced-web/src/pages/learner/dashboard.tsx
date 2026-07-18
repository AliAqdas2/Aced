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
    new Date(b.scheduledStartAt) > new Date() && b.status !== 'cancelled'
  ).slice(0, 3) || [];

  const recentLibrary = libraryResponse?.data?.slice(0, 3) || [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl md:text-5xl tracking-tight font-serif mb-3">Welcome back, {(user?.profile as { displayName?: string } | null)?.displayName?.split(' ')[0] || 'Student'}</h1>
        <p className="text-muted-foreground font-medium text-lg">Here's what's happening with your studies today.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Upcoming Bookings */}
        <Card className="flex flex-col border-border/50 shadow-sm rounded-2xl bg-background">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50 p-6">
            <CardTitle className="text-xl font-bold flex items-center">
              <Calendar className="mr-3 h-6 w-6 text-primary" />
              Upcoming Sessions
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-9 font-bold rounded-lg px-4">
              <Link href="/bookings">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {bookingsLoading ? (
              <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : upcomingBookings.length > 0 ? (
              <div className="divide-y divide-border/50">
                {upcomingBookings.map((booking: any) => (
                  <div key={booking.id} className="p-6 hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-lg">{booking.listingTitle || 'Tutoring Session'}</h4>
                      <div className="bg-primary/10 text-primary text-sm font-bold px-3 py-1 rounded-lg">
                        {format(new Date(booking.scheduledStartAt), 'HH:mm')}
                      </div>
                    </div>
                    <div className="flex items-center text-sm font-medium text-muted-foreground mb-5">
                      <Calendar className="h-4 w-4 mr-2" />
                      {format(new Date(booking.scheduledStartAt), 'MMM d, yyyy')}
                      <span className="mx-3 opacity-50">•</span>
                      <User className="h-4 w-4 mr-2" />
                      {booking.creatorDisplayName || 'Creator'}
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto font-bold rounded-xl h-11 border-border shadow-none">
                      Join Call
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Calendar className="h-16 w-16 mb-6 opacity-20" />
                <p className="font-medium text-lg mb-4">No upcoming sessions booked.</p>
                <Button className="rounded-xl font-bold h-12 px-6" asChild>
                  <Link href="/search?type=service_offer">Find a tutor</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Library Items */}
        <Card className="flex flex-col border-border/50 shadow-sm rounded-2xl bg-background">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50 p-6">
            <CardTitle className="text-xl font-bold flex items-center">
              <BookOpen className="mr-3 h-6 w-6 text-primary" />
              Recent Materials
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-9 font-bold rounded-lg px-4">
              <Link href="/library">View library</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {libraryLoading ? (
              <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : recentLibrary.length > 0 ? (
              <div className="divide-y divide-border/50">
                {recentLibrary.map((item: any) => (
                  <div key={item.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-5">
                      <div className="bg-muted h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 border border-border/50 shadow-sm">
                        <BookOpen className="h-8 w-8 text-primary/50" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg line-clamp-1 mb-1">{item.listing?.title || 'Digital Product'}</h4>
                        <p className="text-sm font-medium text-muted-foreground flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          Acquired {format(new Date(item.createdAt), 'MMM d')}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10 rounded-full hover:bg-primary/10 hover:text-primary" asChild>
                      <Link href={`/library`}><ArrowRight className="h-5 w-5" /></Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <BookOpen className="h-16 w-16 mb-6 opacity-20" />
                <p className="font-medium text-lg mb-4">Your library is empty.</p>
                <Button className="rounded-xl font-bold h-12 px-6" asChild>
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
