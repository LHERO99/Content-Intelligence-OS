import type { Metadata } from 'next';
import { TopicMapTabs } from './topic-map-tabs';

export const metadata: Metadata = {
  title: 'Topic Map | Plexaro',
};

export default function TopicMapPage() {
  return <TopicMapTabs />;
}
