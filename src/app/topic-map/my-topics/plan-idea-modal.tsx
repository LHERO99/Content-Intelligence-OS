"use client";

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/i18n/use-i18n';
import { TopicIdea } from '@/lib/db/topic-journey-types';
import { toast } from 'sonner';

interface UrlOption { id: string; url: string; }

interface Props {
  open: boolean;
  idea: TopicIdea;
  clusterId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PlanIdeaModal({ open, idea, clusterId, onClose, onSuccess }: Props) {
  const { t } = useI18n();
  const [urlMode, setUrlMode] = useState<'existing' | 'new'>('new');
  const [selectedUrlId, setSelectedUrlId] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [pageType, setPageType] = useState<string>('Ratgeber');
  const [priority, setPriority] = useState<string>('medium');
  const [isMainKeyword, setIsMainKeyword] = useState(true);
  const [existingUrls, setExistingUrls] = useState<UrlOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      // Load existing URLs
      fetch('/api/planning/keywords')
        .then((r) => r.json())
        .then((data: any[]) => {
          const unique = new Map<string, string>();
          data.forEach((k) => { if (k.Target_URL) unique.set(k.id, k.Target_URL); });
          setExistingUrls(Array.from(unique.entries()).map(([id, url]) => ({ id, url })));
        })
        .catch(() => {});
    }
  }, [open]);

  const handleSubmit = async () => {
    if (urlMode === 'new' && !newUrl.trim()) {
      toast.error('Bitte URL eingeben');
      return;
    }
    if (urlMode === 'existing' && !selectedUrlId) {
      toast.error('Bitte URL auswählen');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/topic-clusters/${clusterId}/ideas/${idea.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: idea.keyword,
          isMainKeyword,
          urlMode,
          urlId:   urlMode === 'existing' ? selectedUrlId : undefined,
          newUrl:  urlMode === 'new' ? newUrl.trim() : undefined,
          pageType,
          priority,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Fehler beim Speichern');
      }

      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('planIdeaModal.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-muted rounded-md">
            <div className="font-medium">{idea.keyword}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {idea.searchVolume ? `${idea.searchVolume.toLocaleString('de-DE')} SV` : ''}
              {idea.keywordDifficulty ? ` · KD ${idea.keywordDifficulty}` : ''}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="mainKw"
              checked={isMainKeyword}
              onCheckedChange={(v) => setIsMainKeyword(!!v)}
            />
            <Label htmlFor="mainKw">{t('planIdeaModal.isMainKeyword')}</Label>
          </div>

          <div className="space-y-2">
            <Label>{t('planIdeaModal.targetUrl')}</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="urlMode"
                  value="new"
                  checked={urlMode === 'new'}
                  onChange={() => setUrlMode('new')}
                />
                {t('planIdeaModal.enterNewUrl')}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="urlMode"
                  value="existing"
                  checked={urlMode === 'existing'}
                  onChange={() => setUrlMode('existing')}
                />
                {t('planIdeaModal.selectExistingUrl')}
              </label>
            </div>

            {urlMode === 'new' ? (
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/ratgeber/vitamin-c"
              />
            ) : (
              <Select value={selectedUrlId} onValueChange={(v) => setSelectedUrlId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="URL auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {existingUrls.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.url}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('planIdeaModal.pageType')}</Label>
              <Select value={pageType} onValueChange={(v) => setPageType(v ?? 'Ratgeber')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Ratgeber', 'Kategorie', 'Marke', 'Produkt'].map((pt) => (
                    <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('planIdeaModal.priority')}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? 'medium')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="low">Niedrig</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('planIdeaModal.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Speichern...' : t('planIdeaModal.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
