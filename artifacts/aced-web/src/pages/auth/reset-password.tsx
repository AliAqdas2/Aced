import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'wouter';
import { useConfirmPasswordReset } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';

const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token') || '';
  
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '' },
  });

  const resetMutation = useConfirmPasswordReset({
    mutation: {
      onSuccess: () => {
        setLocation('/auth/login?reset=success');
      }
    }
  });

  function onSubmit(values: z.infer<typeof resetSchema>) {
    resetMutation.mutate({ data: { token, password: values.password } });
  }

  if (!token) {
    return (
      <div className="w-full text-center">
        <h1 className="font-serif text-3xl font-bold mb-4">Invalid Link</h1>
        <p className="text-muted-foreground mb-8">This password reset link is invalid or has expired.</p>
        <Button asChild><Link href="/auth/forgot-password">Request new link</Link></Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="font-serif text-3xl font-bold mb-2">Set new password</h1>
      <p className="text-muted-foreground mb-8">Please enter your new password below.</p>

      {resetMutation.isError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>Failed to reset password. The link might have expired.</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
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
            {resetMutation.isPending ? "Updating..." : "Update password"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
