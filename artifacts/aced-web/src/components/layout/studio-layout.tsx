import { Link, useLocation } from 'wouter';
import { Navbar } from './navbar';
import { Footer } from './footer';
import { 
  BarChart, 
  CalendarDays, 
  Clock, 
  FileText, 
  MessageSquare, 
  Settings,
  Store, 
  Users,
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
    title: 'Subscribers',
    href: '/studio/subscribers',
    icon: Users,
  },
  {
    title: 'Settings',
    href: '/studio/settings',
    icon: Settings,
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
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-muted/20">
      <Navbar />
      <div className="bg-foreground text-background py-10 relative overflow-hidden">
        <div className="absolute inset-0 pattern-grid opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-4xl md:text-5xl font-serif tracking-tight">Creator Studio</h1>
        </div>
      </div>
      <div className="container mx-auto flex-1 items-start md:grid md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] gap-8 lg:gap-12 pt-10 pb-16 px-4">
        <aside className="fixed top-[200px] z-30 -ml-2 hidden h-[calc(100vh-200px)] w-full shrink-0 md:sticky md:block">
          <div className="h-full py-2 pr-6">
            <nav className="flex flex-col space-y-2">
              {studioNavItems.map((item) => {
                const isActive = location === item.href || (location.startsWith(`${item.href}/`) && item.href !== '/studio');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-bold transition-all",
                      isActive 
                        ? "bg-foreground text-background shadow-lg shadow-foreground/5" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
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
