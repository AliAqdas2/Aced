import { useState } from 'react';
import { useGetAdminOrders } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Download, X } from 'lucide-react';

export default function AdminOrders() {
  const { data: response, isLoading } = useGetAdminOrders();

  const [showPicker, setShowPicker] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [exporting, setExporting] = useState(false);
  const [truncationWarning, setTruncationWarning] = useState<{ rowCount: number } | null>(null);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading orders...</div>;

  const orders = response?.data || [];

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (creatorId.trim()) params.set('creatorId', creatorId.trim());
    if (buyerEmail.trim()) params.set('buyerEmail', buyerEmail.trim());
    const qs = params.toString();
    const url = `/api/v1/admin/orders/export${qs ? `?${qs}` : ''}`;

    setExporting(true);
    setTruncationWarning(null);
    try {
      const fetchResponse = await fetch(url, { credentials: 'include' });
      if (!fetchResponse.ok) {
        const text = await fetchResponse.text();
        alert(`Export failed: ${text}`);
        return;
      }

      const wasTruncated = fetchResponse.headers.get('X-Export-Truncated') === 'true';
      const rowCount = parseInt(fetchResponse.headers.get('X-Export-Row-Count') ?? '0', 10);

      const blob = await fetchResponse.blob();
      const disposition = fetchResponse.headers.get('Content-Disposition') ?? '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'aced-transactions.csv';

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      if (wasTruncated) {
        setTruncationWarning({ rowCount });
      }

      setShowPicker(false);
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = from || to || creatorId.trim() || buyerEmail.trim();

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

      {truncationWarning && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <div>
            <span className="font-semibold">Export capped at {truncationWarning.rowCount.toLocaleString()} rows.</span>{' '}
            Your date range contains more transactions than this limit. Narrow the date range or add a creator / buyer filter to export the full data.
          </div>
          <button
            onClick={() => setTruncationWarning(null)}
            className="ml-auto text-amber-600 hover:text-amber-800"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="export-creator">Creator ID</Label>
                  <Input
                    id="export-creator"
                    type="text"
                    value={creatorId}
                    onChange={(e) => setCreatorId(e.target.value)}
                    placeholder="Exact creator user ID"
                    className="w-64"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="export-buyer">Buyer Email</Label>
                  <Input
                    id="export-buyer"
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="buyer@example.com"
                    className="w-64"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleExport} disabled={exporting} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {exporting ? 'Exporting…' : hasFilters ? 'Export filtered' : 'Export all time'}
                </Button>
                {hasFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setFrom(''); setTo(''); setCreatorId(''); setBuyerEmail(''); }}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Order</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Creator</th>
                    <th className="px-4 py-3 text-left font-medium">Listing</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order: any) => (
                    <tr key={`${order.orderId}-${order.creatorId}`} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        #{order.orderId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {order.creatorName ? (
                          <span className="font-medium">{order.creatorName}</span>
                        ) : (
                          <span className="text-muted-foreground font-mono text-xs">
                            {order.creatorId?.slice(0, 8) ?? '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate" title={order.listingTitle}>
                        {order.listingTitle ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            order.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : order.status === 'refunded'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                        £{((order.totalMinorUnits ?? order.unitAmountMinorUnits ?? 0) / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">No orders found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
