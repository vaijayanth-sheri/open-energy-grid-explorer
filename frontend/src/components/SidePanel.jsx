/**
 * SidePanel — asset detail, live metrics, RMU switch toggle, connection breadcrumbs.
 */

import { X, Activity, Info, GitBranch, Loader2, Power } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAssetDetail, useAssetMetrics, useToggleRmu, useNetwork } from '../hooks/useApi';
import MetricsChart from './MetricsChart';
import ConnectionBreadcrumbs from './ConnectionBreadcrumbs';

/* ------------------------------------------------------------------ */
/* Visual config                                                       */
/* ------------------------------------------------------------------ */

const TYPE_COLORS = {
    generator: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    transmission_line_hv: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    substation_hv_mv: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    feeder_mv: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    rmu: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    transformer_mv_lv: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    feeder_lv: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    consumer: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const VL_BADGES = {
    HV: 'bg-orange-500/20 text-orange-400',
    MV: 'bg-blue-500/20 text-blue-400',
    LV: 'bg-emerald-500/20 text-emerald-400',
};

function formatKey(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/Mw$/, '(MW)').replace(/Kv$/, '(kV)').replace(/Mva$/, '(MVA)')
        .replace(/Km$/, '(km)').replace(/Pct$/, '(%)').replace(/Kva$/, '(kVA)')
        .replace(/Kw$/, '(kW)');
}

function formatValue(value) {
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
}

/* ------------------------------------------------------------------ */
/* Live values grid                                                    */
/* ------------------------------------------------------------------ */

