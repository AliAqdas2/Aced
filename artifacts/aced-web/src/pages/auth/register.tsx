import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'wouter';
import { useRegister, getMe, getGetMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';

const registerSchema = z
  .object({
    displayName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const inputClass =
  'h-14 rounded-xl px-4 bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background transition-all';

export default function Register() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: async () => {
        await queryClient.fetchQuery({
          queryKey: getGetMeQueryKey(),
          queryFn: ({ signal }) => getMe({ signal }),
        });
        setLocation('/dashboard');
      },
    },
  });

  // Distinguish between "email already taken" (409) and any other failure
  const regError = registerMutation.error as { status?: number } | null;
  const isEmailTaken = regError?.status === 409;

  function onSubmit(values: RegisterForm) {
    registerMutation.mutate({ data: { displayName: values.displayName, email: values.email, password: values.password } });
  }

  return (
    <div className="w-full">
      <h1 className="font-serif text-5xl tracking-tight mb-4">Create an account</h1>
      <p className="text-muted-foreground mb-10 text-lg font-medium">
        Join the UK's premium student marketplace.
      </p>

      {registerMutation.isError && (
        <Alert variant="destructive" className="mb-6 rounded-xl border-destructive/50">
          <AlertDescription className="font-medium">
            {isEmailTaken ? (
              <>
                This email is already registered.{' '}
                <Link href="/auth/login" className="underline font-bold hover:opacity-80">
                  Sign in instead
                </Link>
                {' '}or{' '}
                <Link href="/auth/forgot-password" className="underline font-bold hover:opacity-80">
                  reset your password
                </Link>
                .
              </>
            ) : (
              'Registration failed. Please check your details and try again.'
            )}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" className={inputClass} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="you@example.com"
                    type="email"
                    className={inputClass}
                    {...field}
                  />
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
                <FormLabel className="font-bold">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`${inputClass} pr-12`}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Confirm Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`${inputClass} pr-12`}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold shadow-none rounded-xl mt-4 group"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? 'Creating account…' : 'Sign up'}
            {!registerMutation.isPending && (
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            )}
          </Button>
        </form>
      </Form>

      <p className="text-sm font-medium text-center text-muted-foreground mt-8 px-4">
        By signing up, you agree to our{' '}
        <Link href="/terms" className="underline hover:text-primary font-bold">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:text-primary font-bold">
          Privacy Policy
        </Link>
        .
      </p>

      <div className="mt-8 text-center text-sm font-medium text-muted-foreground">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-bold text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
