import { useGetAdminApplications } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { CheckCircle, XCircle } from 'lucide-react';

export default function AdminApplications() {
  const { data: response, isLoading } = useGetAdminApplications({ status: 'pending' });
  
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading applications...</div>;

  const applications = response?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Creator Applications</h1>
        <p className="text-muted-foreground">Review and approve pending creator applications.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {applications.length > 0 ? (
            <div className="divide-y">
              {applications.map((app: any) => (
                <div key={app.id} className="p-6">
                  <div className="flex flex-col lg:flex-row justify-between gap-6">
                    <div>
                      <h3 className="text-xl font-bold mb-2">{app.user?.displayName}</h3>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
                        <div className="text-muted-foreground">University:</div>
                        <div className="font-medium">{app.university?.name}</div>
                        
                        <div className="text-muted-foreground">Course:</div>
                        <div className="font-medium">{app.course?.name}</div>
                        
                        <div className="text-muted-foreground">Graduation:</div>
                        <div className="font-medium">{app.graduationYear}</div>
                        
                        <div className="text-muted-foreground">Result:</div>
                        <div className="font-medium">{app.academicResult}</div>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <span className="font-semibold text-sm block mb-1">Headline:</span>
                        <p className="text-sm italic">"{app.headline}"</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-row lg:flex-col gap-2 shrink-0">
                      <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle className="mr-2 h-4 w-4" /> Approve
                      </Button>
                      <Button variant="destructive" className="flex-1">
                        <XCircle className="mr-2 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-lg font-medium text-foreground">Zero Inbox!</p>
              <p>There are no pending creator applications.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
