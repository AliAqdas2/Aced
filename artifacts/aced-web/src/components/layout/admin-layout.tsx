import { Link, useLocation } from 'wouter';
import { 
  BarChart, 
  Users, 
  FileCheck, 
  AlertTriangle, 
  ShoppingBag, 
  Percent, 
  ShieldAlert,
  Home,
  GraduationCap,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';
import logoUrl from '@assets/ACED_Logo_1784195174350.png';

const adminNavItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: BarChart,
  },
  {
    title: 'Applications',
    href: '/admin/applications',
    icon: FileCheck,
  },
  {
    title: 'Listings',
    href: '/admin/listings',
    icon: ShoppingBag,
  },
  {
    title: 'Universities',
    href: '/admin/universities',
    icon: GraduationCap,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: 'Orders',
    href: '/admin/orders',
    icon: ShoppingBag,
  },
  {
    title: 'Reports',
    href: '/admin/reports',
    icon: AlertTriangle,
  },
  {
    title: 'Commission',
    href: '/admin/commission',
    icon: Percent,
  },
  {
    title: 'Audit Logs',
    href: '/admin/audit-logs',
    icon: ShieldAlert,
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation(`/auth/login?redirect=${encodeURIComponent(location)}`);
      }
      // Non-admin authenticated users: stay here and see the access-denied state below
    }
  }, [isLoading, isAuthenticated, isAdmin, location, setLocation]);

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // redirect in-flight
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background gap-4 text-center px-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-2xl font-bold font-serif">Admin access required</h1>
        <p className="text-muted-foreground max-w-sm">
          Your current account doesn't have admin privileges. Please sign in with the admin account.
        </p>
        <div className="flex gap-3 mt-2">
          <a href="/auth/login" className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-bold hover:bg-primary/90 transition-colors">
            Sign in as admin
          </a>
          <a href="/" className="inline-flex items-center justify-center rounded-xl border px-6 py-2.5 text-sm font-bold hover:bg-muted transition-colors">
            Go home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Sidebar */}
      <aside className="w-72 bg-foreground text-background flex-shrink-0 flex flex-col hidden md:flex border-r border-border/10">
        <div className="h-24 flex items-center px-8 border-b border-background/10">
          <Link href="/admin" className="flex items-center gap-3">
            <img src={logoUrl} alt="Aced" className="h-10 brightness-0 invert" />
            <span className="font-bold tracking-widest uppercase text-sm">Admin</span>
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto py-8 px-4">
          <nav className="flex flex-col space-y-2">
            {adminNavItems.map((item) => {
              const isActive = location === item.href || (location.startsWith(`${item.href}/`) && item.href !== '/admin');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-bold transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-background/60 hover:bg-background/10 hover:text-background"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-6 border-t border-background/10">
          <Link href="/" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-background/60 hover:bg-background/10 hover:text-background transition-colors">
            <Home className="h-5 w-5" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
        <main className="flex-1 overflow-y-auto p-8 md:p-12">
          {children}
        </main>
      </div>
    </div>
  );
}
