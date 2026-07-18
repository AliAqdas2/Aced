import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/use-auth';
import {
  useUpdateProfile,
  useListUniversities,
  getGetMeQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';

const profileSchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(100),
  bio: z.string().max(500).optional(),
  universityId: z.string().uuid().optional().nullable(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const profile = user?.profile as {
    displayName?: string;
    bio?: string;
    universityId?: string | null;
  } | null;

  const { data: uniData } = useListUniversities();
  const universities = (uniData?.data ?? []) as Array<{ id: string; name: string }>;

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: profile?.displayName ?? '',
      bio: profile?.bio ?? '',
      universityId: profile?.universityId ?? null,
    },
  });

  // Re-populate when user data arrives
  useEffect(() => {
    if (profile) {
      form.reset({
        displayName: profile.displayName ?? '',
        bio: profile.bio ?? '',
        universityId: profile.universityId ?? null,
      });
    }
  }, [user]);

  const updateMutation = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    },
  });

  function onSubmit(values: ProfileForm) {
    setSaved(false);
    updateMutation.mutate({
      data: {
        displayName: values.displayName,
        bio: values.bio ?? '',
        universityId: values.universityId ?? null,
      },
    });
  }

  const publicProfileUrl = user?.id ? `/students/${user.id}` : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences.</p>
        </div>
        {publicProfileUrl && (
          <Button variant="outline" size="sm" className="gap-2 mt-1" asChild>
            <Link href={publicProfileUrl}>
              <ExternalLink className="h-4 w-4" />
              View public profile
            </Link>
          </Button>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel className="text-sm font-medium">Email Address</FormLabel>
                <Input value={user?.email ?? ''} disabled />
                <p className="text-xs text-muted-foreground">
                  Email addresses cannot be changed directly.
                </p>
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell other students a little about yourself…"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="universityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>University <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(v) => field.onChange(v || null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your university" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {universities.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Shown on your public profile so students can find peers at the same uni.
                    </p>
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4 pt-2">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Saved
                  </span>
                )}
                {updateMutation.isError && (
                  <span className="text-sm text-destructive">Failed to save. Try again.</span>
                )}
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
