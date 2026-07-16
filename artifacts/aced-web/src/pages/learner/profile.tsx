import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold font-serif">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input defaultValue={(user?.profile as { displayName?: string } | null)?.displayName ?? ''} />
          </div>
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input defaultValue={user?.email || ''} disabled />
            <p className="text-xs text-muted-foreground">Email addresses cannot be changed directly.</p>
          </div>
          <Button className="mt-4">Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input defaultValue={user?.timezone || 'Europe/London'} />
          </div>
          <Button className="mt-4">Update Preferences</Button>
        </CardContent>
      </Card>
    </div>
  );
}
