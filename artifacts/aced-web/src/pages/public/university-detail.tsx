import { useParams, Link } from 'wouter';
import { useGetUniversity, getGetUniversityQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap, ArrowLeft, ExternalLink, MapPin } from 'lucide-react';

export default function UniversityDetail() {
  const params = useParams();
  const slug = params.slug as string;
  
  const { data: response, isLoading, error } = useGetUniversity(slug, {
    query: { enabled: !!slug, queryKey: getGetUniversityQueryKey(slug) }
  });

  const university = response?.data;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-40 bg-muted rounded-xl"></div>
          <div className="h-10 w-1/3 bg-muted rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !university) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">University not found</h1>
        <Button asChild><Link href="/search">Return to Search</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-[#0F1A3C] text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary-gradient opacity-10"></div>
        <div className="container relative z-10 mx-auto px-4">
          <Button variant="ghost" asChild className="text-white/70 hover:text-white hover:bg-white/10 mb-6 -ml-4">
            <Link href="/search"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Search</Link>
          </Button>
          
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <GraduationCap className="h-12 w-12 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-4xl font-bold mb-2">{university.name}</h1>
              <div className="flex items-center gap-4 text-white/70">
                <span className="flex items-center"><MapPin className="h-4 w-4 mr-1" /> United Kingdom</span>
                {university.website && (
                  <a href={university.website} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-white transition-colors">
                    <ExternalLink className="h-4 w-4 mr-1" /> Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-between items-end mb-8">
          <h2 className="font-serif text-2xl font-bold">Courses & Modules</h2>
          <Button asChild>
            <Link href={`/search?universityId=${university.id}`}>View all listings</Link>
          </Button>
        </div>

        {university.courses && university.courses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {university.courses.map((course) => (
              <Card key={course.id} className="hover-elevate">
                <CardContent className="p-6">
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                    {course.level || 'Undergraduate'}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{course.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{course.faculty}</p>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/search?universityId=${university.id}&courseId=${course.id}`}>
                      Find Resources
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-xl border">
            <p className="text-muted-foreground">Course data is currently being populated for this university.</p>
          </div>
        )}
      </div>
    </div>
  );
}
