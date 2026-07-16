import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'wouter';
import { useSubmitCreatorApplication, useListUniversities, getGetMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

const applySchema = z.object({
  universityId: z.string().min(1, "Please select your university"),
  courseId: z.string().min(1, "Course ID is required"),
  graduationYear: z.coerce.number().min(2000).max(2030),
  academicResult: z.string().min(2, "Please specify your result"),
  headline: z.string().min(10, "Headline must be descriptive"),
  agreedToTerms: z.boolean().refine(val => val === true, "You must agree to the terms")
});

/** Reusable application form — used on both /apply and /become-a-creator */
export function CreatorApplicationForm() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: universities } = useListUniversities();

  const form = useForm<z.infer<typeof applySchema>>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      universityId: '',
      courseId: 'placeholder-course-id',
      graduationYear: new Date().getFullYear(),
      academicResult: '',
      headline: '',
      agreedToTerms: false,
    },
  });

  const applyMutation = useSubmitCreatorApplication({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation('/apply/status');
      }
    }
  });

  function onSubmit(values: z.infer<typeof applySchema>) {
    applyMutation.mutate({ data: values });
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-6 sm:p-10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">Academic Background</h3>

              <FormField
                control={form.control}
                name="universityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>University</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your university" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {universities?.data?.map(uni => (
                          <SelectItem key={uni.id} value={uni.id}>{uni.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="academicResult"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected / Achieved Grade</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="e.g. First Class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="First Class">First Class (1st)</SelectItem>
                          <SelectItem value="Upper Second Class">Upper Second (2:1)</SelectItem>
                          <SelectItem value="Distinction">Distinction (Masters)</SelectItem>
                          <SelectItem value="Merit">Merit (Masters)</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="graduationYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Graduation Year</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">Your Profile</h3>

              <FormField
                control={form.control}
                name="headline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Headline</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Final year Law student specializing in Contract Law" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">This will appear next to your name on your storefront.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">Verification</h3>
              <div className="p-4 border rounded-lg bg-muted/30 flex items-center justify-center text-sm text-muted-foreground h-24">
                Document upload coming soon — our team will contact you to verify credentials
              </div>
            </div>

            <FormField
              control={form.control}
              name="agreedToTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary mt-1"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>I agree to the Creator Terms</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      I confirm that the academic information provided is accurate and I understand that submitting false credentials will result in a permanent ban.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {applyMutation.isError && (
              <p className="text-sm text-destructive">Something went wrong. Please check your details and try again.</p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-lg font-bold"
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending ? "Submitting..." : "Submit Application"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/** Standalone /apply page — wraps the shared form with a header */
export default function Apply() {
  return (
    <div className="min-h-screen bg-muted/20 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl font-bold mb-4">Join as an Ace</h1>
          <p className="text-xl text-muted-foreground">Share your expertise and start earning on Aced.</p>
        </div>
        <CreatorApplicationForm />
      </div>
    </div>
  );
}

export function ApplyStatus() {
  return (
    <div className="min-h-screen bg-muted/20 flex flex-col items-center py-20 px-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-12 pb-12 px-6">
          <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/><path d="m9 14 2 2 4-4"/></svg>
          </div>
          <h1 className="text-3xl font-bold font-serif mb-4">Application Received</h1>
          <p className="text-muted-foreground mb-8">
            Thanks for applying to join as an Ace! Our team is reviewing your academic credentials. We aim to process all applications within 48 hours.
          </p>
          <div className="p-4 bg-muted rounded-lg mb-8 text-sm text-left">
            <div className="font-semibold mb-2">Next steps:</div>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>Wait for email confirmation</li>
              <li>Set up your Stripe account for payouts</li>
              <li>Create your storefront and first listing</li>
            </ol>
          </div>
          <Button size="lg" className="w-full" asChild>
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
