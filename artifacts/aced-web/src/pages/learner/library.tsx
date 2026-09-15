import { useGetMyLibrary, useGetAssetDownloadUrl } from '@workspace/api-client-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Download, FileText, Search, Video, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function Library() {
  const { data: response, isLoading } = useGetMyLibrary();
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const downloadUrlMutation = useGetAssetDownloadUrl();
  const { toast } = useToast();

  const handleDownloadAsset = (assetId: string, fileName: string) => {
    setDownloadingId(assetId);
    downloadUrlMutation.mutate(
      { id: assetId },
      {
        onSuccess: (data) => {
          if (data.data.url) {
            const a = document.createElement('a');
            a.href = data.data.url;
            a.download = data.data.fileName || fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast({
              title: 'Download started',
              description: `Downloading ${fileName}`,
            });
          }
        },
        onError: () => {
          toast({
            title: 'Download failed',
            description: 'Could not generate download link. Please try again later.',
            variant: 'destructive',
          });
        },
        onSettled: () => setDownloadingId(null),
      },
    );
  };

  const libraryItems = response?.data || [];

  const filteredItems = libraryItems.filter(
    (item: any) =>
      !searchQuery || item.listing?.title?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif">My Library</h1>
          <p className="text-muted-foreground">
            Access your purchased digital products and course materials.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your library..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-xl border"></div>
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item: any) => {
            const files: Array<{ assetId: string; fileName: string }> =
              item.files?.length > 0
                ? item.files
                : item.assetId || item.product?.paidAssetId
                  ? [
                      {
                        assetId: item.assetId ?? item.product.paidAssetId,
                        fileName: item.listing?.title || 'download',
                      },
                    ]
                  : [];

            return (
              <Card key={item.id} className="flex flex-col h-full hover-elevate overflow-hidden">
                <div className="aspect-video bg-muted border-b flex items-center justify-center relative">
                  {item.listing?.type === 'recorded_course' ? (
                    <Video className="h-12 w-12 text-muted-foreground/30" />
                  ) : (
                    <FileText className="h-12 w-12 text-muted-foreground/30" />
                  )}
                </div>
                <CardHeader className="p-4 pb-2">
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                    {item.listing?.type?.replace('_', ' ') || 'Digital Product'}
                  </div>
                  <CardTitle className="text-lg line-clamp-2 leading-snug">
                    {item.listing?.title || 'Untitled Resource'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex-1">
                  <p className="text-sm text-muted-foreground mb-4">
                    Creator: {item.creator?.displayName || 'Unknown'}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Purchased on {format(new Date(item.createdAt), 'MMM d, yyyy')}
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0 border-t bg-muted/10 flex flex-col gap-2">
                  {files.length > 0 ? (
                    files.map((f) => (
                      <Button
                        key={f.assetId}
                        className="w-full"
                        variant="default"
                        onClick={() => handleDownloadAsset(f.assetId, f.fileName)}
                        disabled={downloadUrlMutation.isPending && downloadingId === f.assetId}
                      >
                        {downloadingId === f.assetId ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        {files.length === 1 ? 'Download' : f.fileName}
                      </Button>
                    ))
                  ) : (
                    <Button className="w-full mt-4" variant="default" disabled>
                      <Download className="mr-2 h-4 w-4" /> File unavailable
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-background shadow-sm">
          <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-bold mb-2">No materials found</h3>
          <p className="text-muted-foreground max-w-md">
            {searchQuery
              ? 'No items match your search query.'
              : "You haven't purchased any digital materials yet."}
          </p>
        </div>
      )}
    </div>
  );
}
