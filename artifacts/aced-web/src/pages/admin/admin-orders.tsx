import { useGetAdminOrders } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminOrders() {
  const { data: response, isLoading } = useGetAdminOrders();
  
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading orders...</div>;

  const orders = response?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Orders</h1>
        <p className="text-muted-foreground">View all marketplace transactions.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {orders.length > 0 ? (
            <div className="divide-y">
              {orders.map((order: any) => (
                <div key={order.id} className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold">Order #{order.id.slice(0, 8)}</h4>
                    <p className="text-sm text-muted-foreground">Status: {order.status}</p>
                  </div>
                  <div className="font-bold">
                    £{(order.totalMinorUnits / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">No orders found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
