/**
 * AssetExplorer — Left-side structural navigation panel.
 * Groups assets hierarchically and syncs with map selection.
 */

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNetwork } from '../hooks/useApi';
import { Layers, ChevronDown, ChevronRight, X, Cpu, Zap, Activity, Home, Power } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Config for Groups                                                   */
/* ------------------------------------------------------------------ */

const GROUP_CONFIG = {
    generation: { title: 'Generation', icon: Power, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    hv: { title: 'High Voltage (HV)', icon: Zap, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    mv: { title: 'Medium Voltage (MV)', icon: Activity, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    lv: { title: 'Low Voltage (LV)', icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    consumers: { title: 'Consumers', icon: Home, color: 'text-emerald-400', bg: 'bg-emerald-400/10' }
};

/* ------------------------------------------------------------------ */
/* Accordion Section Component                                         */
/* ------------------------------------------------------------------ */

function AssetGroup({ groupKey, assets, selectedAssetId, onSelect }) {
    const [expanded, setExpanded] = useState(true);
    const config = GROUP_CONFIG[groupKey];
    const Icon = config.icon;

    if (!assets || assets.length === 0) return null;

    const containsSelected = assets.some(a => a.id === selectedAssetId);

    return (
        <div className="border-b border-white/5 last:border-0">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-3 bg-slate-800/20 hover:bg-slate-800/40 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${config.bg} ${config.color}`}>
                        <Icon size={14} />
                    </div>
                    <span className="text-sm font-semibold text-slate-200">
                        {config.title}
                        <span className="ml-2 text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                            {assets.length}
                        </span>
                    </span>
                </div>
                {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
            </button>

            {/* Content List */}
            {expanded && (
                <div className="py-1 bg-slate-900/40">
                    {assets.map(asset => {
                        const isSelected = selectedAssetId === asset.id;
                        return (
                            <button
                                key={asset.id}
                                ref={isSelected ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) : null}
                                onClick={() => onSelect(asset.id)}
                                className={`
                                    w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-all
                                    ${isSelected 
                                        ? 'bg-blue-500/15 border-l-2 border-blue-500' 
                                        : 'border-l-2 border-transparent hover:bg-slate-800/60'
                                    }
                                `}
                            >
                                <span className={`truncate mr-3 ${isSelected ? 'text-blue-300 font-medium' : 'text-slate-400'}`}>
                                    {asset.name}
                                </span>
                                <span className={`
                                    text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border
                                    ${asset.voltage_level === 'HV' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : ''}
                                    ${asset.voltage_level === 'MV' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                                    ${asset.voltage_level === 'LV' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                                `}>
                                    {asset.voltage_level}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* AssetExplorer Main Component                                        */
/* ------------------------------------------------------------------ */

export default function AssetExplorer() {
    const { explorerOpen, toggleExplorer, selectedAssetId, selectAsset } = useApp();
    const { data: network, isLoading } = useNetwork();

    if (!explorerOpen) return null;

    return (
        <div className="absolute top-[72px] left-4 z-[1000] w-80 bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-90px)] backdrop-blur-md">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-800/50">
                <div className="flex items-center gap-2">
                    <Layers size={18} className="text-blue-400" />
                    <h2 className="font-bold text-slate-100 text-sm">Asset Explorer</h2>
                </div>
                <button 
                    onClick={toggleExplorer}
                    className="p-1 hover:bg-white/10 rounded-md text-slate-400 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading || !network?.groups ? (
                    <div className="p-8 text-center text-sm text-slate-500">Loading assets...</div>
                ) : (
                    <div className="flex flex-col pb-2">
                        {/* Render all 5 groups in logical order */}
                        <AssetGroup groupKey="generation" assets={network.groups.generation} selectedAssetId={selectedAssetId} onSelect={selectAsset} />
                        <AssetGroup groupKey="hv" assets={network.groups.hv} selectedAssetId={selectedAssetId} onSelect={selectAsset} />
                        <AssetGroup groupKey="mv" assets={network.groups.mv} selectedAssetId={selectedAssetId} onSelect={selectAsset} />
                        <AssetGroup groupKey="lv" assets={network.groups.lv} selectedAssetId={selectedAssetId} onSelect={selectAsset} />
                        <AssetGroup groupKey="consumers" assets={network.groups.consumers} selectedAssetId={selectedAssetId} onSelect={selectAsset} />
                    </div>
                )}
            </div>

            {/* Footer Summary */}
            {network?.nodes && (
                <div className="p-3 border-t border-white/5 bg-slate-950/50 text-xs text-slate-500 text-center font-medium">
                    Total Assets: {network.nodes.length}
                </div>
            )}

        </div>
    );
}
