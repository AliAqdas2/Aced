import { Link } from 'wouter';
import logoUrl from '@assets/ACED_Logo_1784195174350.png';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-muted/30">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="mb-8">
            <Link href="/" className="inline-block">
              <img src={logoUrl} alt="Aced Logo" className="h-10 w-auto object-contain" />
            </Link>
          </div>
          {children}
        </div>
      </div>
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-primary-gradient">
          <div className="absolute inset-0 bg-[#0F1A3C]/40 mix-blend-multiply" />
          <div className="h-full w-full flex items-center justify-center p-12">
            <div className="text-white max-w-lg space-y-6">
              <h2 className="font-serif text-5xl font-bold tracking-tight">Learn. Achieve. Ace.</h2>
              <p className="text-lg text-white/90">
                Join the UK's premium academic marketplace. Connect with top finalists, access high-quality study materials, and elevate your university experience.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
