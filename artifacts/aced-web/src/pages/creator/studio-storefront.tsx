import { useState, useEffect, useRef } from 'react';
import { useGetCreatorStorefront, useUpdateCreatorStorefront } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Globe,
  BookOpen,
  MessageCircleQuestion,
  Settings,
  Eye,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  GraduationCap,
  Video,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FaqItem { q: string; a: string }
interface FaqJson { faqs: FaqItem[]; funFacts: string[] }

interface CreatorProfileData {
  headline: string | null;
  videoCallProvider: string | null;
  videoCallLink: string | null;
  expertise: Array<{
    universityId: string | null;
    courseId: string | null;
    graduationYear: number | null;
    academicResult: string | null;
    isPrimary: boolean;
  }>;
  verifications?: Array<{ claimType: string; evidenceFileName: string }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseFaqJson(raw: unknown): FaqJson {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return {
      faqs: Array.isArray(obj.faqs) ? obj.faqs as FaqItem[] : [],
      funFacts: Array.isArray(obj.funFacts) ? obj.funFacts as string[] : [],
    };
  }
  // Legacy: raw was an array of FAQs
  if (Array.isArray(raw)) return { faqs: raw as FaqItem[], funFacts: [] };
  return { faqs: [], funFacts: [] };
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function StudioStorefront() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Remote data
  const { data: sfResponse, isLoading: sfLoading } = useGetCreatorStorefront();
  const updateStorefront = useUpdateCreatorStorefront();

  const [profileData, setProfileData] = useState<CreatorProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Form state — identity
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  // Form state — story
  const [bio, setBio] = useState('');
  const [funFacts, setFunFacts] = useState<string[]>(['']);

  // Form state — FAQ
  const [faqs, setFaqs] = useState<FaqItem[]>([{ q: '', a: '' }]);

  // Form state — media & settings
  const [introVideoUrl, setIntroVideoUrl] = useState('');
  const [policies, setPolicies] = useState('');
  const [slug, setSlug] = useState('');
  const [videoCallProvider, setVideoCallProvider] = useState<string>('');
  const [videoCallLink, setVideoCallLink] = useState('');

  // Publish state
  const [isPublished, setIsPublished] = useState(false);
  const [publishSaving, setPublishSaving] = useState(false);

