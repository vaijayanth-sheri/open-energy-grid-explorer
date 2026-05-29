/**
 * LayerControl — 3-layer toggle panel (HV / MV / LV).
 */

import { Layers, Zap, Cable, Home } from 'lucide-react';
import { useApp } from '../context/AppContext';

function Toggle({ label, voltage, color, active, onToggle, icon: Icon }) {
    return (
        <button
            onClick={onToggle}
            className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left hover:bg-white/5 ${active ? `text-${color}-400` : 'text-slate-500'
                }`}
            style={{ color: active ? undefined : '#64748b' }}
        >
            <Icon size={16} style={active ? { color: `var(--tw-${color})` } : undefined} />
            <span className="text-sm font-medium">{label}</span>
            <span className="ml-auto text-[10px] font-mono text-slate-500">{voltage}</span>
            <div className={`w-8 h-4 rounded-full transition-colors flex items-center ${active ? 'justify-end' : 'justify-start'
                }`} style={{ background: active ? `color-mix(in srgb, ${getColor(color)} 30%, transparent)` : '#334155' }}>
                <div className="w-3 h-3 rounded-full mx-0.5 transition-colors"
                    style={{ background: active ? getColor(color) : '#64748b' }} />
            </div>
        </button>
    );
}

function getColor(name) {
    const map = { orange: '#fb923c', blue: '#60a5fa', emerald: '#34d399' };
    return map[name] || '#94a3b8';
}

export default function LayerControl() {
    const { hvLayerVisible, mvLayerVisible, lvLayerVisible, toggleHvLayer, toggleMvLayer, toggleLvLayer } = useApp();

    return (
        <div id="layer-control" className="absolute top-4 right-4 z-[1000] backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"
            style={{ background: 'var(--panel-bg)' }}>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
                <Layers size={16} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Layers</span>
            </div>
            <Toggle label="High Voltage" voltage="110 kV" color="orange" active={hvLayerVisible} onToggle={toggleHvLayer} icon={Zap} />
            <Toggle label="Medium Voltage" voltage="11 kV" color="blue" active={mvLayerVisible} onToggle={toggleMvLayer} icon={Cable} />
            <Toggle label="Low Voltage" voltage="0.4 kV" color="emerald" active={lvLayerVisible} onToggle={toggleLvLayer} icon={Home} />
        </div>
    );
}
