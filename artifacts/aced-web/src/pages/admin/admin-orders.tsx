import { useState } from 'react';
import { useGetAdminOrders } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, X } from 'lucide-react';

export default function AdminOrders() {
  const { data: response, isLoading } = useGetAdminOrders();

  const [showPicker, setShowPicker] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading orders...</div>;

  const orders = response?.data || [];

  const handleExport = () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    const url = `/api/v1/admin/orders/export${qs ? `?${qs}` : ''}`;

    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowPicker(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif">Orders</h1>
          <p className="text-muted-foreground">View all marketplace transactions.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowPicker((v) => !v)}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </Button>
      </div>

      {showPicker && (
        <Card className="border-dashed">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Choose a date range for the export</p>
                <button
                  onClick={() => setShowPicker(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="export-from">From</Label>
                  <Input
                    id="export-from"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-44"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="export-to">To</Label>
                  <Input
                    id="export-to"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-44"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleExport} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {from || to ? 'Export filtered range' : 'Export all time'}
                </Button>
                {(from || to) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setFrom(''); setTo(''); }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
