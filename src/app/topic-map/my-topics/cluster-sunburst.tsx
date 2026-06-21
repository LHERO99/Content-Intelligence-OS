"use client";

import { useEffect, useRef } from 'react';
import { TopicClusterWithStats } from '@/lib/db/topic-journey-types';

// Lazy-load ECharts to avoid SSR issues
let echarts: any = null;

interface Props {
  clusters: TopicClusterWithStats[];
  onClusterClick: (id: string) => void;
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

      const data = clusters.map((c) => ({
        name: c.name,
        value: c.totalSearchVolume || c.urlCount || 1,
        itemStyle: { color: c.color },
        _clusterId: c.id,
      }));

      chart.setOption({
        series: [{
          type: 'sunburst',
          data,
          radius: ['20%', '80%'],
          itemStyle: { borderWidth: 2, borderColor: '#fff' },
          label: {
            show: true,
            rotate: 'radial',
            fontSize: 11,
          },
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
