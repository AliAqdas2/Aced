import { Link, useLocation } from 'wouter';
import { Navbar } from './navbar';
import { Footer } from './footer';
import { 
  BookOpen, 
  Calendar, 
  LayoutDashboard, 
  MessageSquare, 
  Settings, 
  ShoppingBag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';

const sidebarNavItems = [
  {
    title: 'My learning',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'My Bookings',
    href: '/bookings',
    icon: Calendar,
  },
  {
    title: 'My Library',
    href: '/library',
    icon: BookOpen,
  },
  {
    title: 'Messages',
    href: '/messages',
    icon: MessageSquare,
  },
  {
    title: 'Orders',
    href: '/orders',
    icon: ShoppingBag,
  },
  {
    title: 'Settings',
    href: '/profile',
    icon: Settings,
  },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/auth/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-muted/20">
      <Navbar />
      <div className="container mx-auto flex-1 items-start md:grid md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] gap-8 lg:gap-12 pt-10 pb-16 px-4">
        <aside className="fixed top-28 z-30 -ml-2 hidden h-[calc(100vh-7rem)] w-full shrink-0 md:sticky md:block">
          <div className="h-full py-2 pr-6">
            <nav className="flex flex-col space-y-2">
              {sidebarNavItems.map((item) => {
                const isActive = location === item.href || location.startsWith(`${item.href}/`);
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
