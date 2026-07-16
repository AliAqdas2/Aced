import { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useGetAdminConfig,
  useUpdateAdminConfig,
  getGetAdminConfigQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CheckCircle, Settings, Mail, Shield, Percent } from 'lucide-react';
import { useState } from 'react';

const settingsSchema = z.object({
  approvalEmail: z.string().email('Must be a valid email address'),
  dbsRequired: z.boolean(),
  commissionRate: z.coerce.number().min(0, 'Must be 0 or more').max(100, 'Cannot exceed 100%'),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const { data: configData, isLoading } = useGetAdminConfig({
    query: { queryKey: getGetAdminConfigQueryKey() },
  });

  const config = (configData?.data ?? {}) as {
    approvalEmail?: string;
    dbsRequired?: boolean;
    commissionRate?: number;
  };

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      approvalEmail: 'AcedApprovals@creativecloud.ai',
      dbsRequired: false,
      commissionRate: 15,
    },
  });

  // Populate form once config loads
  useEffect(() => {
    if (configData?.data) {
      form.reset({
        approvalEmail: config.approvalEmail ?? 'AcedApprovals@creativecloud.ai',
        dbsRequired: config.dbsRequired ?? false,
        commissionRate: config.commissionRate ?? 15,
      });
    }
  }, [configData]);

  const updateMutation = useUpdateAdminConfig({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminConfigQueryKey() });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    },
  });

  function onSubmit(values: SettingsForm) {
    setSaved(false);
    updateMutation.mutate({ data: values });
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold font-serif mb-1 flex items-center gap-3">
          <Settings className="h-7 w-7" />
          Platform Settings
        </h1>
        <p className="text-muted-foreground">Configure global behaviour for the Aced marketplace.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Approval Email */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Application Approval Email
              </CardTitle>
              <CardDescription>
                New creator applications send a notification to this address for review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="approvalEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="AcedApprovals@creativecloud.ai" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* DBS Required */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                DBS Check Requirement
              </CardTitle>
              <CardDescription>
                When enabled, creators must upload a DBS check document to complete their application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="dbsRequired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Require DBS check</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Currently: <span className="font-semibold">{field.value ? 'Mandatory' : 'Optional'}</span>
                      </p>
                    </div>
                    <FormControl>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={field.value}
                        onClick={() => field.onChange(!field.value)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                          field.value ? 'bg-primary' : 'bg-input'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                            field.value ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Commission Rate */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                Platform Commission Rate
              </CardTitle>
              <CardDescription>
                The percentage Aced charges on each transaction. Default: 15%. Changes apply to new orders only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="commissionRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission rate (%)</FormLabel>
                    <FormControl>
                      <div className="relative max-w-xs">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          {...field}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex items-center gap-4">
            <Button
              type="submit"
              size="lg"
              className="font-bold"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Settings'}
            </Button>

            {saved && (
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <CheckCircle className="h-4 w-4" />
                Settings saved
              </div>
            )}

            {updateMutation.isError && (
              <p className="text-sm text-destructive">Failed to save. Please try again.</p>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
