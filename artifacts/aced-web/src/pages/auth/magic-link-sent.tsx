import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export default function MagicLinkSent() {
  return (
    <div className="w-full text-center">
      <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-6" />
      <h1 className="font-serif text-3xl font-bold mb-4">Check your email</h1>
      <p className="text-muted-foreground mb-8">
        We've sent a secure link to your email address. Click the link to securely access your account.
      </p>
      <Button asChild variant="outline" className="w-full h-12">
        <Link href="/auth/login">Back to login</Link>
      </Button>
    </div>
  );
}
