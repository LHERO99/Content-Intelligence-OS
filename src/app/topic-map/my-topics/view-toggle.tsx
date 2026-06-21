"use client";

import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/use-i18n';
import { Network, TreePine, TableIcon } from 'lucide-react';

export type ViewType = 'sunburst' | 'tree' | 'table';

interface Props {
  view: ViewType;
  onChange: (v: ViewType) => void;
}

export function ViewToggle({ view, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-1 border rounded-md p-1">
      <Button
        variant={view === 'sunburst' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 gap-1.5"
        onClick={() => onChange('sunburst')}
      >
        <Network className="h-3.5 w-3.5" />
        {t('topicMap.viewSunburst')}
      </Button>
      <Button
        variant={view === 'tree' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 gap-1.5"
        onClick={() => onChange('tree')}
      >
        <TreePine className="h-3.5 w-3.5" />
        {t('topicMap.viewTree')}
      </Button>
      <Button
        variant={view === 'table' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 gap-1.5"
        onClick={() => onChange('table')}
      >
        <TableIcon className="h-3.5 w-3.5" />
        {t('topicMap.viewTable')}
      </Button>
    </div>
  );
}
