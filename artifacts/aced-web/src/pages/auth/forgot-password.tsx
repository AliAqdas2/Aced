import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'wouter';
import { useRequestPasswordReset } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';

const resetSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  });

  const resetMutation = useRequestPasswordReset({
    mutation: {
      onSuccess: () => {
        setLocation('/auth/magic-link-sent');
      }
    }
  });

  function onSubmit(values: z.infer<typeof resetSchema>) {
    resetMutation.mutate({ data: values });
  }

  return (
    <div className="w-full">
      <h1 className="font-serif text-3xl font-bold mb-2">Reset password</h1>
      <p className="text-muted-foreground mb-8">Enter your email address and we'll send you a link to reset your password.</p>

      {resetMutation.isError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>Failed to request password reset. Please try again.</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@university.ac.uk" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button 
            type="submit" 
            className="w-full h-12 text-base font-bold shadow-md" 
            disabled={resetMutation.isPending}
          >
            {resetMutation.isPending ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      </Form>

      <div className="mt-8 text-center text-sm">
        <Link href="/auth/login" className="font-semibold text-primary hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
