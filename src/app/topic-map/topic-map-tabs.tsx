"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MyTopicsTab } from './my-topics/my-topics-tab';
import { DiscoveryPanel } from './discovery/discovery-panel';
import { useI18n } from '@/i18n/use-i18n';
import { Network } from 'lucide-react';

export function TopicMapTabs() {
  const { t } = useI18n();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Network className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t('topicMap.title')}</h1>
      </div>

      <Tabs defaultValue="my-topics">
        <TabsList>
          <TabsTrigger value="my-topics">{t('topicMap.tabMyTopics')}</TabsTrigger>
          <TabsTrigger value="discovery">{t('topicMap.tabDiscovery')}</TabsTrigger>
        </TabsList>

        <TabsContent value="my-topics" className="mt-6">
          <MyTopicsTab />
        </TabsContent>

        <TabsContent value="discovery" className="mt-6">
          <DiscoveryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
