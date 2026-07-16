import { Link, useLocation } from 'wouter';
import { Navbar } from './navbar';
import { Footer } from './footer';
import { 
  BarChart, 
  CalendarDays, 
  Clock, 
  FileText, 
  MessageSquare, 
  Store, 
  Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';

const studioNavItems = [
  {
    title: 'Overview',
    href: '/studio',
    icon: BarChart,
  },
  {
    title: 'Storefront',
    href: '/studio/storefront',
    icon: Store,
  },
  {
    title: 'Listings',
    href: '/studio/listings',
    icon: FileText,
  },
  {
    title: 'Availability',
    href: '/studio/availability',
    icon: Clock,
  },
  {
    title: 'Bookings',
    href: '/studio/bookings',
    icon: CalendarDays,
  },
  {
    title: 'Earnings',
    href: '/studio/earnings',
    icon: Wallet,
  },
  {
    title: 'Messages',
    href: '/studio/messages',
    icon: MessageSquare,
  },
];

export function StudioLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isCreator, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation('/auth/login');
      } else if (!isCreator) {
        setLocation('/dashboard');
      }
    }
  }, [isLoading, isAuthenticated, isCreator, setLocation]);

  if (isLoading || !isAuthenticated || !isCreator) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-muted/20">
      <Navbar />
      <div className="bg-[#0F1A3C] text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-serif font-bold">Creator Studio</h1>
        </div>
      </div>
      <div className="container mx-auto flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)] gap-6 lg:gap-10 pt-8 pb-12 px-4">
        <aside className="fixed top-[120px] z-30 -ml-2 hidden h-[calc(100vh-120px)] w-full shrink-0 md:sticky md:block">
          <div className="h-full py-2 pr-6 lg:py-4">
            <nav className="flex flex-col space-y-1">
              {studioNavItems.map((item) => {
                const isActive = location === item.href || (location.startsWith(`${item.href}/`) && item.href !== '/studio');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <main className="flex w-full flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
