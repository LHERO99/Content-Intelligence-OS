'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAlerts } from '@/components/alerts-provider';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BlacklistReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  keywords: { id: string; Keyword: string; Target_URL?: string }[];
}

export function BlacklistReasonModal({
  isOpen,
  onClose,
  onSuccess,
  keywords,
}: BlacklistReasonModalProps) {
  const [reason, setReason] = React.useState('');
  const [type, setType] = React.useState<'Keyword' | 'URL'>('Keyword');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { addAlert } = useAlerts();

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Bitte geben Sie einen Grund an.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/planning/blacklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords,
          keywordIds: keywords.map((k) => k.id),
          Reason: reason,
          Type: type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Blacklisten.');
      }

      addAlert({
        message: 'Erfolg',
        description: `${keywords.length} ${type === 'Keyword' ? 'Keyword(s)' : 'URL(s)'} wurden zur Blacklist hinzugefügt.`,
        type: 'success',
      });
      
      setReason('');
      setError(null);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[BlacklistModal] Error:', error);
      setError(error.message || 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setError(null);
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Zur Blacklist hinzufügen</DialogTitle>
          <DialogDescription>
            Wählen Sie den Typ und geben Sie einen Grund an.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="type">Blacklist-Typ *</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Typ wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Keyword">Keyword</SelectItem>
                <SelectItem value="URL">URL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">Grund *</Label>
            <Input
              id="reason"
              placeholder="z.B. Nicht relevant für DocMorris, Markenrechtliche Bedenken..."
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              className={error ? 'border-destructive' : ''}
            />
          </div>
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {keywords.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">
                Betroffene {type === 'Keyword' ? 'Keywords' : 'URLs'}:
              </p>
              <ul className="list-disc list-inside max-h-32 overflow-y-auto">
                {keywords.map((k) => (
                  <li key={k.id} className="truncate">
                    {type === 'Keyword' ? k.Keyword : (k.Target_URL || 'Keine URL')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-[#00463c] hover:bg-[#00332c]">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Bestätigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
