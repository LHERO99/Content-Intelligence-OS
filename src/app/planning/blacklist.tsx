'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { BlacklistEntry } from '@/lib/airtable-types';

export function Blacklist() {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBlacklist() {
      try {
        const response = await fetch('/api/planning/blacklist');
        if (!response.ok) throw new Error('Fehler beim Laden der Blacklist');
        const data = await response.json();
        setBlacklist(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchBlacklist();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#00463c]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[#00463c]">
          <ShieldAlert className="h-6 w-6" />
          <h3 className="text-xl font-semibold">Blacklist</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Keywords, die explizit von der Planung ausgeschlossen wurden.
        </p>
      </div>

      <Card className="border-[#00463c]/10 overflow-hidden">
        <CardHeader className="bg-[#e7f3ee]/50">
          <CardTitle className="text-sm font-medium text-[#00463c]">Ausgeschlossene Keywords</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-[#00463c]/10">
                  <TableHead className="text-[#00463c] font-bold whitespace-nowrap">Keyword</TableHead>
                  <TableHead className="text-[#00463c] font-bold whitespace-nowrap">Grund</TableHead>
                  <TableHead className="text-[#00463c] font-bold whitespace-nowrap">Hinzugefügt am</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blacklist.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Keine Einträge in der Blacklist gefunden.
                    </TableCell>
                  </TableRow>
                ) : (
                  blacklist.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-[#e7f3ee]/20 border-[#00463c]/5">
                      <TableCell className="font-medium whitespace-nowrap">{entry.Keyword}</TableCell>
                      <TableCell className="whitespace-nowrap">{entry.Reason || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {entry.Added_At ? new Date(entry.Added_At).toLocaleDateString('de-DE') : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
