import { useState, useRef, useEffect } from 'react';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useSearch } from 'wouter';
import {
  useSubmitCreatorApplication,
  useListUniversities,
  getGetMeQueryKey,
  getVerificationUploadUrl,
  useGetApplicationConfig,
  getGetApplicationConfigQueryKey,
  useGetApplicationStatus,
  getGetApplicationStatusQueryKey,
  useListCoursesByUniversity,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, X, Loader2 } from 'lucide-react';

const applySchema = z.object({
  universityId: z.string().min(1, "Please select your university"),
  courseId: z.string().uuid("Please select your course"),
  graduationYear: z.coerce.number().min(2000).max(2030),
  academicResult: z.string().min(2, "Please specify your result"),
  headline: z.string().min(10, "Headline must be descriptive"),
  agreedToTerms: z.boolean().refine(val => val === true, "You must agree to the terms"),
});

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

interface FileInputProps {
  label: string;
  hint: string;
  required?: boolean;
  file: File | null;
  onSelect: (f: File | null) => void;
  error?: string;
  /** Filename of an already-uploaded document stored in the DB. */
  existingFileName?: string;
}

function FileInput({ label, hint, required, file, onSelect, error, existingFileName }: FileInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!ALLOWED_MIME.includes(f.type)) {
      onSelect(null);
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      onSelect(null);
      return;
    }
    onSelect(f);
  }

  /** True when no new file selected but an existing one is on record. */
  const hasExisting = !file && Boolean(existingFileName);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </label>

      {/* Existing-file pill shown above the drop zone when no replacement chosen */}
      {hasExisting && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate flex-1 text-muted-foreground">{existingFileName}</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">on file</span>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && ref.current?.click()}
        className={`relative flex items-center gap-3 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors
          ${file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30'}
          ${error ? 'border-destructive' : ''}`}
      >
        <input
          ref={ref}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleChange}
        />
        {file ? (
          <>
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-medium truncate flex-1">{file.name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(null); if (ref.current) ref.current.value = ''; }}
              className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">{hasExisting ? 'Click to replace' : 'Click to upload'}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          </>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Upload a file: get signed URL → PUT to S3 → record in DB */
async function uploadVerificationDoc(file: File, claimType: string): Promise<void> {
  // 1. Get signed upload URL
  const urlRes = await getVerificationUploadUrl({
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    claimType,
  });
  const { uploadUrl, storageKey } = urlRes.data as { uploadUrl: string; storageKey: string };

  // 2. PUT file directly to S3
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!putRes.ok && !uploadUrl.includes('mock=1')) {
    throw new Error(`S3 upload failed: ${putRes.status}`);
  }

  // 3. Record verification in the DB
  const recRes = await fetch('/api/v1/creator/verifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claimType, evidenceRef: storageKey, evidenceFileName: file.name }),
  });
  if (!recRes.ok) {
    throw new Error(`Failed to record verification: ${recRes.status}`);
  }
}

interface ExistingVerification {
  claimType: string;
  evidenceFileName: string;
}

interface ApplicationInitialValues {
  universityId?: string;
  courseId?: string;
  graduationYear?: number;
  academicResult?: string;
  headline?: string;
  /** Verifications already stored in the DB for this applicant. */
  existingVerifications?: ExistingVerification[];
}

