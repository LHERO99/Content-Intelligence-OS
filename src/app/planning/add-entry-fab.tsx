'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2, AlertCircle, Map, Radar, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';

type EntryType = 'keyword' | 'trend' | 'blacklist';

interface AddEntryFabProps {
  activeTab?: string;
}

export function AddEntryFab({ activeTab }: AddEntryFabProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EntryType>('keyword');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Form states
  const [keyword, setKeyword] = useState('');
  const [url, setUrl] = useState('');
  const [volume, setVolume] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [trendTopic, setTrendTopic] = useState('');
  const [source, setSource] = useState<'GSC' | 'Sistrix'>('GSC');
  const [reason, setReason] = useState('');

  // Sync type with active tab
  useEffect(() => {
    if (!open) return; // Only sync when opening
    if (activeTab === 'keyword-map') setType('keyword');
    else if (activeTab === 'trend-radar') setType('trend');
    else if (activeTab === 'blacklist') setType('blacklist');
    else setType('keyword'); // Default for editorial or others
  }, [activeTab, open]);

  const resetForm = () => {
    setKeyword('');
    setUrl('');
    setVolume('');
    setDifficulty('');
    setTrendTopic('');
    setSource('GSC');
    setReason('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let endpoint = '';
      let body = {};

      if (type === 'keyword') {
        if (!keyword || !url) throw new Error('Keyword und Target URL sind erforderlich.');
        endpoint = '/api/planning/keywords';
        body = {
          Keyword: keyword,
          Target_URL: url,
          Search_Volume: volume ? Number(volume) : undefined,
          Difficulty: difficulty ? Number(difficulty) : undefined,
          Status: 'Backlog',
        };
      } else if (type === 'trend') {
        if (!trendTopic || !source) throw new Error('Trend-Thema und Quelle sind erforderlich.');
        endpoint = '/api/planning/trends';
        body = {
          Trend_Topic: trendTopic,
          Source: source,
          Status: 'New',
        };
      } else if (type === 'blacklist') {
        if (!keyword || !reason) throw new Error('Keyword und Grund sind erforderlich.');
        endpoint = '/api/planning/blacklist';
        body = {
          Keyword: keyword,
          Reason: reason,
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Speichern des Eintrags');
      }

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
      <DialogTrigger
        render={
          <Button
            className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-xl bg-[#00463c] hover:bg-[#00332c] text-white z-50"
            size="icon"
          />
        }
      >
        <Plus className="h-6 w-6" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-[#00463c] flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Neuen Eintrag hinzufügen
            </DialogTitle>
            <DialogDescription>
              Wählen Sie den Typ und füllen Sie die erforderlichen Felder aus.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type">Eintragstyp</Label>
              <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
                <SelectTrigger id="type" className="border-[#00463c]/20">
                  <SelectValue placeholder="Typ auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">
                    <div className="flex items-center gap-2">
                      <Map className="h-4 w-4" />
                      <span>Keyword-Map</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="trend">
                    <div className="flex items-center gap-2">
                      <Radar className="h-4 w-4" />
                      <span>Trend-Radar</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="blacklist">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      <span>Blacklist</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === 'keyword' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyword">Keyword *</Label>
                    <Input
                      id="keyword"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="z.B. Vitamin C"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">Target URL *</Label>
                    <Input
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="volume">Suchvolumen</Label>
                    <Input
                      id="volume"
                      type="number"
                      value={volume}
                      onChange={(e) => setVolume(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="difficulty">Difficulty (0-100)</Label>
                    <Input
                      id="difficulty"
                      type="number"
                      min="0"
                      max="100"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {type === 'trend' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="trendTopic">Trend-Thema *</Label>
                  <Input
                    id="trendTopic"
                    value={trendTopic}
                    onChange={(e) => setTrendTopic(e.target.value)}
                    placeholder="z.B. Bio-Hacking"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source">Quelle *</Label>
                  <Select value={source} onValueChange={(v) => setSource(v as 'GSC' | 'Sistrix')}>
                    <SelectTrigger id="source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GSC">Google Search Console</SelectItem>
                      <SelectItem value="Sistrix">Sistrix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {type === 'blacklist' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="blKeyword">Keyword *</Label>
                  <Input
                    id="blKeyword"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="z.B. Konkurrenzmarke"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Grund *</Label>
                  <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="z.B. Rechtliche Einschränkungen"
                    required
                  />
                </div>
              </>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Fehler</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#00463c] hover:bg-[#00332c] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Speichern...
                </>
              ) : (
                'Hinzufügen'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
