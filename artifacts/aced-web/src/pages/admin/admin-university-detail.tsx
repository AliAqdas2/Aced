import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GraduationCap,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Course {
  id: string;
  universityId: string;
  name: string;
  slug: string;
  faculty?: string | null;
  level?: string | null;
  durationYears?: number | null;
}

interface University {
  id: string;
  name: string;
  slug: string;
  status: string;
  website?: string | null;
  courses: Course[];
}

// ── Slug generator ─────────────────────────────────────────────────────────────

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Course form defaults ───────────────────────────────────────────────────────

interface CourseForm {
  name: string;
  faculty: string;
  level: string;
  durationYears: string;
}

const EMPTY_FORM: CourseForm = { name: '', faculty: '', level: '', durationYears: '' };

function courseToForm(c: Course): CourseForm {
  return {
    name: c.name,
    faculty: c.faculty ?? '',
    level: c.level ?? '',
    durationYears: c.durationYears != null ? String(c.durationYears) : '',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  slug: string;
}

export default function AdminUniversityDetail({ slug }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [uni, setUni] = useState<University | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<CourseForm>(EMPTY_FORM);
  const [addSaving, setAddSaving] = useState(false);

  // Edit dialog
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState<CourseForm>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [deleteCourse, setDeleteCourse] = useState<Course | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/v1/taxonomy/universities/${slug}`);
      if (!res.ok) throw new Error(res.status === 404 ? 'University not found' : 'Failed to load');
      const json = await res.json();
      setUni(json.data as University);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Add course ────────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!uni || !addForm.name.trim()) return;
    setAddSaving(true);
    try {
      const res = await fetch('/api/v1/admin/taxonomy/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universityId: uni.id,
          name: addForm.name.trim(),
          slug: toSlug(addForm.name),
          faculty: addForm.faculty.trim() || undefined,
          level: addForm.level.trim() || undefined,
          durationYears: addForm.durationYears ? parseInt(addForm.durationYears, 10) : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? 'Failed to add course');
      }
      toast({ title: 'Course added' });
      setAddOpen(false);
      setAddForm(EMPTY_FORM);
      await loadData();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setAddSaving(false);
    }
  }

  // ── Edit course ───────────────────────────────────────────────────────────────

  function openEdit(course: Course) {
    setEditCourse(course);
    setEditForm(courseToForm(course));
  }

  async function handleEdit() {
    if (!editCourse) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/taxonomy/courses/${editCourse.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim() || undefined,
          slug: editForm.name.trim() ? toSlug(editForm.name) : undefined,
          faculty: editForm.faculty.trim() || undefined,
          level: editForm.level.trim() || undefined,
          durationYears: editForm.durationYears ? parseInt(editForm.durationYears, 10) : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? 'Failed to update course');
      }
      toast({ title: 'Course updated' });
      setEditCourse(null);
      await loadData();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  }

  // ── Delete course ─────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteCourse) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/v1/admin/taxonomy/courses/${deleteCourse.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? 'Failed to remove course');
      }
      toast({ title: 'Course removed' });
      setDeleteCourse(null);
      await loadData();
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (loadError || !uni) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/admin/universities')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Universities
        </Button>
        <p className="text-destructive">{loadError ?? 'University not found'}</p>
      </div>
    );
  }

  const courses = uni.courses ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb / back */}
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setLocation('/admin/universities')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Universities
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-serif mb-1 flex items-center gap-3">
            <GraduationCap className="h-7 w-7" />
            {uni.name}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant={uni.status === 'active' ? 'default' : 'secondary'}>{uni.status}</Badge>
            {uni.website && (
              <a
                href={uni.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary hover:underline"
              >
                {uni.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
        <Button onClick={() => { setAddForm(EMPTY_FORM); setAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add course
        </Button>
      </div>

      {/* Courses table */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-lg">Courses</h2>
          <span className="text-sm text-muted-foreground">({courses.length})</span>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No courses yet</p>
            <p className="text-sm mt-1">Add the first course for {uni.name}</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-4 py-3 font-semibold">Course name</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Faculty</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Level</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Duration</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{course.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {course.faculty ?? <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {course.level ?? <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {course.durationYears != null
                        ? `${course.durationYears} yr${course.durationYears !== 1 ? 's' : ''}`
                        : <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit course"
                          onClick={() => openEdit(course)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Remove course"
                          onClick={() => setDeleteCourse(course)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add course dialog ──────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add course — {uni.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Course name *</label>
              <Input
                placeholder="e.g. Computer Science"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Faculty</label>
              <Input
                placeholder="e.g. Engineering"
                value={addForm.faculty}
                onChange={(e) => setAddForm((f) => ({ ...f, faculty: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">Level</label>
                <Input
                  placeholder="e.g. Undergraduate"
                  value={addForm.level}
                  onChange={(e) => setAddForm((f) => ({ ...f, level: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">Duration (years)</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  placeholder="e.g. 3"
                  value={addForm.durationYears}
                  onChange={(e) => setAddForm((f) => ({ ...f, durationYears: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={addSaving}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleAdd} disabled={addSaving || !addForm.name.trim()}>
              {addSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit course dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!editCourse} onOpenChange={(open) => { if (!open) setEditCourse(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Course name *</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Faculty</label>
              <Input
                placeholder="e.g. Engineering"
                value={editForm.faculty}
                onChange={(e) => setEditForm((f) => ({ ...f, faculty: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">Level</label>
                <Input
                  placeholder="e.g. Undergraduate"
                  value={editForm.level}
                  onChange={(e) => setEditForm((f) => ({ ...f, level: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">Duration (years)</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={editForm.durationYears}
                  onChange={(e) => setEditForm((f) => ({ ...f, durationYears: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCourse(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editSaving || !editForm.name.trim()}>
              {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!deleteCourse} onOpenChange={(open) => { if (!open) setDeleteCourse(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove course?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{deleteCourse?.name}</span> will be
            permanently removed. Applicants who selected this course will keep their existing
            applications, but it will no longer appear in the course dropdown.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCourse(null)} disabled={deleteSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteSubmitting}>
              {deleteSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
