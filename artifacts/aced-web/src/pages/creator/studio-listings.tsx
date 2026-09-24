import { useState, useRef } from 'react';
import {
  useGetCreatorListings,
  useCreateListing,
  useUpdateListing,
  useGetListing,
  useCreateSubscriptionPlan,
  useGetCreatorCommissionRate,
  getGetCreatorListingsQueryKey,
  getGetListingQueryKey,
  getGetCreatorStorefrontQueryKey,
} from '@workspace/api-client-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MoreHorizontal, Edit, Trash, FileText, Video, Users, User, Calendar, Clock, RefreshCw, AlertTriangle, Upload, CheckCircle2, Loader2, PauseCircle, PlayCircle, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Digital files panel (visible manage UI)
// ---------------------------------------------------------------------------

interface ProductFileRow {
  id: string;
  assetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Shows platform fee % and creator net from a GBP price. */
function CommissionEarningsHint({
  priceGbp,
  commissionRatePct,
}: {
  priceGbp: number;
  commissionRatePct: number | undefined;
}) {
  if (commissionRatePct == null || !Number.isFinite(commissionRatePct)) return null;
  if (!Number.isFinite(priceGbp) || priceGbp <= 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Platform fee {commissionRatePct}% will be deducted from each payment via Stripe.
      </p>
    );
  }
  const net = priceGbp * (1 - commissionRatePct / 100);
  return (
    <p className="text-xs text-muted-foreground">
      Platform fee {commissionRatePct}% · You receive £{net.toFixed(2)} after Stripe deducts the Aced fee.
    </p>
  );
}

async function uploadListingFile(listingId: string, file: File) {
  const urlRes = await fetch(`/api/v1/creator/listings/${listingId}/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  });
  if (!urlRes.ok) throw new Error('Could not get upload URL');
  const { data: { uploadUrl, storageKey } } = await urlRes.json();

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!putRes.ok) throw new Error('File upload failed');

  const assetRes = await fetch(`/api/v1/creator/listings/${listingId}/paid-asset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storageKey,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  });
  if (!assetRes.ok) throw new Error('Failed to register file');
  return assetRes.json();
}