/** Reusable application form — used on both /apply and /become-a-creator */
export function CreatorApplicationForm({ initialValues }: { initialValues?: ApplicationInitialValues }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: universities } = useListUniversities();
  const { data: configData } = useGetApplicationConfig({
    query: { queryKey: getGetApplicationConfigQueryKey() },
  });
  const dbsRequired = configData?.data?.dbsRequired ?? false;

  // Existing on-file filenames (resubmit only)
  const existingVerifications = initialValues?.existingVerifications ?? [];
  const existingDegreeFileName = existingVerifications.find(v => v.claimType === 'degree_certificate')?.evidenceFileName;
  const existingDbsFileName = existingVerifications.find(v => v.claimType === 'dbs_check')?.evidenceFileName;

  const [degreeFile, setDegreeFile] = useState<File | null>(null);
  const [dbsFile, setDbsFile] = useState<File | null>(null);
  const [fileErrors, setFileErrors] = useState<{ degree?: string; dbs?: string }>({});
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'submitting' | 'uploading' | 'error'>('idle');
  // Track whether the application row was successfully created/already existed
  // so a retry after a failed upload can skip straight to the upload step.
  const [appSaved, setAppSaved] = useState(false);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  const isResubmit = Boolean(initialValues);

  const form = useForm<z.infer<typeof applySchema>>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      universityId: initialValues?.universityId ?? '',
      courseId: initialValues?.courseId ?? '',
      graduationYear: initialValues?.graduationYear ?? new Date().getFullYear(),
      academicResult: initialValues?.academicResult ?? '',
      headline: initialValues?.headline ?? '',
      agreedToTerms: false,
    },
  });

  // #15 — watch universityId to populate the cascading course dropdown
  const selectedUniversityId = useWatch({ control: form.control, name: 'universityId' });
  const { data: coursesData, isLoading: coursesLoading } = useListCoursesByUniversity(
    selectedUniversityId,
    { query: { enabled: Boolean(selectedUniversityId) } },
  );

  // When university changes, clear the course selection (unless pre-populated on initial load)
  const prevUniversityRef = useRef<string>('');
  useEffect(() => {
    if (prevUniversityRef.current && prevUniversityRef.current !== selectedUniversityId) {
      form.setValue('courseId', '');
    }
    prevUniversityRef.current = selectedUniversityId;
  }, [selectedUniversityId, form]);

  const applyMutation = useSubmitCreatorApplication();

  async function runUploads() {
    setSubmitPhase('uploading');
    setUploadErrorMsg(null);
    try {
      if (degreeFile) await uploadVerificationDoc(degreeFile, 'degree_certificate');
      if (dbsFile) await uploadVerificationDoc(dbsFile, 'dbs_check');
      setLocation('/apply/status');
    } catch {
      setSubmitPhase('error');
      setUploadErrorMsg('Document upload failed. Your application was saved — use the button below to retry.');
    }
  }

  async function onSubmit(values: z.infer<typeof applySchema>) {
    // Validate file requirements.
    // On resubmit, files are optional — existing docs already stored remain valid.
    const errors: typeof fileErrors = {};
    if (!isResubmit && !degreeFile) errors.degree = 'Please upload your degree certificate or transcript';
    if (dbsRequired && !isResubmit && !dbsFile) errors.dbs = 'A DBS check document is required';
    if (Object.keys(errors).length) {
      setFileErrors(errors);
      return;
    }
    setFileErrors({});

    // Step 1: Submit the application (unless already saved from a previous attempt)
    if (!appSaved) {
      setSubmitPhase('submitting');
      try {
        await applyMutation.mutateAsync({ data: values });
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setAppSaved(true);
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 409) {
          // Application already submitted (e.g. page refreshed after submit).
          // The user is already creator_applicant — proceed straight to uploads.
          setAppSaved(true);
        } else {
          setSubmitPhase('error');
          setUploadErrorMsg(null);
          return;
        }
      }
    }

    // Step 2: Upload documents (session has creator_applicant role at this point)
    await runUploads();
  }

  const isPending = submitPhase === 'submitting' || submitPhase === 'uploading';

  return (
    <Card className="border-border/60">
      <CardContent className="p-6 sm:p-10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            {/* Academic Background */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">Academic Background</h3>

              {/* #15 — University dropdown (searchable via existing API filtering) */}
              <FormField
                control={form.control}
                name="universityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>University</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your university" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {universities?.data?.map(uni => (
                          <SelectItem key={uni.id} value={uni.id}>{uni.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* #15 — Course dropdown, filtered by selected university */}
              <FormField
                control={form.control}
                name="courseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course / Subject</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedUniversityId || coursesLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !selectedUniversityId
                                ? 'Select a university first'
                                : coursesLoading
                                ? 'Loading courses…'
                                : 'Select your course'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {coursesData?.data?.map(course => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name}
                          </SelectItem>
                        ))}
                        {selectedUniversityId && !coursesLoading && coursesData?.data?.length === 0 && (
                          <div className="py-2 px-3 text-sm text-muted-foreground">
                            No courses found for this university.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="academicResult"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected / Achieved Grade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="e.g. First Class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="First Class">First Class (1st)</SelectItem>
                          <SelectItem value="Upper Second Class">Upper Second (2:1)</SelectItem>
                          <SelectItem value="Distinction">Distinction (Masters)</SelectItem>
                          <SelectItem value="Merit">Merit (Masters)</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="graduationYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Graduation Year</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Profile Headline */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">Your Profile</h3>

              <FormField
                control={form.control}
                name="headline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Headline</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Final year Law student specializing in Contract Law" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">This will appear next to your name on your storefront.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* #39 — Document Verification always rendered, including on resubmit */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">Verification Documents</h3>
              {isResubmit && (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
                  You can add or replace your verification documents below. Any new files you upload will be added to your application alongside existing ones.
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Upload proof of your academic achievement. Accepted formats: PDF, JPG, PNG, WebP — max 20 MB each.
              </p>

              <FileInput
                label={isResubmit ? 'Degree Certificate or Transcript' : 'Degree Certificate or Transcript'}
                hint="PDF or image of your official degree certificate or final transcript"
                required={!isResubmit && !existingDegreeFileName}
                file={degreeFile}
                onSelect={setDegreeFile}
                error={fileErrors.degree}
                existingFileName={existingDegreeFileName}
              />

              <FileInput
                label={`DBS Check${dbsRequired && !isResubmit && !existingDbsFileName ? '' : ' (optional)'}`}
                hint="Enhanced DBS certificate or Basic Disclosure — leave blank to upload later"
                required={dbsRequired && !isResubmit && !existingDbsFileName}
                file={dbsFile}
                onSelect={setDbsFile}
                error={fileErrors.dbs}
                existingFileName={existingDbsFileName}
              />
            </div>

            {/* Terms */}
            <FormField
              control={form.control}
              name="agreedToTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary mt-1"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>I agree to the Tutor Terms</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      I confirm that the academic information and documents provided are genuine. Submitting false credentials will result in a permanent ban.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {submitPhase === 'error' && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                <p className="text-sm text-destructive font-medium">
                  {uploadErrorMsg ?? 'Something went wrong. Please check your details and try again.'}
                </p>
                {/* If the application was already saved but uploads failed, offer a dedicated retry */}
                {appSaved && uploadErrorMsg && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={runUploads}
                  >
                    Retry document upload
                  </Button>
                )}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-lg font-bold"
              disabled={isPending}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {submitPhase === 'uploading' ? 'Uploading documents…' : 'Submitting application…'}
                </span>
              ) : isResubmit ? 'Resubmit Application' : 'Submit Application'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/** Standalone /apply page — wraps the shared form with a header */
export default function Apply() {
  const search = useSearch();
  const isResubmit = new URLSearchParams(search).get('resubmit') === '1';

  const { data: statusData, isLoading: statusLoading } = useGetApplicationStatus({
    query: {
      queryKey: getGetApplicationStatusQueryKey(),
      enabled: isResubmit,
    },
  });

  // Derive pre-population values from existing application data
  const initialValues: ApplicationInitialValues | undefined = isResubmit && statusData?.data
    ? (() => {
        type StatusData = {
          headline?: string;
          expertise?: Array<{ universityId?: string; courseId?: string; graduationYear?: number; academicResult?: string }>;
          verifications?: Array<{ claimType: string; evidenceFileName: string }>;
        };
        const d = statusData.data as StatusData;
        return {
          universityId: d.expertise?.[0]?.universityId ?? '',
          courseId: d.expertise?.[0]?.courseId ?? '',
          graduationYear: d.expertise?.[0]?.graduationYear ?? new Date().getFullYear(),
          academicResult: d.expertise?.[0]?.academicResult ?? '',
          headline: d.headline ?? '',
          existingVerifications: (d.verifications ?? []).map(v => ({
            claimType: v.claimType,
            evidenceFileName: v.evidenceFileName,
          })),
        };
      })()
    : undefined;

  if (isResubmit && statusLoading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Loading your application…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-10">
          {isResubmit ? (
            <>
              <h1 className="font-serif text-4xl font-bold mb-4">Update Your Application</h1>
              <p className="text-xl text-muted-foreground">Make the requested changes and resubmit for review.</p>
            </>
          ) : (
            <>
              <h1 className="font-serif text-4xl font-bold mb-4">Join as an Ace</h1>
              <p className="text-xl text-muted-foreground">Share your expertise and start earning on Aced.</p>
            </>
          )}
        </div>
        <CreatorApplicationForm initialValues={initialValues} />
      </div>
    </div>
  );
}

// ─── Status icons ─────────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/>
      <path d="m9 14 2 2 4-4"/>
    </svg>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function PendingStatus({ status, submittedAt, reviewNotes }: { status: string; submittedAt: string; reviewNotes?: string | null }) {
  const submitted = new Date(submittedAt);
  const reviewBy = new Date(submitted.getTime() + 48 * 60 * 60 * 1000);
  const label =
    status === 'under_review' ? 'Under Review' :
    status === 'changes_requested' ? 'Changes Requested' :
    'Application Received';

  return (
    <>
      <div className="h-20 w-20 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-6">
        <ClockIcon />
      </div>
      <h1 className="text-3xl font-bold font-serif mb-3">{label}</h1>
      <p className="text-muted-foreground mb-6">
        {status === 'changes_requested'
          ? "Our team has reviewed your application and requested some changes before it can be approved."
          : "Thanks for applying to join as an Ace! Our team is reviewing your academic credentials."}
      </p>
      {status === 'changes_requested' && (
        reviewNotes ? (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Reviewer feedback</p>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{reviewNotes}</p>
          </div>
        ) : (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
            <p className="text-sm text-amber-800">Our team will be in touch by email with the specific changes needed.</p>
          </div>
        )
      )}
      <div className="p-4 bg-muted rounded-lg mb-6 text-sm text-left space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Submitted</span>
          <span className="font-medium">{submitted.toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Estimated review by</span>
          <span className="font-medium">{reviewBy.toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium capitalize">{status.replace('_', ' ')}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-6">We'll send you an email when a decision has been made.</p>
      {status === 'changes_requested' ? (
        <div className="space-y-3">
          <Button size="lg" className="w-full" asChild>
            <Link href="/apply?resubmit=1">Update and resubmit</Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full" asChild>
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </div>
      ) : (
        <Button size="lg" className="w-full" asChild>
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      )}
    </>
  );
}

function ApprovedStatus() {
  return (
    <>
      <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-6">
        <CheckIcon />
      </div>
      <h1 className="text-3xl font-bold font-serif mb-3">You're Approved! 🎉</h1>
      <p className="text-muted-foreground mb-6">
        Congratulations — your application has been approved. You're ready to start earning on Aced.
      </p>
      <div className="p-4 bg-muted rounded-lg mb-6 text-sm text-left">
        <div className="font-semibold mb-2">Get started:</div>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>Set up your Stripe account to receive payouts</li>
          <li>Customise your tutor studio and storefront</li>
          <li>Create your first listing and go live</li>
        </ol>
      </div>
      <div className="space-y-3">
        <Button size="lg" className="w-full" asChild>
          <Link href="/creator/stripe/setup">Set Up Stripe Payouts</Link>
        </Button>
        <Button size="lg" variant="outline" className="w-full" asChild>
          <Link href="/studio">Go to My Studio</Link>
        </Button>
      </div>
    </>
  );
}

function RejectedStatus() {
  return (
    <>
      <div className="h-20 w-20 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-6">
        <XIcon />
      </div>
      <h1 className="text-3xl font-bold font-serif mb-3">Application Unsuccessful</h1>
      <p className="text-muted-foreground mb-6">
        Unfortunately we weren't able to approve your application at this time. This is usually due to academic credential requirements not being met.
      </p>
      <div className="p-4 bg-muted rounded-lg mb-6 text-sm text-left">
        <div className="font-semibold mb-2">What happens next:</div>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>You can re-apply once you have additional supporting credentials</li>
          <li>Check your email for specific feedback from our team</li>
          <li>You may continue browsing and booking sessions as a learner</li>
        </ul>
      </div>
      <div className="space-y-3">
        <Button size="lg" className="w-full" asChild>
          <Link href="/apply">Re-apply</Link>
        </Button>
        <Button size="lg" variant="outline" className="w-full" asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const TERMINAL_STATUSES = ['approved', 'closed'];
const POLL_INTERVAL_MS = 30_000;

export function ApplyStatus() {
  const queryClient = useQueryClient();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const { data, isLoading } = useGetApplicationStatus({
    query: {
      queryKey: getGetApplicationStatusQueryKey(),
      refetchInterval: (query) => {
        const status = (query.state.data as { data?: { status?: string } } | undefined)?.data?.status;
        if (status && TERMINAL_STATUSES.includes(status)) return false;
        return POLL_INTERVAL_MS;
      },
      refetchIntervalInBackground: false,
    },
  });

  // Update last-checked timestamp whenever we get fresh data
  useEffect(() => {
    if (!isLoading) setLastChecked(new Date());
  }, [data, isLoading]);

  // SSE — push live status updates from the server
  useEffect(() => {
    // Don't open SSE while initial load is in flight or if already terminal
    if (isLoading) return;
    const currentStatus = (data as { data?: { status?: string } } | undefined)?.data?.status;
    if (currentStatus && TERMINAL_STATUSES.includes(currentStatus)) return;

    const es = new EventSource('/api/v1/creator/application/status');

    es.onopen = () => setLiveConnected(true);

    es.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          status?: string;
          reviewNotes?: string | null;
          closed?: boolean;
          error?: string;
        };
        if (payload.closed || payload.error) {
          setLiveConnected(false);
          es.close();
          return;
        }
        if (payload.status) {
          // Patch the query cache so the UI re-renders immediately
          queryClient.setQueryData(getGetApplicationStatusQueryKey(), (old: unknown) => {
            const typed = old as { data?: Record<string, unknown> } | undefined;
            if (!typed?.data) return old;
            return {
              ...typed,
              data: {
                ...typed.data,
                status: payload.status,
                reviewNotes: payload.reviewNotes ?? typed.data['reviewNotes'],
              },
            };
          });
          setLastChecked(new Date());
          // Close SSE once terminal
          if (TERMINAL_STATUSES.includes(payload.status!)) {
            setLiveConnected(false);
            es.close();
          }
        }
      } catch {
        // ignore JSON parse errors
      }
    };

    es.onerror = () => {
      setLiveConnected(false);
      es.close();
    };

    return () => {
      es.close();
      setLiveConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const application = data?.data;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Loading your application…</div>
      </div>
    );
  }

  // No application found — show the generic confirmation (just submitted flow)
  if (!application) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center py-20 px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-12 pb-12 px-6">
            <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
              <ClipboardIcon />
            </div>
            <h1 className="text-3xl font-bold font-serif mb-4">Application Received</h1>
            <p className="text-muted-foreground mb-8">
              Thanks for applying! Our team is reviewing your academic credentials. We aim to process all applications within 48 hours.
            </p>
            <Button size="lg" className="w-full" asChild>
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = application.status ?? 'submitted';
  const createdAt = application.createdAt ?? new Date().toISOString();

  const isTerminal = TERMINAL_STATUSES.includes(status);

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col items-center py-20 px-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-12 pb-12 px-6">
          {status === 'approved' ? (
            <ApprovedStatus />
          ) : status === 'closed' ? (
            <RejectedStatus />
          ) : (
            <PendingStatus status={status} submittedAt={createdAt} reviewNotes={application.reviewNotes} />
          )}
        </CardContent>
      </Card>
      {!isTerminal && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          {liveConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span>Live</span>
            </>
          ) : lastChecked ? (
            <span>Last checked {lastChecked.toLocaleTimeString(undefined, { timeStyle: 'short' })} · updates automatically</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
