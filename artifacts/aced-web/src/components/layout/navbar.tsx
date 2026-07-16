import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { useLogout, getGetMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import logoUrl from '@assets/ACED_Logo_1784195174350.png';

export function Navbar() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isCreator, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation('/');
      }
    }
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get('q');
    if (q) {
      setLocation(`/search?q=${encodeURIComponent(q.toString())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-24 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center">
            <img src={logoUrl} alt="Aced Logo" className="h-24 w-auto object-contain" />
          </Link>
          <div className="hidden md:block flex-1 max-w-md">
            <form onSubmit={handleSearch} className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                name="q"
                type="search"
                placeholder="Search resources..."
                className="w-[280px] lg:w-[320px] bg-muted/50 pl-11 rounded-full border-transparent focus-visible:ring-2 focus-visible:ring-primary h-11 font-medium transition-all focus:bg-background"
              />
            </form>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6">
            <Link href="/search" className="text-sm font-bold tracking-tight hover:text-primary transition-colors">
              Explore
            </Link>
            {!isCreator && (
              <Link href="/become-a-creator" className="text-sm font-bold tracking-tight hover:text-primary transition-colors">
                Join as an Ace
              </Link>
            )}
          </div>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full h-11 w-11 border-border bg-background">
                  <User className="h-5 w-5" />
                  <span className="sr-only">Toggle user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 rounded-xl">
                <DropdownMenuLabel className="font-normal p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold leading-none">{(user?.profile as { displayName?: string } | null)?.displayName || user?.email}</p>
                    <p className="text-xs leading-none text-muted-foreground mt-1">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                
                {/* Learner Links */}
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <Link href="/dashboard" className="w-full flex items-center py-2 font-medium">
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <Link href="/library" className="w-full flex items-center py-2 font-medium">
                    My Library
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <Link href="/bookings" className="w-full flex items-center py-2 font-medium">
                    Bookings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <Link href="/messages" className="w-full flex items-center py-2 font-medium">
                    Messages
                  </Link>
                </DropdownMenuItem>

                {/* Creator Links */}
                {isCreator && (
                  <>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuLabel className="text-xs tracking-widest uppercase text-muted-foreground p-2">Creator Studio</DropdownMenuLabel>
                    <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                      <Link href="/studio" className="w-full flex items-center py-2 font-medium">
                        Overview
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                      <Link href="/studio/listings" className="w-full flex items-center py-2 font-medium">
                        Listings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                      <Link href="/studio/bookings" className="w-full flex items-center py-2 font-medium">
                        Manage Bookings
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                {/* Admin Links */}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                      <Link href="/admin" className="w-full flex items-center py-2 font-bold text-primary">
                        Admin Portal
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <Link href="/profile" className="w-full flex items-center py-2 font-medium">
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg py-2 font-medium mt-1" 
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild className="hidden sm:inline-flex rounded-full h-11 px-6 font-bold text-foreground">
                <Link href="/auth/login">Log in</Link>
              </Button>
              <Button asChild className="rounded-full h-11 px-6 font-bold shadow-none">
                <Link href="/auth/register">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
