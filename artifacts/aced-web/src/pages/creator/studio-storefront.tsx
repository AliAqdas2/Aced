import { useGetCreatorStorefront, useUpdateCreatorStorefront } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function StudioStorefront() {
  const { data: response, isLoading } = useGetCreatorStorefront();
  const updateMutation = useUpdateCreatorStorefront();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    policies: '',
  });

  useEffect(() => {
    if (response?.data) {
      const d = response.data as { displayName?: string; bio?: string; policies?: string };
      setFormData({
        displayName: d.displayName ?? '',
        bio: d.bio ?? '',
        policies: d.policies ?? '',
      });
    }
  }, [response]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast({ title: 'Storefront updated successfully' });
        },
        onError: () => {
          toast({ title: 'Failed to update storefront', variant: 'destructive' });
        }
      }
    );
  };

  if (isLoading) return <div className="p-8">Loading storefront data...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold font-serif">Storefront Editor</h1>
        <p className="text-muted-foreground">Customize how you appear to students.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input 
                value={formData.displayName} 
                onChange={(e) => setFormData({...formData, displayName: e.target.value})} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Bio / About Me</Label>
              <Textarea 
                rows={6}
                placeholder="Share your academic background, teaching style, and expertise..."
                value={formData.bio} 
                onChange={(e) => setFormData({...formData, bio: e.target.value})} 
              />
            </div>

            <div className="space-y-2">
              <Label>Policies & Rules</Label>
              <Textarea 
                rows={4}
                placeholder="E.g. Cancellation policies, response times, expectations..."
                value={formData.policies} 
                onChange={(e) => setFormData({...formData, policies: e.target.value})} 
              />
            </div>

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
