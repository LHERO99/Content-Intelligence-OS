"use client";

import { useEffect, useRef } from 'react';
import { TopicClusterWithStats } from '@/lib/db/topic-journey-types';
import { buildClusterTree } from '@/features/topic-map/hooks/use-topic-clusters';

// Lazy-load ECharts to avoid SSR issues
let echarts: any = null;

interface Props {
  clusters: TopicClusterWithStats[];
  onClusterClick: (id: string) => void;
}

/** Recursively converts a TopicClusterWithStats tree into ECharts sunburst data */
function toSunburstData(node: TopicClusterWithStats): any {
  return {
    name: node.name,
    value: node.totalSearchVolume || node.urlCount || 1,
    itemStyle: { color: node.color },
    _clusterId: node.id,
    children: node.children.length > 0
      ? node.children.map(toSunburstData)
      : undefined,
  };
}

export function ClusterSunburst({ clusters, onClusterClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    async function initChart() {
      if (!containerRef.current) return;

      if (!echarts) {
        const mod = await import('echarts');
        echarts = mod;
      }

      if (!mounted) return;

      const chart = echarts.init(containerRef.current, undefined, { renderer: 'svg' });
      chartRef.current = chart;

      // Build tree and map to sunburst data
      const tree = buildClusterTree(clusters);
      const data = tree.map(toSunburstData);

      chart.setOption({
        series: [{
          type: 'sunburst',
          data,
          radius: ['15%', '85%'],
          itemStyle: { borderWidth: 2, borderColor: '#fff' },
          label: {
            show: true,
            rotate: 'radial',
            fontSize: 11,
          },
          levels: [
            {},  // centre (unused)
            { r0: '15%', r: '50%', label: { rotate: 'tangential' } },  // root clusters
            { r0: '50%', r: '75%', label: { align: 'right' } },        // level-2
            { r0: '75%', r: '85%', label: { position: 'outside' } },   // level-3+
          ],
          emphasis: {
            focus: 'ancestor',
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' },
          },
        }],
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const d = params.data;
            return `${d.name}<br/>Suchvolumen: ${d.value?.toLocaleString('de-DE') ?? 0}`;
          },
        },
      });

      chart.on('click', (params: any) => {
        const clusterId = params.data?._clusterId;
        if (clusterId) onClusterClick(clusterId);
      });

      const observer = new ResizeObserver(() => chart.resize());
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }

    initChart();
    return () => { mounted = false; };
  }, [clusters, onClusterClick]);

  return (
    <div className="w-full border rounded-lg overflow-hidden bg-background">
      <div ref={containerRef} style={{ height: 520, width: '100%' }} />
    </div>
  );
}
