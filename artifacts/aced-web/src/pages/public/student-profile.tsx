import { useGetStudentProfile, getGetStudentProfileQueryKey } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GraduationCap, Calendar, BookOpen, Share2 } from 'lucide-react';
import { useState } from 'react';

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-24 w-24 rounded-full object-cover ring-4 ring-background shadow-lg"
      />
    );
  }
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="h-24 w-24 rounded-full bg-primary/10 ring-4 ring-background shadow-lg flex items-center justify-center">
      <span className="text-2xl font-bold text-primary">{initials}</span>
    </div>
  );
}

export default function StudentProfile() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useGetStudentProfile(id, {
    query: {
      queryKey: getGetStudentProfileQueryKey(id),
      enabled: !!id,
    },
  });

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        Loading profile…
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <p className="text-xl font-semibold">Student not found</p>
        <p className="text-muted-foreground">This profile doesn't exist or has been removed.</p>
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    );
  }

  const profile = data.data;
  const memberYear = new Date(profile.memberSince).getFullYear();

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-8">
      {/* Header card */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="pt-0 pb-6 px-6">
          <div className="flex items-end justify-between -mt-12 mb-4">
            <Avatar name={profile.displayName} avatarUrl={profile.avatarUrl} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="mb-1 gap-2"
            >
              <Share2 className="h-4 w-4" />
              {copied ? 'Link copied!' : 'Share'}
            </Button>
          </div>

          <h1 className="text-2xl font-bold font-serif">{profile.displayName}</h1>

          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
            {profile.universityName && (
              <span className="flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4" />
                {profile.universityName}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Member since {memberYear}
            </span>
          </div>

          {profile.bio && (
            <p className="mt-4 text-muted-foreground leading-relaxed">{profile.bio}</p>
          )}
        </CardContent>
      </Card>

      {/* Purchases */}
      {profile.purchases.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold font-serif flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Courses &amp; Materials
          </h2>
          <div className="grid gap-2">
            {profile.purchases.map((p) => (
              <Link key={p.listingId} href={`/listings/${p.listingId}`}>
                <div className="flex items-center justify-between rounded-xl border px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group">
                  <span className="font-medium group-hover:text-primary transition-colors">
                    {p.title}
                  </span>
                  <Badge variant="secondary" className="text-xs">View</Badge>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {profile.purchases.length === 0 && (
        <div className="text-center text-muted-foreground py-8 rounded-xl border border-dashed">
          No courses purchased yet.
        </div>
      )}
    </div>
  );
}
