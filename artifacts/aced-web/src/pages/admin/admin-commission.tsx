import { useEffect, useState } from 'react';
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
import { CheckCircle, Percent } from 'lucide-react';

const commissionSchema = z.object({
  commissionRate: z.coerce.number().min(0, 'Must be 0 or more').max(100, 'Cannot exceed 100%'),
});

type CommissionForm = z.infer<typeof commissionSchema>;

export default function AdminCommission() {
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

  const form = useForm<CommissionForm>({
    resolver: zodResolver(commissionSchema),
    defaultValues: { commissionRate: 15 },
  });

  useEffect(() => {
    if (configData?.data) {
      form.reset({ commissionRate: config.commissionRate ?? 15 });
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

  function onSubmit(values: CommissionForm) {
    setSaved(false);
    updateMutation.mutate({
      data: {
        commissionRate: values.commissionRate,
      },
    });
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading commission…</div>;
  }

  const rate = form.watch('commissionRate');
  const examplePrice = 50;
  const exampleNet =
    typeof rate === 'number' && !Number.isNaN(rate)
      ? (examplePrice * (1 - rate / 100)).toFixed(2)
      : '—';

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold font-serif mb-1 flex items-center gap-3">
          <Percent className="h-7 w-7" />
          Commission Rates
        </h1>
        <p className="text-muted-foreground">
          Configure the platform fee. Applied on every Stripe payment and subscription as the platform fee.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                Platform commission rate
              </CardTitle>
              <CardDescription>
                Percentage Aced takes from each transaction. Creators receive the remainder. Changes apply to new
                orders and new subscription checkouts only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          %
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-sm text-muted-foreground">
                Example: on a £{examplePrice} session, platform fee is{' '}
                <span className="font-semibold text-foreground">
                  {typeof rate === 'number' && !Number.isNaN(rate) ? rate : '—'}%
                </span>
                ; creator receives{' '}
                <span className="font-semibold text-foreground">£{exampleNet}</span>.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center gap-4">
            <Button type="submit" size="lg" className="font-bold" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save commission'}
            </Button>
            {saved && (
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <CheckCircle className="h-4 w-4" />
                Saved
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
