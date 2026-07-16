import { useState } from 'react';
import { useGetAdminUniversities, getGetAdminUniversitiesQueryKey } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Search, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SortKey = 'name' | 'creatorCount' | 'status';

export default function AdminUniversities() {
  const { data: response, isLoading } = useGetAdminUniversities({
    query: { queryKey: getGetAdminUniversitiesQueryKey() },
  });

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('creatorCount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const universities = ((response?.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    website?: string;
    creatorCount: number;
    createdAt?: string;
  }>);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'creatorCount' ? 'desc' : 'asc');
    }
  }

  const filtered = universities
    .filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'creatorCount') cmp = a.creatorCount - b.creatorCount;
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const SortButton = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(col)}
      className="flex items-center gap-1 text-left font-semibold hover:text-primary transition-colors"
    >
      {label}
      <ArrowUpDown className={`h-3.5 w-3.5 ${sortKey === col ? 'text-primary' : 'text-muted-foreground'}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif mb-1 flex items-center gap-3">
          <GraduationCap className="h-7 w-7" />
          Universities
        </h1>
        <p className="text-muted-foreground">
          All enrolled universities — {universities.length} total
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter universities…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading universities…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No universities found.</div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3">
                  <SortButton col="name" label="University" />
                </th>
                <th className="text-left px-4 py-3">
                  <SortButton col="status" label="Status" />
                </th>
                <th className="text-right px-4 py-3">
                  <SortButton col="creatorCount" label="Aces" />
                </th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Website</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(uni => (
                <tr key={uni.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{uni.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={uni.status === 'active' ? 'default' : 'secondary'}>
                      {uni.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {uni.creatorCount}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {uni.website ? (
                      <a
                        href={uni.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate max-w-[200px] block"
                      >
                        {uni.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
