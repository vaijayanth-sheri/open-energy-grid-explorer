/**
 * ConnectionBreadcrumbs — Shows upstream path from an asset to generators.
 */

import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useNetwork } from '../hooks/useApi';
import { useApp } from '../context/AppContext';

export default function ConnectionBreadcrumbs({ assetId }) {
    const { data: network } = useNetwork();
    const { selectAsset } = useApp();

    const path = useMemo(() => {
        if (!network || !assetId) return [];

        const { nodes, edges } = network;
        const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

        // BFS backwards (where this asset is the target) to find generators
        const parentOf = {};
        for (const edge of edges) {
            // edge.source → edge.target (flow direction)
            // Multiple targets can have the same source, but each target generally has one source
            if (!parentOf[edge.target]) {
                parentOf[edge.target] = edge.source;
            }
        }

        // Walk upstream from assetId
        const trail = [assetId];
        let current = assetId;
        const visited = new Set([current]);

        while (parentOf[current] && !visited.has(parentOf[current])) {
            current = parentOf[current];
            visited.add(current);
            trail.unshift(current);
        }

        return trail.map((id) => nodeMap[id]).filter(Boolean);
    }, [network, assetId]);

    if (path.length <= 1) return null;

    return (
        <div className="flex flex-wrap items-center gap-1 text-xs">
            {path.map((node, i) => (
                <span key={node.id} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight size={12} className="text-slate-600" />}
                    <button
                        onClick={() => selectAsset(node.id)}
                        className={`px-1.5 py-0.5 rounded transition-colors ${node.id === assetId
                                ? 'bg-slate-700 text-white font-medium'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                    >
                        {node.name}
                    </button>
                </span>
            ))}
        </div>
    );
}
