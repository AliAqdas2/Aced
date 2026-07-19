import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/use-auth';
import {
  useUpdateProfile,
  useGetCreatorProfile,
  useUpdateCreatorProfile,
  getGetMeQueryKey,
  getGetCreatorProfileQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
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
import { CheckCircle, Video } from 'lucide-react';
import { CalendarConnectCard } from '@/components/calendar-connect-card';

const profileSchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(100),
  bio: z.string().max(500).optional(),
});

const videoCallSchema = z.object({
  videoCallProvider: z.enum(['zoom', 'teams', 'meet', 'custom']).nullable(),
  videoCallLink: z
    .string()
    .url('Must be a valid URL starting with https://')
    .nullable()
    .or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;
type VideoCallForm = z.infer<typeof videoCallSchema>;

const PROVIDER_LABELS: Record<string, string> = {
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  meet: 'Google Meet',
  custom: 'Other / Custom link',
};

const PROVIDER_PLACEHOLDERS: Record<string, string> = {
  zoom: 'https://zoom.us/j/your-meeting-id',
  teams: 'https://teams.microsoft.com/l/meetup-join/...',
  meet: 'https://meet.google.com/abc-defg-hij',
  custom: 'https://...',
};

export default function StudioSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [videoSaved, setVideoSaved] = useState(false);

  const profile = user?.profile as {
    displayName?: string;
    bio?: string;
  } | null;

  // Profile form
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: profile?.displayName ?? '',
      bio: profile?.bio ?? '',
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        displayName: profile.displayName ?? '',
        bio: profile.bio ?? '',
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
      data: { displayName: values.displayName, bio: values.bio ?? '' },
    });
  }

  // Video call form
  const { data: creatorProfileData } = useGetCreatorProfile();
  const creatorProfile = creatorProfileData?.data;

  const videoForm = useForm<VideoCallForm>({
    resolver: zodResolver(videoCallSchema),
    defaultValues: {
      videoCallProvider: null,
      videoCallLink: '',
    },
  });

  useEffect(() => {
    if (creatorProfile) {
      videoForm.reset({
        videoCallProvider: (creatorProfile.videoCallProvider as VideoCallForm['videoCallProvider']) ?? null,
        videoCallLink: creatorProfile.videoCallLink ?? '',
      });
    }
  }, [creatorProfile]);

  const updateVideoMutation = useUpdateCreatorProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCreatorProfileQueryKey() });
        setVideoSaved(true);
        setTimeout(() => setVideoSaved(false), 3000);
      },
    },
  });

  function onVideoSubmit(values: VideoCallForm) {
    setVideoSaved(false);
    updateVideoMutation.mutate({
      data: {
        videoCallProvider: values.videoCallProvider ?? null,
        videoCallLink: values.videoCallLink || null,
      },
    });
  }

  const selectedProvider = videoForm.watch('videoCallProvider');

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold font-serif">Settings</h1>
        <p className="text-muted-foreground">Manage your creator account settings.</p>
      </div>

      {/* Profile */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="border-border/50">
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
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Bio{' '}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell students about yourself and your teaching style…"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
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
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* Video call */}
      <Form {...videoForm}>
        <form onSubmit={videoForm.handleSubmit(onVideoSubmit)}>
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                <CardTitle>Video Call Link</CardTitle>
              </div>
              <CardDescription>
                When a student books a session, this link is automatically added to their
                booking confirmation and calendar invite.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField
                control={videoForm.control}
                name="videoCallProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                      value={field.value ?? 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose your video platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No video call</SelectItem>
                        <SelectItem value="zoom">Zoom</SelectItem>
                        <SelectItem value="teams">Microsoft Teams</SelectItem>
                        <SelectItem value="meet">Google Meet</SelectItem>
                        <SelectItem value="custom">Other / Custom link</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedProvider && (
                <FormField
                  control={videoForm.control}
                  name="videoCallLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {PROVIDER_LABELS[selectedProvider]} link
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={PROVIDER_PLACEHOLDERS[selectedProvider] ?? 'https://...'}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Use your personal room or a recurring meeting link — not a one-time link.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex items-center gap-4 pt-2">
                <Button type="submit" disabled={updateVideoMutation.isPending}>
                  {updateVideoMutation.isPending ? 'Saving…' : 'Save Video Link'}
                </Button>
                {videoSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Saved
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* Calendar */}
      <CalendarConnectCard returnTo="/studio/settings" />
    </div>
  );
}
