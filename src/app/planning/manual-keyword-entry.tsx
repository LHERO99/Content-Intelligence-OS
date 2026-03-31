'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';

export function ManualKeywordEntry() {
  const [keyword, setKeyword] = useState('');
  const [url, setUrl] = useState('');
  const [volume, setVolume] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!keyword || !url) {
      setError('Keyword und Target_URL sind Pflichtfelder.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/planning/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Keyword: keyword,
          Target_URL: url,
          Search_Volume: volume ? Number(volume) : undefined,
          Difficulty: difficulty ? Number(difficulty) : undefined,
          Status: 'Backlog',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Speichern des Keywords');
      }

      setSuccess(true);
      setKeyword('');
      setUrl('');
      setVolume('');
      setDifficulty('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-[#00463c]/10">
      <CardHeader className="bg-[#e7f3ee]/50">
        <CardTitle className="text-sm font-medium text-[#00463c] flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Manuelle Keyword-Eingabe
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="keyword">Keyword <span className="text-red-500">*</span></Label>
              <Input
                id="keyword"
                placeholder="z.B. Vitamin C Serum"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                required
                className="border-[#00463c]/20 focus-visible:ring-[#00463c]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Target URL <span className="text-red-500">*</span></Label>
              <Input
                id="url"
                placeholder="https://www.docmorris.de/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="border-[#00463c]/20 focus-visible:ring-[#00463c]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="volume">Suchvolumen</Label>
              <Input
                id="volume"
                type="number"
                placeholder="z.B. 1200"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="border-[#00463c]/20 focus-visible:ring-[#00463c]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty (0-100)</Label>
              <Input
                id="difficulty"
                type="number"
                min="0"
                max="100"
                placeholder="z.B. 45"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="border-[#00463c]/20 focus-visible:ring-[#00463c]"
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fehler</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200 text-green-800">
              <AlertTitle>Erfolg</AlertTitle>
              <AlertDescription>Das Keyword wurde erfolgreich zur Map hinzugefügt.</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#00463c] hover:bg-[#00332c] text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gespeichert...
              </>
            ) : (
              'Keyword hinzufügen'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
