import { useGetAvailabilityRules, useCreateAvailabilityRule } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function StudioAvailability() {
  const { data: response, isLoading } = useGetAvailabilityRules();
  
  if (isLoading) return <div className="p-8">Loading availability...</div>;
  
  const rules = response?.data || [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-serif">Availability Rules</h1>
          <p className="text-muted-foreground">Set your weekly recurring schedule for 1:1 sessions.</p>
        </div>
        <Button>Add Rule</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length > 0 ? (
            <div className="divide-y">
              {rules.map((rule: any, i: number) => (
                <div key={i} className="py-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium">Day {rule.dayOfWeek}</div>
                    <div className="text-sm text-muted-foreground">{rule.startTimeUtc} - {rule.endTimeUtc} UTC</div>
                  </div>
                  <Button variant="outline" size="sm">Remove</Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>You haven't set any availability rules yet.</p>
              <p className="text-sm mt-1">Students won't be able to book sessions until you set your schedule.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