  // Section saving states
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingStory, setSavingStory] = useState(false);
  const [savingFaq, setSavingFaq] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Seed form from remote data
  const seeded = useRef(false);

  useEffect(() => {
    fetch('/api/v1/creator/profile')
      .then((r) => r.json())
      .then((d) => {
        setProfileData(d.data);
        setHeadline(d.data?.headline ?? '');
        setVideoCallProvider(d.data?.videoCallProvider ?? '');
        setVideoCallLink(d.data?.videoCallLink ?? '');
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  useEffect(() => {
    const sf = sfResponse?.data as any;
    if (!sf || seeded.current) return;
    seeded.current = true;
    setDisplayName(sf.displayName ?? '');
    setAvatarUrl(sf.coverImageUrl ?? ''); // we'll use avatarUrl from profile fetch
    setCoverImageUrl(sf.coverImageUrl ?? '');
    setIntroVideoUrl(sf.introVideoUrl ?? '');
    setBio(sf.bio ?? '');
    setPolicies(sf.policies ?? '');
    setSlug(sf.slug ?? '');
    setIsPublished(sf.isPublished ?? false);
    const faqData = parseFaqJson(sf.faqJson);
    setFunFacts(faqData.funFacts.length > 0 ? faqData.funFacts : ['']);
    setFaqs(faqData.faqs.length > 0 ? faqData.faqs : [{ q: '', a: '' }]);
  }, [sfResponse]);

  // Fetch avatar from /profile
  useEffect(() => {
    fetch('/api/v1/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.avatarUrl) setAvatarUrl(d.data.avatarUrl);
      })
      .catch(() => {});
  }, []);

  const sf = sfResponse?.data as any;

  // ── Save handlers ────────────────────────────────────────────────────────

  async function saveIdentity() {
    setSavingIdentity(true);
    try {
      await Promise.all([
        // Update storefront display name
        updateStorefront.mutateAsync({ data: { displayName, coverImageUrl: coverImageUrl || null } } as any),
        // Update creator profile headline
        fetch('/api/v1/creator/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headline }),
        }),
        // Update user profile avatar
        avatarUrl
          ? fetch('/api/v1/profile', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ avatarUrl }),
            })
          : Promise.resolve(),
      ]);
      toast({ title: 'Profile identity saved ✓' });
      queryClient.invalidateQueries({ queryKey: ['creator-storefront'] });
    } catch {
      toast({ title: 'Failed to save identity', variant: 'destructive' });
    } finally {
      setSavingIdentity(false);
    }
  }

  async function saveStory() {
    setSavingStory(true);
    try {
      const sf = sfResponse?.data as any;
      const currentFaqJson = parseFaqJson(sf?.faqJson);
      await updateStorefront.mutateAsync({
        data: {
          bio,
          faqJson: { faqs: currentFaqJson.faqs, funFacts: funFacts.filter((f) => f.trim()) },
        },
      } as any);
      toast({ title: 'Your story saved ✓' });
    } catch {
      toast({ title: 'Failed to save story', variant: 'destructive' });
    } finally {
      setSavingStory(false);
    }
  }

  async function saveFaq() {
    setSavingFaq(true);
    try {
      const sf = sfResponse?.data as any;
      const currentFaqJson = parseFaqJson(sf?.faqJson);
      await updateStorefront.mutateAsync({
        data: {
          faqJson: {
            faqs: faqs.filter((f) => f.q.trim() && f.a.trim()),
            funFacts: currentFaqJson.funFacts,
          },
        },
      } as any);
      toast({ title: 'FAQs saved ✓' });
    } catch {
      toast({ title: 'Failed to save FAQs', variant: 'destructive' });
    } finally {
      setSavingFaq(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await Promise.all([
        updateStorefront.mutateAsync({
          data: {
            policies: policies || null,
            introVideoUrl: introVideoUrl || null,
            slug,
          },
        } as any),
        fetch('/api/v1/creator/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoCallProvider: videoCallProvider || null,
            videoCallLink: videoCallLink || null,
          }),
        }),
      ]);
      toast({ title: 'Settings saved ✓' });
    } catch {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  }

  async function togglePublish(val: boolean) {
    setPublishSaving(true);
    try {
      await fetch('/api/v1/creator/storefront/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: val }),
      });
      setIsPublished(val);
      toast({ title: val ? 'Storefront published ✓' : 'Storefront unpublished' });
      queryClient.invalidateQueries({ queryKey: ['creator-storefront'] });
    } catch {
      toast({ title: 'Failed to update visibility', variant: 'destructive' });
    } finally {
      setPublishSaving(false);
    }
  }

  // ── Fun facts helpers ────────────────────────────────────────────────────

  function updateFunFact(i: number, val: string) {
    setFunFacts((prev) => prev.map((f, idx) => (idx === i ? val : f)));
  }

  function removeFunFact(i: number) {
    setFunFacts((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── FAQ helpers ──────────────────────────────────────────────────────────

  function updateFaq(i: number, field: 'q' | 'a', val: string) {
    setFaqs((prev) => prev.map((f, idx) => (idx === i ? { ...f, [field]: val } : f)));
  }

  function removeFaq(i: number) {
    setFaqs((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (sfLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const expertise = profileData?.expertise ?? [];
  const primaryExp = expertise.find((e) => e.isPrimary) ?? expertise[0];
  const verifications = (profileData as any)?.verifications ?? [];
  const hasDbs = verifications.some((v: any) => v.claimType === 'dbs_check');
  const certificates = verifications.filter((v: any) => v.claimType === 'certificate');
  const storefrontUrl = slug ? `${window.location.origin}/storefronts/${slug}` : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold font-serif">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Control how students see you on Aced.
        </p>
      </div>

      {/* ── Visibility banner ─────────────────────────────────────────── */}
      <Card className={isPublished ? 'border-green-500/40 bg-green-50/50' : 'border-amber-400/40 bg-amber-50/50'}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Eye className={`h-5 w-5 ${isPublished ? 'text-green-600' : 'text-amber-600'}`} />
              <div>
                <p className="text-sm font-semibold">
                  {isPublished ? 'Your storefront is live' : 'Storefront is hidden from students'}
                </p>
                {storefrontUrl && (
                  <a
                    href={storefrontUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                  >
                    {storefrontUrl} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {publishSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={isPublished}
                onCheckedChange={togglePublish}
                disabled={publishSaving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Identity ──────────────────────────────────────────────────── */}
      <SectionCard icon={User} title="Public identity" description="How students first see you">
        <div className="space-y-4">
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-muted overflow-hidden shrink-0 border-2 border-border">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                  <User className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <Label>Profile photo URL</Label>
              <Input
                placeholder="https://example.com/your-photo.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Paste a direct link to your photo (LinkedIn, Gravatar, etc.)</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>

          <div className="space-y-1">
            <Label>Headline <span className="text-muted-foreground font-normal">(shown under your name)</span></Label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Warwick Law First Class — Contract & Tort specialist"
              maxLength={160}
            />
            <p className="text-xs text-muted-foreground">{headline.length}/160 characters</p>
          </div>

          <div className="space-y-1">
            <Label>Cover / banner image URL</Label>
            <Input
              placeholder="https://example.com/banner.jpg"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
            />
          </div>

          {/* Academic background (read-only from expertise) */}
          {primaryExp && (
            <div className="rounded-xl border bg-muted/30 p-3 flex items-center gap-3">
              <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Academic background</span> — set during your application.{' '}
                {primaryExp.graduationYear && `Graduating ${primaryExp.graduationYear}.`}{' '}
                {primaryExp.academicResult && `Result: ${primaryExp.academicResult}.`}
              </div>
            </div>
          )}

          {/* Verification badges */}
          <div className="flex flex-wrap gap-2">
            {hasDbs && (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> DBS Checked
              </Badge>
            )}
            {certificates.map((c: any, i: number) => (
              <Badge key={i} variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {c.evidenceFileName || 'Certificate'}
              </Badge>
            ))}
          </div>

          <Button onClick={saveIdentity} disabled={savingIdentity} className="w-full sm:w-auto">
            {savingIdentity ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Save identity'}
          </Button>
        </div>
      </SectionCard>

      {/* ── Your Story ────────────────────────────────────────────────── */}
      <SectionCard icon={BookOpen} title="Your story" description="Tell students about yourself">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>About me</Label>
            <Textarea
              rows={6}
              placeholder="Share your academic background, teaching style, what you love about your subject, and how you can help students…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">{bio.length}/2000</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Fun facts <span className="text-muted-foreground font-normal text-xs ml-1">— 3–5 quick facts that show your personality</span></Label>
            {funFacts.map((fact, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`e.g. I once argued a moot against a KC…`}
                  value={fact}
                  onChange={(e) => updateFunFact(i, e.target.value)}
                  maxLength={120}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFunFact(i)}
                  disabled={funFacts.length <= 1}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setFunFacts((prev) => [...prev, ''])}
              disabled={funFacts.length >= 6}
            >
              <Plus className="h-3.5 w-3.5" /> Add fun fact
            </Button>
          </div>

          <Button onClick={saveStory} disabled={savingStory} className="w-full sm:w-auto">
            {savingStory ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Save story'}
          </Button>
        </div>
      </SectionCard>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <SectionCard icon={MessageCircleQuestion} title="Frequently asked questions" description="Help students know what to expect">
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/60 p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Q{i + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeFaq(i)}
                  disabled={faqs.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
              <Input
                placeholder="e.g. What level do you teach?"
                value={faq.q}
                onChange={(e) => updateFaq(i, 'q', e.target.value)}
              />
              <Textarea
                rows={2}
                placeholder="Your answer…"
                value={faq.a}
                onChange={(e) => updateFaq(i, 'a', e.target.value)}
              />
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setFaqs((prev) => [...prev, { q: '', a: '' }])}
            disabled={faqs.length >= 10}
          >
            <Plus className="h-3.5 w-3.5" /> Add question
          </Button>

          <Button onClick={saveFaq} disabled={savingFaq} className="w-full sm:w-auto">
            {savingFaq ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Save FAQs'}
          </Button>
        </div>
      </SectionCard>

      {/* ── Settings ──────────────────────────────────────────────────── */}
      <SectionCard icon={Settings} title="Settings" description="Booking policies, video call link, and storefront URL">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Storefront URL slug</Label>
            <div className="flex items-center gap-0">
              <span className="text-sm text-muted-foreground bg-muted border border-r-0 rounded-l-md px-3 py-2 select-none whitespace-nowrap">
                /storefronts/
              </span>
              <Input
                className="rounded-l-none"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="your-name"
                maxLength={60}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Policies</Label>
            <Textarea
              rows={4}
              placeholder="e.g. 24-hour cancellation notice required. Sessions are conducted via Zoom. Materials are for personal use only."
              value={policies}
              onChange={(e) => setPolicies(e.target.value)}
              maxLength={5000}
            />
          </div>

          <div className="space-y-1">
            <Label>Intro video URL <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={introVideoUrl}
              onChange={(e) => setIntroVideoUrl(e.target.value)}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" /> Video call settings
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-normal text-muted-foreground">Platform</Label>
                <Select value={videoCallProvider} onValueChange={setVideoCallProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zoom">Zoom</SelectItem>
                    <SelectItem value="teams">Microsoft Teams</SelectItem>
                    <SelectItem value="meet">Google Meet</SelectItem>
                    <SelectItem value="custom">Custom link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-normal text-muted-foreground">Meeting link</Label>
                <Input
                  placeholder="https://zoom.us/j/..."
                  value={videoCallLink}
                  onChange={(e) => setVideoCallLink(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button onClick={saveSettings} disabled={savingSettings} className="w-full sm:w-auto">
            {savingSettings ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Save settings'}
          </Button>
        </div>
      </SectionCard>

      {/* ── Visibility (bottom) ───────────────────────────────────────── */}
      <SectionCard icon={Globe} title="Storefront visibility">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {isPublished ? 'Published — visible to students' : 'Unpublished — only you can see it'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You can take it offline at any time without losing your content.
            </p>
          </div>
          <Switch checked={isPublished} onCheckedChange={togglePublish} disabled={publishSaving} />
        </div>
      </SectionCard>
    </div>
  );
}
