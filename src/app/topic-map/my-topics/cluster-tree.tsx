"use client";

import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TopicClusterWithStats } from '@/lib/db/topic-journey-types';
import { buildClusterTree } from '@/features/topic-map/hooks/use-topic-clusters';

interface Props {
  clusters: TopicClusterWithStats[];
  onClusterClick: (id: string) => void;
}

const X_GAP = 200;
const Y_GAP = 120;

/** Recursively place nodes in a top-down tree layout */
function layoutTree(
  node: TopicClusterWithStats,
  depth: number,
  xOffset: number,
  counters: { x: number },
  nodes: Node[],
  edges: Edge[],
  onClusterClick: (id: string) => void,
  parentId?: string,
): number {
  const isLeaf = node.children.length === 0;
  let subtreeWidth: number;

  if (isLeaf) {
    subtreeWidth = 1;
  } else {
    let totalChildWidth = 0;
    let childX = xOffset;
    for (const child of node.children) {
      const w = layoutTree(child, depth + 1, childX, counters, nodes, edges, onClusterClick, node.id);
      totalChildWidth += w;
      childX += w * X_GAP;
    }
    subtreeWidth = totalChildWidth;
  }

  const x = xOffset + ((subtreeWidth - 1) / 2) * X_GAP;
  const y = depth * Y_GAP;

  nodes.push({
    id: node.id,
    type: 'default',
    position: { x, y },
    data: {
      label: (
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
          onClick={() => onClusterClick(node.id)}
        >
          {node.name}
          <br />
          <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.7 }}>
            {node.urlCount} URLs · {node.ideaCount} Ideen
          </span>
        </button>
      ),
    },
    style: {
      background: node.color + '22',
      border: `2px solid ${node.color}`,
      borderRadius: 8,
      padding: '6px 12px',
      minWidth: 130,
    },
  });

  if (parentId) {
    edges.push({
      id: `${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      style: { stroke: node.color, strokeWidth: 2 },
    });
  }

  return subtreeWidth;
}

export function ClusterTree({ clusters, onClusterClick }: Props) {
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = [];
    const e: Edge[] = [];

    const tree = buildClusterTree(clusters);

    if (tree.length === 0) return { nodes: n, edges: e };

    // Root "Topic Map" node
    const totalRoots = tree.length;
    const rootSpan = totalRoots * X_GAP;

    n.push({
      id: 'root',
      type: 'default',
      position: { x: rootSpan / 2 - 60, y: -Y_GAP },
      data: { label: 'Topic Map' },
      style: { background: '#6366f1', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 700, padding: '8px 16px' },
    });

    let xCursor = 0;
    for (const rootCluster of tree) {
      const width = layoutTree(rootCluster, 0, xCursor, { x: 0 }, n, e, onClusterClick, 'root');
      e.push({
        id: `root-${rootCluster.id}`,
        source: 'root',
        target: rootCluster.id,
        style: { stroke: rootCluster.color, strokeWidth: 2 },
      });
      xCursor += width * X_GAP;
    }

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