function DigitalFilesPanel({
  listingId,
  files: initialFiles,
  highlight,
}: {
  listingId: string;
  files: ProductFileRow[];
  highlight?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const files = initialFiles ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getGetCreatorListingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(listingId) });
    queryClient.invalidateQueries({ queryKey: getGetCreatorStorefrontQueryKey() });
  }

  async function handleAdd(file: File) {
    setUploading(true);
    try {
      await uploadListingFile(listingId, file);
      toast({ title: 'File added ✓' });
      invalidate();
    } catch (err: any) {
      toast({ title: err.message ?? 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove(fileId: string) {
    setRemovingId(fileId);
    try {
      const res = await fetch(`/api/v1/creator/listings/${listingId}/files/${fileId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove file');
      toast({ title: 'File removed' });
      invalidate();
    } catch (err: any) {
      toast({ title: err.message ?? 'Could not remove file', variant: 'destructive' });
    } finally {
      setRemovingId(null);
    }
  }

  async function handleReplace(fileId: string, file: File) {
    setUploading(true);
    try {
      const delRes = await fetch(`/api/v1/creator/listings/${listingId}/files/${fileId}`, {
        method: 'DELETE',
      });
      if (!delRes.ok) throw new Error('Failed to remove old file');
      await uploadListingFile(listingId, file);
      toast({ title: 'File replaced ✓' });
      invalidate();
    } catch (err: any) {
      toast({ title: err.message ?? 'Replace failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={`mt-3 rounded-xl border p-3 space-y-3 ${
        highlight || files.length === 0
          ? 'border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20'
          : 'border-border/60 bg-muted/20'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" />
          Downloadable files
          {files.length === 0 && (
            <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px] uppercase">
              Required
            </Badge>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add file
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleAdd(f);
          }}
        />
      </div>

      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add at least one file so students can download this after purchase (or for free).
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-lg bg-background border border-border/50 px-3 py-2"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{f.fileName}</p>
                <p className="text-[11px] text-muted-foreground">{formatBytes(f.sizeBytes)}</p>
              </div>
              <label className="text-xs font-medium text-primary cursor-pointer hover:underline">
                Replace
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading || removingId === f.id}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleReplace(f.id, file);
                  }}
                />
              </label>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                disabled={uploading || removingId === f.id}
                onClick={() => void handleRemove(f.id)}
              >
                {removingId === f.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Keep a thin dialog wrapper for any leftover callers
function DigitalFileUploadDialog({
  listingId,
  onClose,
}: {
  listingId: string;
  onClose: () => void;
}) {
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">Manage files</DialogTitle>
        <DialogDescription>Add downloadable files for this listing.</DialogDescription>
      </DialogHeader>
      <DigitalFilesPanel listingId={listingId} files={[]} highlight />
      <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Edit subscription plan modal
// ---------------------------------------------------------------------------

const editPlanSchema = z.object({
  subscriptionInterval: z.enum(['weekly', 'monthly']),
  sessionsPerPeriod: z.coerce.number().int().min(1),
  subscriptionPrice: z.coerce.number().min(1),
});

type EditPlanFormValues = z.infer<typeof editPlanSchema>;

function EditSubscriptionPlanModal({
  listingId,
  onClose,
}: {
  listingId: string;
  onClose: () => void;
}) {
  const { data: listingDetail, isLoading } = useGetListing(listingId);
  const { data: commissionRes } = useGetCreatorCommissionRate();
  const commissionRatePct = commissionRes?.data?.commissionRatePct;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const plan = (listingDetail?.data as any)?.subscriptionPlan ?? null;
  const serviceOffer = (listingDetail?.data as any)?.serviceOffer ?? null;

  const { data: impactData } = useQuery({
    queryKey: ['getSubscriptionPlanImpact', plan?.id ?? ''],
    enabled: !!plan?.id,
    queryFn: async () => {
      const res = await fetch(`/api/v1/creator/subscription-plans/${plan!.id}/impact`);
      if (!res.ok) throw new Error('Failed to load plan impact');
      return res.json() as Promise<{ data: { activeSubscriberCount: number } }>;
    },
  });
  const activeSubscriberCount = impactData?.data?.activeSubscriberCount ?? null;

  const form = useForm<EditPlanFormValues>({
    resolver: zodResolver(editPlanSchema),
    values: plan
      ? {
          subscriptionInterval: plan.billingInterval ?? 'monthly',
          sessionsPerPeriod: plan.sessionsPerPeriod ?? 4,
          subscriptionPrice: (plan.amountMinorUnits ?? 4000) / 100,
        }
      : {
          subscriptionInterval: 'monthly',
          sessionsPerPeriod: 4,
          subscriptionPrice: 40,
        },
  });

  const updateMutation = useCreateSubscriptionPlan({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCreatorListingsQueryKey() });
        toast({ title: 'Subscription plan updated' });
        onClose();
      },
      onError: () => {
        toast({ title: 'Failed to update plan', variant: 'destructive' });
      },
    },
  });

  function onSubmit(values: EditPlanFormValues) {
    if (!serviceOffer?.id) return;
    updateMutation.mutate({
      data: {
        serviceOfferId: serviceOffer.id,
        billingInterval: values.subscriptionInterval,
        sessionsPerPeriod: values.sessionsPerPeriod,
        amountMinorUnits: Math.round(values.subscriptionPrice * 100),
        currency: plan?.currency ?? 'GBP',
      },
    });
  }

  const watchInterval = form.watch('subscriptionInterval');
  const watchSessions = form.watch('sessionsPerPeriod');

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">Edit subscription plan</DialogTitle>
        <DialogDescription>
          Update price, billing period, or sessions included per period.
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground animate-pulse">Loading plan…</div>
      ) : (
        <>
          {/* Existing subscribers warning */}
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              {activeSubscriberCount !== null ? (
                <>
                  <strong>{activeSubscriberCount} active subscriber{activeSubscriberCount !== 1 ? 's' : ''}</strong>
                  {' — they will not be charged the new price until their next renewal.'}
                </>
              ) : (
                <>
                  Existing subscribers are <strong>not affected</strong> mid-period. Changes apply only
                  to new subscribers or renewals after the current billing cycle ends.
                </>
              )}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="subscriptionInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing period</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sessionsPerPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sessions per period</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(Number(v))}
                        value={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[1, 2, 3, 4, 6, 8, 10, 12].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} session{n !== 1 ? 's' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="subscriptionPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per period (£)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          £
                        </span>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="40.00"
                          className="pl-7"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">
                      Students pay this amount each {watchInterval} for {watchSessions} session
                      {watchSessions !== 1 ? 's' : ''}
                    </FormDescription>
                    <CommissionEarningsHint
                      priceGbp={Number(field.value) || 0}
                      commissionRatePct={commissionRatePct}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </Form>
        </>
      )}
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Edit listing dialog (title / description / tags)
// ---------------------------------------------------------------------------

const editListingSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(20, 'Description is too short').max(5000),
  tags: z.string().optional(),
});

