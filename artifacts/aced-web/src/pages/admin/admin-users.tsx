import { useGetAdminUsers } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminUsers() {
  const { data: response, isLoading } = useGetAdminUsers();
  
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading users...</div>;

  const users = response?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Users</h1>
        <p className="text-muted-foreground">Manage platform users and roles.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {users.length > 0 ? (
            <div className="divide-y">
              {users.map((user: any) => (
                <div key={user.id} className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold">{user.email}</h4>
                    <p className="text-sm text-muted-foreground">Role: {user.role}</p>
                  </div>
                  <div className="text-xs px-2 py-1 bg-muted rounded uppercase font-bold">
                    {user.status || 'Active'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">No users found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
