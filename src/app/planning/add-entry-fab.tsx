'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2, AlertCircle, Map, Radar, ShieldAlert, X } from 'lucide-react';
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
  const [mainKeyword, setMainKeyword] = useState<'Y' | 'N'>('N');
  const [articleCount, setArticleCount] = useState('');
  const [avgProductValue, setAvgProductValue] = useState('');
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
    setMainKeyword('N');
    setArticleCount('');
    setAvgProductValue('');
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
          Main_Keyword: mainKeyword,
          Article_Count: articleCount ? Number(articleCount) : undefined,
          Avg_Product_Value: avgProductValue ? Number(avgProductValue) : undefined,
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Speichern des Eintrags');
      }

      setOpen(false);
      resetForm();
      window.dispatchEvent(new CustomEvent('refresh-planning-data'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) return; // Prevent closing via onOpenChange (outside click/escape)
    setOpen(newOpen);
  };

  const closeDialog = () => {
    setOpen(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-xl bg-[#00463c] hover:bg-[#00332c] text-white z-50"
            size="icon"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-6 w-6" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-[#00463c] flex items-center gap-2 font-bold text-xl">
              {type === 'keyword' && 'Neues Keyword hinzufügen'}
              {type === 'trend' && 'Neuen Trend hinzufügen'}
              {type === 'blacklist' && 'Keyword blacklisten'}
              {!['keyword', 'trend', 'blacklist'].includes(type) && 'Neuen Eintrag hinzufügen'}
            </DialogTitle>
            <DialogDescription className="text-base">
              Füllen Sie die erforderlichen Felder aus, um den Eintrag zu speichern.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            {type === 'keyword' && (
              <>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="keyword" className="text-sm font-semibold">Keyword *</Label>
                    <Input
                      id="keyword"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="z.B. Vitamin C"
                      className="h-11 text-base"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url" className="text-sm font-semibold">Target URL *</Label>
                    <Input
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      className="h-11 text-base"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="volume" className="text-sm font-semibold">Suchvolumen</Label>
                    <Input
                      id="volume"
                      type="number"
                      value={volume}
                      onChange={(e) => setVolume(e.target.value)}
                      className="h-11 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="difficulty" className="text-sm font-semibold">Difficulty (0-100)</Label>
                    <Input
                      id="difficulty"
                      type="number"
                      min="0"
                      max="100"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="h-11 text-base"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="mainKeyword" className="text-sm font-semibold">Main Keyword *</Label>
                    <Select value={mainKeyword} onValueChange={(v) => setMainKeyword(v as 'Y' | 'N')}>
                      <SelectTrigger id="mainKeyword" className="h-11 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Y">Ja (Y)</SelectItem>
                        <SelectItem value="N">Nein (N)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="articleCount" className="text-sm font-semibold">Produkt-Anzahl</Label>
                    <Input
                      id="articleCount"
                      type="number"
                      value={articleCount}
                      onChange={(e) => setArticleCount(e.target.value)}
                      className="h-11 text-base"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avgProductValue" className="text-sm font-semibold">Avg. Product Value</Label>
                  <Input
                    id="avgProductValue"
                    type="number"
                    step="0.01"
                    value={avgProductValue}
                    onChange={(e) => setAvgProductValue(e.target.value)}
                    className="h-11 text-base"
                  />
                </div>
              </>
            )}

            {type === 'trend' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="trendTopic" className="text-sm font-semibold">Trend-Thema *</Label>
                  <Input
                    id="trendTopic"
                    value={trendTopic}
                    onChange={(e) => setTrendTopic(e.target.value)}
                    placeholder="z.B. Bio-Hacking"
                    className="h-11 text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source" className="text-sm font-semibold">Quelle *</Label>
                  <Select value={source} onValueChange={(v) => setSource(v as 'GSC' | 'Sistrix')}>
                    <SelectTrigger id="source" className="h-11 text-base">
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
                  <Label htmlFor="blKeyword" className="text-sm font-semibold">Keyword *</Label>
                  <Input
                    id="blKeyword"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="z.B. Konkurrenzmarke"
                    className="h-11 text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason" className="text-sm font-semibold">Grund *</Label>
                  <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="z.B. Rechtliche Einschränkungen"
                    className="h-11 text-base"
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

          <DialogFooter className="flex gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={loading}
              size="sm"
              className="px-4"
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="bg-[#00463c] hover:bg-[#00332c] text-white px-6"
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
