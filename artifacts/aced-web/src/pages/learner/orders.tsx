import { useGetMyOrders } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';

export default function Orders() {
  const { data: response, isLoading } = useGetMyOrders();

  const orders = response?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Order History</h1>
        <p className="text-muted-foreground">View your past purchases and receipts.</p>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading orders...</div>
      ) : orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <Card key={order.id}>
              <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="font-semibold text-lg mb-1">Order #{order.id.slice(0, 8).toUpperCase()}</div>
                  <div className="text-sm text-muted-foreground">
                    Placed on {format(new Date(order.createdAt), 'MMMM d, yyyy')}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-bold text-lg">£{(order.totalMinorUnits / 100).toFixed(2)}</div>
                    <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded uppercase font-bold inline-block mt-1">
                      {order.status}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold mb-2">No orders found</h3>
            <p className="text-muted-foreground max-w-sm">You haven't made any purchases yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
