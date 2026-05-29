/**
 * AppContext — state for selected asset, layer visibility (HV/MV/LV).
 */

import { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
    const [selectedAssetId, setSelectedAssetId] = useState(null);
    const [hvLayerVisible, setHvLayerVisible] = useState(true);
    const [mvLayerVisible, setMvLayerVisible] = useState(true);
    const [lvLayerVisible, setLvLayerVisible] = useState(true);
    const [explorerOpen, setExplorerOpen] = useState(false);

    // Global configuration from Homepage
    const [systemConfig, setSystemConfig] = useState(null);

    const selectAsset = useCallback((id) => setSelectedAssetId(id), []);
    const clearSelection = useCallback(() => setSelectedAssetId(null), []);
    const toggleHvLayer = useCallback(() => setHvLayerVisible((p) => !p), []);
    const toggleMvLayer = useCallback(() => setMvLayerVisible((p) => !p), []);
    const toggleLvLayer = useCallback(() => setLvLayerVisible((p) => !p), []);
    const toggleExplorer = useCallback(() => setExplorerOpen((p) => !p), []);
    const initializeSystem = useCallback((config) => setSystemConfig(config), []);

    return (
        <AppContext.Provider
            value={{
                systemConfig, initializeSystem,
                selectedAssetId, selectAsset, clearSelection,
                explorerOpen, toggleExplorer,
                hvLayerVisible, mvLayerVisible, lvLayerVisible,
                toggleHvLayer, toggleMvLayer, toggleLvLayer,
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within an AppProvider');
    return ctx;
}