function LiveValues({ latest }) {
    if (!latest || !latest.values) return null;
    return (
        <div className="grid grid-cols-2 gap-2">
            {Object.entries(latest.values).map(([key, val]) => (
                <div key={key} className="bg-slate-800/50 rounded-lg px-3 py-2 border border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{formatKey(key)}</div>
                    <div className="text-sm font-semibold text-slate-200 font-mono">
                        {typeof val === 'number' ? val.toFixed(2) : String(val)}
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* RMU Switch Button                                                   */
/* ------------------------------------------------------------------ */

function RmuSwitch({ rmuId, currentState }) {
    const { mutate: toggle, isPending } = useToggleRmu();
    const isClosed = currentState === 'closed';

    return (
        <div className="mt-2">
            <div className="flex items-center gap-1.5 mb-2">
                <Power size={13} className="text-slate-500" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Switch Control</span>
            </div>
            <button
                onClick={() => toggle(rmuId)}
                disabled={isPending}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${isClosed
                        ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                        : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
                    }`}
            >
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isClosed ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className={`text-sm font-semibold ${isClosed ? 'text-green-400' : 'text-red-400'}`}>
                        {isPending ? 'Switching…' : isClosed ? 'CLOSED' : 'OPEN'}
                    </span>
                </div>
                <span className="text-xs text-slate-500">
                    {isClosed ? 'Click to open' : 'Click to close'}
                </span>
            </button>
            {!isClosed && (
                <p className="text-[10px] text-red-400/70 mt-1.5 leading-relaxed">
                    ⚠ Downstream assets receive no power while this RMU is open.
                </p>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Topological Connections                                             */
/* ------------------------------------------------------------------ */

function TopologicalConnections({ assetId }) {
    const { data: network } = useNetwork();
    const { selectAsset } = useApp();

    if (!network?.nodes) return null;

    const upstreams = network.upstreamMap[assetId] || [];
    const downstreams = network.downstreamMap[assetId] || [];

    const getAssetName = (id) => {
        const n = network.nodes.find(node => node.id === id);
        return n ? n.name : id;
    };

    if (upstreams.length === 0 && downstreams.length === 0) return null;

    return (
        <div className="mt-4 p-3 bg-slate-900/50 rounded-xl border border-white/5 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                <GitBranch size={13} className="text-slate-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Connected To</span>
            </div>

            {upstreams.length > 0 && (
                <div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Upstream</div>
                    <ul className="space-y-1">
                        {upstreams.map(id => (
                            <li key={`up-${id}`} className="flex items-center before:content-[''] before:w-1 before:h-1 before:bg-slate-700 before:rounded-full before:mr-2">
                                <button onClick={() => selectAsset(id)} className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors text-left hover:underline">
                                    {getAssetName(id)}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {downstreams.length > 0 && (
                <div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 mt-2">Downstream</div>
                    <ul className="space-y-1">
                        {downstreams.map(id => (
                            <li key={`down-${id}`} className="flex items-center before:content-[''] before:w-1 before:h-1 before:bg-slate-700 before:rounded-full before:mr-2">
                                <button onClick={() => selectAsset(id)} className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors text-left hover:underline">
                                    {getAssetName(id)}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* SidePanel                                                           */
/* ------------------------------------------------------------------ */

export default function SidePanel() {
    const { selectedAssetId, clearSelection } = useApp();
    const { data: detail, isLoading: detailLoading } = useAssetDetail(selectedAssetId);
    const { data: metrics, isLoading: metricsLoading } = useAssetMetrics(selectedAssetId);

    if (!selectedAssetId) return null;
    const isLoading = detailLoading && !detail;

    return (
        <div id="side-panel"
            className="absolute top-0 right-0 z-[1000] h-full w-[400px] max-w-[90vw] overflow-y-auto border-l border-white/10 shadow-2xl"
            style={{ background: 'var(--panel-bg)', backdropFilter: 'blur(20px)' }}>

            <button id="close-panel" onClick={clearSelection}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors z-10">
                <X size={16} />
            </button>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-slate-500" size={24} />
                </div>
            ) : detail ? (
                <div className="p-5 space-y-5">
                    {/* Header */}
                    <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${TYPE_COLORS[detail.type] || 'bg-slate-600/20 text-slate-400'
                                }`}>
                                {detail.type.replace(/_/g, ' ')}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${VL_BADGES[detail.voltage_level] || ''
                                }`}>
                                {detail.voltage_level}
                            </span>
                        </div>
                        <h2 className="text-lg font-bold text-white leading-tight">{detail.name}</h2>
                        <p className="text-xs text-slate-500 font-mono mt-1">ID: {detail.id}</p>
                    </div>

                    {/* Connection Breadcrumbs */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <GitBranch size={13} className="text-slate-500" />
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Topological Path</span>
                        </div>
                        <ConnectionBreadcrumbs assetId={selectedAssetId} />
                        <TopologicalConnections assetId={selectedAssetId} />
                    </div>

                    {/* RMU Switch (only for RMUs) */}
                    {detail.type === 'rmu' && detail.metadata?.state && (
                        <RmuSwitch rmuId={detail.id} currentState={detail.metadata.state} />
                    )}

                    {/* Live Metrics */}
                    <div>
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                            <div className="flex items-center gap-1.5">
                                <Activity size={13} className="text-blue-400" />
                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Electrical Parameters</span>
                            </div>
                            <span className="flex items-center gap-1.5 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[9px] font-bold tracking-wider text-green-400 uppercase">LIVE</span>
                            </span>
                        </div>
                        {metricsLoading && !metrics ? (
                            <div className="flex items-center justify-center h-20 text-slate-500 text-sm bg-slate-900/50 rounded-lg">
                                <Loader2 className="animate-spin mr-2" size={14} /> Loading telemetry…
                            </div>
                        ) : metrics ? (
                            <div className="bg-slate-900/30 p-3 rounded-xl border border-white/5">
                                <LiveValues latest={metrics.latest} />
                                <div className="mt-4">
                                    <MetricsChart history={metrics.history} assetType={detail.type} />
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Properties & Geometry */}
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5">
                        <div className="flex items-center gap-1.5 mb-3 border-b border-white/5 pb-2">
                            <Info size={13} className="text-violet-400" />
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Asset Metadata & Geometry</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-start py-1 border-b border-white/5 last:border-0">
                                <span className="text-xs text-slate-400 font-medium">Geometry Type</span>
                                <span className="text-xs text-violet-300 font-mono bg-violet-500/10 px-1.5 py-0.5 rounded">
                                    {(detail.type.includes('feeder') || detail.type.includes('transmission')) ? 'LineString' : 'Point'}
                                </span>
                            </div>
                            {Object.entries(detail.metadata).map(([key, value]) => (
                                <div key={key} className="flex justify-between items-start py-1 border-b border-white/5 last:border-0">
                                    <span className="text-xs text-slate-400 font-medium">{formatKey(key)}</span>
                                    <span className="text-xs text-slate-200 text-right max-w-[55%] break-words">
                                        {formatValue(value)}
                                    </span>
                                </div>
                            ))}
                            <div className="flex flex-col gap-1 pt-2">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Coordinates</span>
                                <span className="text-xs text-slate-300 font-mono bg-black/20 px-2 py-1 rounded border border-white/5">
                                    {detail.coordinates.lat?.toFixed(5) || 'N/A'}, {detail.coordinates.lng?.toFixed(5) || 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Asset not found</div>
            )}
        </div>
    );
}