type EditListingFormValues = z.infer<typeof editListingSchema>;

interface EditableListing {
  id: string;
  title: string;
  description: string;
  tags?: string[] | null;
  status: string;
}

function EditListingDialog({
  listing,
  onClose,
  onResubmitted,
}: {
  listing: EditableListing;
  onClose: () => void;
  onResubmitted?: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const willResubmit = listing.status === 'draft' || listing.status === 'rejected';

  const form = useForm<EditListingFormValues>({
    resolver: zodResolver(editListingSchema),
    defaultValues: {
      title: listing.title,
      description: listing.description,
      tags: (listing.tags ?? []).join(', '),
    },
  });

  const updateMutation = useUpdateListing({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCreatorListingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(listing.id) });
        queryClient.invalidateQueries({ queryKey: getGetCreatorStorefrontQueryKey() });
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            typeof q.queryKey[0] === 'string' &&
            (q.queryKey[0] as string).startsWith('/api/v1/storefronts/'),
        });
        onClose();
        if (willResubmit) {
          onResubmitted?.();
        } else {
          toast({ title: 'Listing updated' });
        }
      },
      onError: () => {
        toast({ title: 'Failed to update listing', variant: 'destructive' });
      },
    },
  });

  function onSubmit(values: EditListingFormValues) {
    const tags = (values.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    updateMutation.mutate({
      id: listing.id,
      data: {
        title: values.title,
        description: values.description,
        tags,
      },
    });
  }

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">Edit listing</DialogTitle>
        <DialogDescription>
          {willResubmit
            ? 'Saving will resubmit this listing for admin review.'
            : 'Update the title, description, and tags for this listing.'}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 1:1 Econometrics Tutoring" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe what students will get…"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. law, contract, revision" {...field} />
                </FormControl>
                <FormDescription>Comma-separated keywords.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : willResubmit ? (
                'Save & resubmit'
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------

const LISTING_TYPE_LABELS: Record<string, string> = {
  service_offer: 'Tutoring Session',
  group_session: 'Group Session',
  recorded_course: 'Recorded Course',
  digital_product: 'Digital Product',
};

const createListingSchema = z.object({
  type: z.enum(['service_offer', 'digital_product', 'recorded_course', 'group_session']),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description is too short'),
  pricingMode: z.enum(['per_session', 'subscription']).default('per_session'),
  isFree: z.boolean().default(false),
  priceAmount: z.coerce.number().min(0).default(0),
  // Subscription-specific
  subscriptionInterval: z.enum(['weekly', 'monthly']).default('monthly'),
  sessionsPerPeriod: z.coerce.number().int().min(1).default(4),
  subscriptionPrice: z.coerce.number().min(1).default(40),
  // Service-offer specific
  durationMinutes: z.coerce.number().int().optional(),
  deliveryMode: z.enum(['online', 'in_person', 'hybrid']).optional(),
  minNoticeHours: z.coerce.number().int().optional(),
  bookingHorizonDays: z.coerce.number().int().optional(),
});

type FormValues = z.infer<typeof createListingSchema>;

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    published: 'bg-green-100 text-green-800',
    draft: 'bg-muted text-muted-foreground',
    submitted: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
    archived: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${variants[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'service_offer': return <User className="h-5 w-5" />;
    case 'group_session': return <Users className="h-5 w-5" />;
    case 'recorded_course': return <Video className="h-5 w-5" />;
    default: return <FileText className="h-5 w-5" />;
  }
}

export default function StudioListings() {
  const { data: response, isLoading } = useGetCreatorListings();
  const { data: commissionRes } = useGetCreatorCommissionRate();
  const commissionRatePct = commissionRes?.data?.commissionRatePct;
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editPlanListingId, setEditPlanListingId] = useState<string | null>(null);
  const [highlightFilesId, setHighlightFilesId] = useState<string | null>(null);
  const [uploadListingId, setUploadListingId] = useState<string | null>(null);
  const [editingListing, setEditingListing] = useState<EditableListing | null>(null);
  const [pendingReviewOpen, setPendingReviewOpen] = useState(false);
  const [pendingReviewNeedsFiles, setPendingReviewNeedsFiles] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [listingVisibilityBusyId, setListingVisibilityBusyId] = useState<string | null>(null);

  function invalidateListingCaches(listingId?: string) {
    queryClient.invalidateQueries({ queryKey: getGetCreatorListingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCreatorStorefrontQueryKey() });
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === 'string' &&
        (q.queryKey[0] as string).startsWith('/api/v1/storefronts/'),
    });
    if (listingId) {
      queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(listingId) });
    }
  }

  async function setListingEnabled(listingId: string, enable: boolean) {
    setListingVisibilityBusyId(listingId);
    try {
      const res = await fetch(
        `/api/v1/creator/listings/${listingId}/${enable ? 'publish' : 'pause'}`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Request failed');
      }
      toast({ title: enable ? 'Listing enabled ✓' : 'Listing disabled' });
      invalidateListingCaches(listingId);
    } catch (e) {
      toast({
        title: enable ? 'Failed to enable listing' : 'Failed to disable listing',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setListingVisibilityBusyId(null);
    }
  }

  // Task #48 — pause / resume subscription plans
  const pauseMutation = useMutation({
    mutationFn: async ({ planId }: { planId: string }) => {
      const res = await fetch(`/api/v1/creator/subscription-plans/${planId}/pause`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to pause plan');
      return res.json();
    },
    onSuccess: () => {
      invalidateListingCaches();
      toast({ title: 'Plan paused. New subscribers cannot sign up until you resume.' });
    },
    onError: () => { toast({ title: 'Failed to pause plan', variant: 'destructive' }); },
  });
  const resumeMutation = useMutation({
    mutationFn: async ({ planId }: { planId: string }) => {
      const res = await fetch(`/api/v1/creator/subscription-plans/${planId}/resume`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to resume plan');
      return res.json();
    },
    onSuccess: () => {
      invalidateListingCaches();
      toast({ title: 'Plan resumed.' });
    },
    onError: () => { toast({ title: 'Failed to resume plan', variant: 'destructive' }); },
  });

  const createMutation = useCreateListing({
    mutation: {
      onSuccess: (res) => {
        invalidateListingCaches();
        setIsDialogOpen(false);
        const createdId = (res as any)?.data?.id as string | undefined;
        const createdType = form.getValues('type');
        form.reset();
        const needsFiles =
          !!createdId &&
          (createdType === 'digital_product' || createdType === 'recorded_course');
        if (needsFiles && createdId) {
          setHighlightFilesId(createdId);
        }
        setPendingReviewNeedsFiles(needsFiles);
        setPendingReviewOpen(true);
      },
      onError: () => {
        toast({ title: 'Failed to create listing', variant: 'destructive' });
      },
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      type: 'service_offer',
      title: '',
      description: '',
      pricingMode: 'per_session',
      isFree: false,
      priceAmount: 0,
      subscriptionInterval: 'monthly',
      sessionsPerPeriod: 4,
      subscriptionPrice: 40,
      durationMinutes: 60,
      deliveryMode: 'online',
      minNoticeHours: 24,
      bookingHorizonDays: 60,
    },
  });

  const watchType = form.watch('type');
  const watchIsFree = form.watch('isFree');
  const watchPricingMode = form.watch('pricingMode');
  const isSession = watchType === 'service_offer' || watchType === 'group_session';
  const isSubscription = watchPricingMode === 'subscription' && watchType === 'service_offer';

  function onSubmit(values: FormValues) {
    const isSubMode = values.pricingMode === 'subscription' && values.type === 'service_offer';
    createMutation.mutate({
      data: {
        type: values.type,
        title: values.title,
        description: values.description,
        pricingMode: isSubMode ? 'subscription' : 'per_session',
        ...(isSubMode
          ? {
              subscription: {
                billingInterval: values.subscriptionInterval,
                sessionsPerPeriod: values.sessionsPerPeriod,
                amountMinorUnits: Math.round(values.subscriptionPrice * 100),
                currency: 'GBP',
              },
            }
          : {
              isFree: values.isFree,
              price: values.isFree
                ? undefined
                : { amountMinorUnits: Math.round(values.priceAmount * 100), currency: 'GBP' },
            }),
        ...(isSession && {
          serviceOffer: {
            durationMinutes: (values.durationMinutes ?? 60) as 30 | 45 | 60 | 90,
            deliveryMode: values.deliveryMode ?? 'online',
            minNoticeHours: values.minNoticeHours ?? 24,
            bookingHorizonDays: values.bookingHorizonDays ?? 60,
            cancellationHoursNotice: 24,
            bufferMinutesBefore: 0,
            bufferMinutesAfter: 0,
          },
        }),
      } as any,
    });
  }

  const listings = (response?.data ?? []) as Array<{
    id: string; title: string; description: string; type: string; status: string; pricingMode: string;
    tags?: string[] | null;
    createdAt: string; purchaseCount: number; activePrice?: { amountMinorUnits: number } | null;
    subscriptionPlan?: { id: string; isActive: boolean; pausedAt?: string | null } | null;
  }>;

  const filtered = listings.filter(
    (l) => !searchQuery || l.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif">Listings</h1>
          <p className="text-muted-foreground">Manage your tutoring offers and study materials.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              New listing
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Create listing</DialogTitle>
              <DialogDescription>Add a new offer to your showcase.</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
                {/* Type */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Listing type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="service_offer">
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4" /> Tutoring Session (1:1)
                            </span>
                          </SelectItem>
                          <SelectItem value="group_session">
                            <span className="flex items-center gap-2">
                              <Users className="h-4 w-4" /> Group Session
                            </span>
                          </SelectItem>
                          <SelectItem value="recorded_course">
                            <span className="flex items-center gap-2">
                              <Video className="h-4 w-4" /> Recorded Course
                            </span>
                          </SelectItem>
                          <SelectItem value="digital_product">
                            <span className="flex items-center gap-2">
                              <FileText className="h-4 w-4" /> Digital Product
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1:1 Econometrics Tutoring" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what students will get from this session…"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Session-specific fields */}
                {isSession && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Calendar className="h-4 w-4" />
                      Session settings
                    </div>

                    <FormField
                      control={form.control}
                      name="durationMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Session duration</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(Number(v))}
                            value={String(field.value ?? 60)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="45">45 minutes</SelectItem>
                              <SelectItem value="60">1 hour</SelectItem>
                              <SelectItem value="90">1.5 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="deliveryMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? 'online'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="online">Online (video call)</SelectItem>
                              <SelectItem value="in_person">In person</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="minNoticeHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Min. notice</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(Number(v))}
                              value={String(field.value ?? 24)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1">1 hour</SelectItem>
                                <SelectItem value="4">4 hours</SelectItem>
                                <SelectItem value="12">12 hours</SelectItem>
                                <SelectItem value="24">24 hours</SelectItem>
                                <SelectItem value="48">48 hours</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bookingHorizonDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Booking window</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(Number(v))}
                              value={String(field.value ?? 60)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="14">2 weeks</SelectItem>
                                <SelectItem value="30">1 month</SelectItem>
                                <SelectItem value="60">2 months</SelectItem>
                                <SelectItem value="90">3 months</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Pricing */}
                <div className="space-y-3">
                  {/* Subscription toggle — only for service_offer type */}
                  {watchType === 'service_offer' && (
                    <FormField
                      control={form.control}
                      name="pricingMode"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/20">
                          <div>
                            <FormLabel className="text-sm font-semibold">Subscription plan</FormLabel>
                            <FormDescription className="text-xs">
                              Students pay a recurring fee for a session credit pack each period
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value === 'subscription'}
                              onCheckedChange={(checked) =>
                                field.onChange(checked ? 'subscription' : 'per_session')
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Subscription fields */}
                  {isSubscription && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <RefreshCw className="h-4 w-4" />
                        Subscription settings
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="subscriptionInterval"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Billing period</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="sessionsPerPeriod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sessions per period</FormLabel>
                              <Select
                                onValueChange={(v) => field.onChange(Number(v))}
                                value={String(field.value ?? 4)}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {[1, 2, 3, 4, 6, 8, 10, 12].map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                      {n} session{n !== 1 ? 's' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="subscriptionPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price per period (£)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  placeholder="40.00"
                                  className="pl-7"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormDescription className="text-xs">
                              Students pay this amount each {form.watch('subscriptionInterval') ?? 'month'} for {form.watch('sessionsPerPeriod') ?? 4} sessions
                            </FormDescription>
                            <CommissionEarningsHint
                              priceGbp={Number(field.value) || 0}
                              commissionRatePct={commissionRatePct}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Per-session pricing */}
                  {!isSubscription && (
                    <>
                      <FormField
                        control={form.control}
                        name="isFree"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/20">
                            <div>
                              <FormLabel className="text-sm font-semibold">Free listing</FormLabel>
                              <FormDescription className="text-xs">
                                Students can access this at no cost
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {!watchIsFree && (
                        <FormField
                          control={form.control}
                          name="priceAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Price (£)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                    £
                                  </span>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.50"
                                    placeholder="0.00"
                                    className="pl-7"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <CommissionEarningsHint
                                priceGbp={Number(field.value) || 0}
                                commissionRatePct={commissionRatePct}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating…' : 'Create listing'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search listings…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your listings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading…</div>
          ) : filtered.length > 0 ? (
            <div className="divide-y divide-border/50">
              {filtered.map((listing) => {
                const price = listing.activePrice;
                const isFree = !price || price.amountMinorUnits === 0;
                const isDigital =
                  listing.type === 'digital_product' || listing.type === 'recorded_course';
                const listingFiles = ((listing as any).files ?? []) as ProductFileRow[];
                return (
                  <div key={listing.id} className="p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <TypeIcon type={listing.type} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{listing.title}</div>
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {LISTING_TYPE_LABELS[listing.type] ?? listing.type}
                          </span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                          <span className="text-xs text-muted-foreground">
                            Created {format(new Date(listing.createdAt), 'MMM d, yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                          <span className="text-xs text-muted-foreground">
                            {listing.purchaseCount ?? 0} sales
                          </span>
                          {isDigital && (
                            <>
                              <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                              <span className="text-xs text-muted-foreground">
                                {listingFiles.length} file{listingFiles.length === 1 ? '' : 's'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <div className="flex flex-col items-start sm:items-end gap-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={listing.status} />
                          <span className="font-semibold text-sm">
                            {isFree ? 'Free' : `£${((price?.amountMinorUnits ?? 0) / 100).toFixed(2)}`}
                          </span>
                        </div>
                        {listing.status === 'rejected' && listing.moderationNotes && (
                          <p className="text-xs text-destructive max-w-xs sm:text-right">
                            Feedback: {listing.moderationNotes}
                          </p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {listing.status === 'published' && (
                            <DropdownMenuItem
                              disabled={listingVisibilityBusyId === listing.id}
                              onSelect={() => setListingEnabled(listing.id, false)}
                            >
                              <PauseCircle className="mr-2 h-4 w-4" /> Disable
                            </DropdownMenuItem>
                          )}
                          {listing.status === 'paused' && (
                            <DropdownMenuItem
                              disabled={listingVisibilityBusyId === listing.id}
                              onSelect={() => setListingEnabled(listing.id, true)}
                            >
                              <PlayCircle className="mr-2 h-4 w-4" /> Enable
                            </DropdownMenuItem>
                          )}
                          {listing.status === 'published' &&
                            listing.pricingMode === 'subscription' &&
                            listing.type === 'service_offer' && (
                              <>
                                <DropdownMenuItem
                                  onSelect={() => setEditPlanListingId(listing.id)}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" /> Edit plan
                                </DropdownMenuItem>
                                {listing.subscriptionPlan?.id && (
                                  listing.subscriptionPlan.isActive ? (
                                    <DropdownMenuItem
                                      onSelect={() => pauseMutation.mutate({ planId: listing.subscriptionPlan!.id })}
                                    >
                                      <Clock className="mr-2 h-4 w-4" /> Pause plan
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onSelect={() => resumeMutation.mutate({ planId: listing.subscriptionPlan!.id })}
                                    >
                                      <RefreshCw className="mr-2 h-4 w-4" /> Resume plan
                                    </DropdownMenuItem>
                                  )
                                )}
                              </>
                            )}
                          <DropdownMenuItem
                            onSelect={() =>
                              setEditingListing({
                                id: listing.id,
                                title: listing.title,
                                description: listing.description ?? '',
                                tags: listing.tags ?? [],
                                status: listing.status,
                              })
                            }
                          >
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive">
                            <Trash className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    </div>

                    {isDigital && (
                      <DigitalFilesPanel
                        listingId={listing.id}
                        files={listingFiles}
                        highlight={highlightFilesId === listing.id || listingFiles.length === 0}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold mb-1">No listings found</h3>
              <p className="text-muted-foreground mb-4 text-sm max-w-sm">
                {searchQuery
                  ? 'No listings match your search.'
                  : "You haven't created any listings yet."}
              </p>
              {!searchQuery && (
                <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                  Create your first listing
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit listing modal */}
      <Dialog
        open={editingListing !== null}
        onOpenChange={(open) => { if (!open) setEditingListing(null); }}
      >
        {editingListing && (
          <EditListingDialog
            key={editingListing.id}
            listing={editingListing}
            onClose={() => setEditingListing(null)}
            onResubmitted={() => {
              setPendingReviewNeedsFiles(false);
              setPendingReviewOpen(true);
            }}
          />
        )}
      </Dialog>

      <AlertDialog open={pendingReviewOpen} onOpenChange={setPendingReviewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl">
              Your listing will be live pending review
            </AlertDialogTitle>
            <AlertDialogDescription>
              An admin will review it shortly. Once approved, it goes live automatically.
              {pendingReviewNeedsFiles
                ? ' Add your downloadable file below so students can get it after approval.'
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit subscription plan modal */}
      <Dialog
        open={editPlanListingId !== null}
        onOpenChange={(open) => { if (!open) setEditPlanListingId(null); }}
      >
        {editPlanListingId && (
          <EditSubscriptionPlanModal
            listingId={editPlanListingId}
            onClose={() => setEditPlanListingId(null)}
          />
        )}
      </Dialog>

      {/* Digital file upload dialog */}
      <Dialog
        open={uploadListingId !== null}
        onOpenChange={(open) => { if (!open) setUploadListingId(null); }}
      >
        {uploadListingId && (
          <DigitalFileUploadDialog
            listingId={uploadListingId}
            onClose={() => setUploadListingId(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
