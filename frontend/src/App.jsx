/**
 * App — Root component for the Open Energy Grid Explorer.
 */

import { AppProvider, useApp } from './context/AppContext';
import MapView from './components/MapView';
import LayerControl from './components/LayerControl';
import SidePanel from './components/SidePanel';
import Homepage from './components/Homepage';
import AssetExplorer from './components/AssetExplorer';
import { Layers } from 'lucide-react';

function MainApp() {
    const { systemConfig, explorerOpen, toggleExplorer } = useApp();

    if (!systemConfig) {
        return <Homepage />;
    }

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
            {/* Full-screen map */}
            <MapView />

            {/* Floating layer control (top-right) */}
            <LayerControl />

            {/* Side panel (right, conditional on selection) */}
            <SidePanel />

            {/* Top-left controls */}
            <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
                <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-white/10 p-2.5 rounded-xl shadow-lg">
                    <button 
                        onClick={toggleExplorer}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${explorerOpen ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                        title="Toggle Asset Explorer"
                    >
                        <Layers size={18} />
                    </button>
                    <div>
                        <h1 className="text-sm font-bold text-white/90 tracking-tight leading-none">
                            ⚡ Open Energy Grid
                        </h1>
                        <p className="text-[10px] text-slate-400 mt-1 leading-none uppercase tracking-widest font-semibold">
                            {systemConfig.location.city} · {systemConfig.networks.join(', ')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Asset Explorer (left panel) */}
            <AssetExplorer />
        </div>
    );
}

export default function App() {
    return (
        <AppProvider>
            <MainApp />
        </AppProvider>
    );
}
