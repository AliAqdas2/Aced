import { Link } from 'wouter';
import logoUrl from '@assets/ACED_Logo_1784195174350.png';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-background">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 py-12">
        <div className="mx-auto w-full max-w-sm lg:w-[420px]">
          <div className="mb-12">
            <Link href="/" className="inline-block">
              <img src={logoUrl} alt="Aced Logo" className="h-16 w-auto object-contain" />
            </Link>
          </div>
          {children}
        </div>
      </div>
      <div className="hidden lg:block relative w-0 flex-1 bg-foreground overflow-hidden">
        <div className="absolute inset-0 bg-noise opacity-10"></div>
        <div className="absolute inset-0 pattern-grid opacity-20"></div>
        <div className="h-full w-full flex flex-col items-center justify-center p-20 relative z-10 text-center">
          <div className="text-background max-w-2xl space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary border border-primary/30 text-sm font-bold uppercase tracking-widest">
              Aced Marketplace
            </div>
            <h2 className="font-serif text-6xl xl:text-7xl tracking-tight leading-[0.9]">Learn.<br/><span className="text-primary italic">Achieve.</span><br/>Ace.</h2>
            <p className="text-xl text-background/70 font-medium max-w-lg mx-auto">
              Join the UK's premium academic marketplace. Connect with top finalists, access high-quality study materials, and elevate your university experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
