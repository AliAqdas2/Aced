import { useState, useRef, useEffect } from 'react';
import { useGetAdminOrders } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Download, X, Check, Filter } from 'lucide-react';

interface CreatorSuggestion {
  id: string;
  displayName: string | null;
  email: string;
}

function CreatorTypeahead({
  creatorId,
  onChange,
  inputId,
}: {
  creatorId: string;
  onChange: (id: string, label: string) => void;
  inputId?: string;
}) {
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState('');
  const [suggestions, setSuggestions] = useState<CreatorSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    setLabel(value);
    // Clear the committed creatorId if user edits the text
    if (creatorId) onChange('', '');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/admin/creators/search?q=${encodeURIComponent(value.trim())}`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const json = await res.json();
          setSuggestions(json.data ?? []);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const select = (s: CreatorSuggestion) => {
    const name = s.displayName ?? s.email;
    setQuery(name);
    setLabel(name);
    setSuggestions([]);
    setOpen(false);
    onChange(s.id, name);
  };

  const clear = () => {
    setQuery('');
    setLabel('');
    setSuggestions([]);
    setOpen(false);
    onChange('', '');
  };

  return (
    <div ref={containerRef} className="relative w-64">
      <div className="relative">
        <Input
          id={inputId}
          type="text"
          value={label}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="Search creator name…"
          autoComplete="off"
          className="w-full pr-8"
        />
        {(label || creatorId) && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear creator filter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md text-sm max-h-56 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                onMouseDown={() => select(s)}
              >
                {creatorId === s.id && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                <span className="truncate font-medium">{s.displayName ?? s.email}</span>
                {s.displayName && (
                  <span className="ml-auto truncate text-xs text-muted-foreground">{s.email}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && suggestions.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md px-3 py-2 text-sm text-muted-foreground">
          No creators found
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 50;

export default function AdminOrders() {
  // Live table filters
  const [filterCreatorId, setFilterCreatorId] = useState('');
  const [filterBuyerEmail, setFilterBuyerEmail] = useState('');
  const [filterBuyerEmailInput, setFilterBuyerEmailInput] = useState('');
  const [appliedBuyerEmail, setAppliedBuyerEmail] = useState('');

  // Pagination state
  const [offset, setOffset] = useState(0);
  const [accumulatedOrders, setAccumulatedOrders] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Build params for the live query — only send buyerEmail when user has committed it
  const queryParams = {
    ...(filterCreatorId ? { creatorId: filterCreatorId } : {}),
    ...(appliedBuyerEmail ? { buyerEmail: appliedBuyerEmail } : {}),
    limit: PAGE_SIZE,
    offset,
  };

  const { data: response, isLoading } = useGetAdminOrders(
    queryParams as Parameters<typeof useGetAdminOrders>[0]
  );

  // When the first page loads (offset 0), reset accumulation
  useEffect(() => {
    if (offset === 0 && response?.data) {
      setAccumulatedOrders(response.data as any[]);
      setIsLoadingMore(false);
    }
  }, [offset, response?.data]);

  // When a subsequent page loads, append to accumulated list
  useEffect(() => {
    if (offset > 0 && response?.data && !isLoading) {
      setAccumulatedOrders((prev) => [...prev, ...(response.data as any[])]);
      setIsLoadingMore(false);
    }
  }, [offset, response, isLoading]);

  const hasMore = (response as any)?.hasMore ?? false;

  // Export picker state
  const [showPicker, setShowPicker] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exportCreatorId, setExportCreatorId] = useState('');
  const [exportBuyerEmail, setExportBuyerEmail] = useState('');
  const [exporting, setExporting] = useState(false);
  const [truncationWarning, setTruncationWarning] = useState<{ rowCount: number } | null>(null);

  // Proactive row-count estimate for the export picker
  const LARGE_EXPORT_THRESHOLD = 5_000;
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const countDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showPicker) return;
    if (countDebounceRef.current) clearTimeout(countDebounceRef.current);
    setEstimatedCount(null);

    // Only fetch when there is at least a from or to date set
    if (!from && !to) return;

    countDebounceRef.current = setTimeout(async () => {
      setCountLoading(true);
      try {
        const params = new URLSearchParams({ countOnly: 'true' });
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (exportCreatorId.trim()) params.set('creatorId', exportCreatorId.trim());
        if (exportBuyerEmail.trim()) params.set('buyerEmail', exportBuyerEmail.trim());
        const res = await fetch(`/api/v1/admin/orders/export?${params.toString()}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          setEstimatedCount(json?.data?.count ?? null);
        }
      } catch {
        // silently ignore — the warning is best-effort
      } finally {
        setCountLoading(false);
      }
    }, 400);

    return () => {
      if (countDebounceRef.current) clearTimeout(countDebounceRef.current);
    };
  }, [showPicker, from, to, exportCreatorId, exportBuyerEmail]);

  // When opening the export picker, pre-fill with active live filters
  const openExportPicker = () => {
    if (!showPicker) {
      setExportCreatorId(filterCreatorId);
      setExportBuyerEmail(appliedBuyerEmail);
    }
    setShowPicker((v) => !v);
  };

  const hasActiveFilters = filterCreatorId || appliedBuyerEmail;

  // Reset pagination whenever filters change
  const resetPagination = () => {
    setOffset(0);
    setAccumulatedOrders([]);
    setIsLoadingMore(false);
  };

  const clearLiveFilters = () => {
    setFilterCreatorId('');
    setFilterBuyerEmail('');
    setFilterBuyerEmailInput('');
    setAppliedBuyerEmail('');
    resetPagination();
  };

  // Apply buyer email on Enter or blur
  const commitBuyerEmail = () => {
    const trimmed = filterBuyerEmailInput.trim();
    if (trimmed !== appliedBuyerEmail) {
      setAppliedBuyerEmail(trimmed);
      resetPagination();
    }
  };

  const orders = accumulatedOrders;

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setOffset((prev) => prev + PAGE_SIZE);
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (exportCreatorId.trim()) params.set('creatorId', exportCreatorId.trim());
    if (exportBuyerEmail.trim()) params.set('buyerEmail', exportBuyerEmail.trim());
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

  const hasExportFilters = from || to || exportCreatorId.trim() || exportBuyerEmail.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif">Orders</h1>
          <p className="text-muted-foreground">View all marketplace transactions.</p>
        </div>
        <Button
          variant="outline"
          onClick={openExportPicker}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </Button>
      </div>

      {/* Live filter bar */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground self-end pb-0.5">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-creator">Creator</Label>
              <CreatorTypeahead
                inputId="filter-creator"
                creatorId={filterCreatorId}
                onChange={(id) => { setFilterCreatorId(id); resetPagination(); }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-buyer">Buyer Email</Label>
              <div className="flex gap-2">
                <Input
                  id="filter-buyer"
                  type="email"
                  value={filterBuyerEmailInput}
                  onChange={(e) => {
                    setFilterBuyerEmailInput(e.target.value);
                    if (!e.target.value.trim()) {
                      setAppliedBuyerEmail('');
                      resetPagination();
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitBuyerEmail(); }}
                  onBlur={commitBuyerEmail}
                  placeholder="buyer@example.com"
                  className="w-56"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearLiveFilters}
                className="self-end"
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
                  <Label htmlFor="export-creator">Creator</Label>
                  <CreatorTypeahead
                    inputId="export-creator"
                    creatorId={exportCreatorId}
                    onChange={(id) => setExportCreatorId(id)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="export-buyer">Buyer Email</Label>
                  <Input
                    id="export-buyer"
                    type="email"
                    value={exportBuyerEmail}
                    onChange={(e) => setExportBuyerEmail(e.target.value)}
                    placeholder="buyer@example.com"
                    className="w-64"
                  />
                </div>
              </div>
              {/* Proactive large-range warning */}
              {countLoading && (from || to) && (
                <p className="text-xs text-muted-foreground animate-pulse">Estimating row count…</p>
              )}
              {!countLoading && estimatedCount !== null && estimatedCount > LARGE_EXPORT_THRESHOLD && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <span>
                    This range contains{' '}
                    <span className="font-semibold">~{estimatedCount.toLocaleString()} orders</span>
                    {estimatedCount > 10_000 && (
                      <> — the export is capped at 10,000 rows</>
                    )}
                    . Consider narrowing the date range or adding a creator / buyer filter.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleExport} disabled={exporting} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {exporting ? 'Exporting…' : hasExportFilters ? 'Export filtered' : 'Export all time'}
                </Button>
                {hasExportFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setFrom(''); setTo(''); setExportCreatorId(''); setExportBuyerEmail(''); }}
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
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading orders…</div>
          ) : orders.length > 0 ? (
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
            <div className="p-12 text-center text-muted-foreground">
              {hasActiveFilters ? 'No orders match the current filters.' : 'No orders found.'}
            </div>
          )}
          {orders.length > 0 && (hasMore || isLoadingMore) && (
            <div className="flex justify-center border-t py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore || isLoading}
              >
                {isLoadingMore || (isLoading && offset > 0) ? 'Loading…' : `Load more`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
