import { Link, useLocation } from 'wouter';
import { 
  BarChart, 
  Users, 
  FileCheck, 
  AlertTriangle, 
  ShoppingBag, 
  Percent, 
  ShieldAlert,
  Home
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
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation('/auth/login');
      } else if (!isAdmin) {
        setLocation('/');
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, setLocation]);

  if (isLoading || !isAuthenticated || !isAdmin) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0F1A3C] text-white flex-shrink-0 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-2">
            <img src={logoUrl} alt="Aced" className="h-8 brightness-0 invert" />
            <span className="font-bold tracking-wider text-lg">ADMIN</span>
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4">
          <nav className="flex flex-col space-y-1">
            {adminNavItems.map((item) => {
              const isActive = location === item.href || (location.startsWith(`${item.href}/`) && item.href !== '/admin');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-white/10 text-white" 
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white transition-colors">
            <Home className="h-4 w-4" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-background">
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
