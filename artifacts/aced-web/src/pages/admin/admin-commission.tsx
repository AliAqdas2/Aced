import { useGetCommissionRules } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Percent } from 'lucide-react';

export default function AdminCommission() {
  const { data: response, isLoading } = useGetCommissionRules();
  
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading commission rules...</div>;

  const rules = response?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-serif">Commission Rates</h1>
          <p className="text-muted-foreground">Configure platform fee structures.</p>
        </div>
        <Button>Add Rule</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Rules</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length > 0 ? (
            <div className="divide-y">
              {rules.map((rule: any) => (
                <div key={rule.id} className="p-6 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {(rule.rateBasisPoints / 100).toFixed(1)}%
                    </div>
                    <div>
                      <h4 className="font-bold capitalize">{rule.scope} Rate</h4>
                      <p className="text-sm text-muted-foreground">{rule.description || 'Standard platform fee'}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Edit</Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <Percent className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No commission rules defined.</p>
              <p className="text-sm">Platform default of 0% applies.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
