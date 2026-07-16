import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  
  // In a real app we would call a mutation to verify the token here
  // For the MVP, we just redirect if authenticated, or to login if not
  
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        setLocation('/dashboard');
      } else {
        setLocation('/auth/login?verified=true');
      }
    }
  }, [isLoading, isAuthenticated, setLocation]);

  return (
    <div className="w-full text-center">
      <h1 className="font-serif text-2xl font-bold mb-4">Verifying your email...</h1>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
    </div>
  );
}
