import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'wouter';
import { useLogin, getGetMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        // Refresh auth state globally
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        // Redirect to dashboard
        setLocation('/dashboard');
      }
    }
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values });
  }

  return (
    <div className="w-full">
      <h1 className="font-serif text-5xl tracking-tight mb-4">Welcome back</h1>
      <p className="text-muted-foreground mb-10 text-lg font-medium">Enter your details to access your account.</p>

      {loginMutation.isError && (
        <Alert variant="destructive" className="mb-6 rounded-xl border-destructive/50">
          <AlertDescription className="font-medium">Invalid email or password. Please try again.</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@university.ac.uk" type="email" className="h-14 rounded-xl px-4 bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background transition-all" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="font-bold">Password</FormLabel>
                  <Link href="/auth/forgot-password" className="text-sm font-bold text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <Input type="password" placeholder="••••••••" className="h-14 rounded-xl px-4 bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background transition-all" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button 
            type="submit" 
            className="w-full h-14 text-lg font-bold shadow-none rounded-xl mt-4 group" 
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
            {!loginMutation.isPending && <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
          </Button>
        </form>
      </Form>

      <div className="mt-12 text-center text-sm font-medium text-muted-foreground">
        Don't have an account?{' '}
        <Link href="/auth/register" className="font-bold text-primary hover:underline">
          Sign up
        </Link>
      </div>
    </div>
  );
}
