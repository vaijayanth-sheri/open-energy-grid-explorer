/**
 * TanStack Query hooks for all API data.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAssets, fetchAssetDetail, fetchAssetMetrics, fetchNetwork, toggleRmu } from '../services/api';

export function useAssets() {
    return useQuery({
        queryKey: ['assets'],
        queryFn: fetchAssets,
        staleTime: 30_000,
    });
}

export function useAssetDetail(id) {
    return useQuery({
        queryKey: ['asset', id],
        queryFn: () => fetchAssetDetail(id),
        enabled: !!id,
        staleTime: 60_000,
    });
}

export function useAssetMetrics(id) {
    return useQuery({
        queryKey: ['metrics', id],
        queryFn: () => fetchAssetMetrics(id),
        enabled: !!id,
        refetchInterval: 5_000,
        staleTime: 4_000,
    });
}

/* ------------------------------------------------------------------ */
/* Network Topology Pre-computation                                    */
/* ------------------------------------------------------------------ */

function processNetworkTopology(data) {
    if (!data || !data.nodes || !data.edges) return data;

    const downstreamMap = {};
    const upstreamMap = {};
    
    // Initialize maps
    data.nodes.forEach(n => {
        downstreamMap[n.id] = [];
        upstreamMap[n.id] = [];
    });

    // Populate direct connections
    data.edges.forEach(edge => {
        if (downstreamMap[edge.source]) downstreamMap[edge.source].push(edge.target);
        if (upstreamMap[edge.target]) upstreamMap[edge.target].push(edge.source);
    });

    // Attach to nodes
    const enrichedNodes = data.nodes.map(node => ({
        ...node,
        downstream: downstreamMap[node.id] || [],
        upstream: upstreamMap[node.id] || []
    }));

    // Grouping assets hierarchically for the Explorer
    const groups = {
        generation: enrichedNodes.filter(n => n.type.startsWith('generator')),
        hv: enrichedNodes.filter(n => n.voltage_level === 'HV' && !n.type.startsWith('generator')),
        mv: enrichedNodes.filter(n => n.voltage_level === 'MV'),
        lv: enrichedNodes.filter(n => n.voltage_level === 'LV' && n.type !== 'consumer'),
        consumers: enrichedNodes.filter(n => n.type === 'consumer'),
    };

    return { ...data, nodes: enrichedNodes, groups, downstreamMap, upstreamMap };
}

export function useNetwork() {
    return useQuery({
        queryKey: ['network'],
        queryFn: async () => {
            const data = await fetchNetwork();
            return processNetworkTopology(data);
        },
        staleTime: Infinity,
    });
}

/** Mutation hook to toggle RMU state. Invalidates asset + metrics queries. */
export function useToggleRmu() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (rmuId) => toggleRmu(rmuId),
        onSuccess: (_data, rmuId) => {
            queryClient.invalidateQueries({ queryKey: ['asset', rmuId] });
            queryClient.invalidateQueries({ queryKey: ['metrics'] });
            queryClient.invalidateQueries({ queryKey: ['assets'] });
        },
    });
}
