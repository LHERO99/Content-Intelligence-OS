"use client";

import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TopicClusterWithStats } from '@/lib/db/topic-journey-types';

interface Props {
  clusters: TopicClusterWithStats[];
  onClusterClick: (id: string) => void;
}

export function ClusterTree({ clusters, onClusterClick }: Props) {
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = [];
    const e: Edge[] = [];

    // Root node
    n.push({
      id: 'root',
      type: 'default',
      position: { x: 0, y: 0 },
      data: { label: 'Topic Map' },
      style: { background: '#6366f1', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 700, padding: '8px 16px' },
    });

    const angleStep = (2 * Math.PI) / Math.max(clusters.length, 1);
    const radius = Math.min(280, 80 + clusters.length * 30);

    clusters.forEach((cluster, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      n.push({
        id: cluster.id,
        type: 'default',
        position: { x, y },
        data: {
          label: (
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
              onClick={() => onClusterClick(cluster.id)}
            >
              {cluster.name}
              <br />
              <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.7 }}>
                {cluster.urlCount} URLs · {cluster.ideaCount} Ideen
              </span>
            </button>
          ),
        },
        style: {
          background: cluster.color + '22',
          border: `2px solid ${cluster.color}`,
          borderRadius: 8,
          padding: '6px 12px',
          minWidth: 120,
        },
      });

      e.push({
        id: `root-${cluster.id}`,
        source: 'root',
        target: cluster.id,
        style: { stroke: cluster.color, strokeWidth: 2 },
      });
    });

    return { nodes: n, edges: e };
  }, [clusters, onClusterClick]);

  return (
    <div className="w-full border rounded-lg overflow-hidden bg-background" style={{ height: 520 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        attributionPosition="bottom-right"
        nodesDraggable={false}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
