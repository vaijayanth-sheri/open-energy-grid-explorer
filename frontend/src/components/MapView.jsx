/**
 * MapView — Full-screen Leaflet map with all network edges drawn as connections.
 * Updated: renders EVERY network edge as a line, not just line-type assets.
 */

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../context/AppContext';
import { useAssets, useNetwork } from '../hooks/useApi';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const MUNICH_CENTER = [48.155, 11.54];
const DEFAULT_ZOOM = 12;
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

/* ------------------------------------------------------------------ */
/* Asset type → marker visual config  (3-layer color coding)           */
/* ------------------------------------------------------------------ */

const MARKER_CONFIG = {
    // HV layer (orange)
    'generator-solar': { size: 28, cls: 'asset-marker asset-marker--generator-solar', emoji: '☀️', layer: 'hv' },
    'generator-ccgt': { size: 28, cls: 'asset-marker asset-marker--generator-ccgt', emoji: '🔥', layer: 'hv' },
    'substation_hv_mv-step_down': { size: 24, cls: 'asset-marker asset-marker--substation', emoji: '⚡', layer: 'hv' },
    // MV layer (blue)
    'rmu-switch': { size: 20, cls: 'asset-marker asset-marker--rmu', emoji: '🔌', layer: 'mv' },
    'transformer_mv_lv-distribution': { size: 20, cls: 'asset-marker asset-marker--transformer', emoji: '🔄', layer: 'mv' },
    // LV layer (green)
    'consumer-hospital': { size: 22, cls: 'asset-marker asset-marker--consumer-hospital', emoji: '🏥', layer: 'lv' },
    'consumer-data_center': { size: 22, cls: 'asset-marker asset-marker--consumer-data_center', emoji: '🖥️', layer: 'lv' },
    'consumer-residential': { size: 20, cls: 'asset-marker asset-marker--consumer-residential', emoji: '🏠', layer: 'lv' },
};

function getMarkerConfig(type, subtype) {
    return MARKER_CONFIG[`${type}-${subtype}`] || { size: 18, cls: 'asset-marker', emoji: '●', layer: 'lv' };
}

function createIcon(type, subtype, isSelected, isConnected, hasSelection) {
    const cfg = getMarkerConfig(type, subtype);
    const s = cfg.size;
    let sel = '';
    let opacity = 1;

    if (isSelected) {
        sel = ' selected';
    } else if (hasSelection) {
        if (isConnected) {
            sel = ' connected shadow-[0_0_15px_currentColor]'; 
            opacity = 0.9;
        } else {
            opacity = 0.25; // Dim non-connected
        }
    }

    return L.divIcon({
        className: '',
        html: `<div class="${cfg.cls}${sel}" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.5)}px;opacity:${opacity};transition:opacity 0.3s, transform 0.3s">${cfg.emoji}</div>`,
        iconSize: [s, s],
        iconAnchor: [s / 2, s / 2],
    });
}

/* ------------------------------------------------------------------ */
/* Edge visual style based on voltage level of connected assets        */
/* ------------------------------------------------------------------ */

function getEdgeStyle(sourceAsset, targetAsset) {
    // Determine edge voltage based on the source or higher-voltage asset
    const sVL = sourceAsset?.voltage_level || 'LV';
    const tVL = targetAsset?.voltage_level || 'LV';

    // HV connections
    if (sVL === 'HV' && tVL === 'HV') {
        return { color: '#fb923c', weight: 4, opacity: 0.7, dash: undefined, layer: 'hv' };
    }
    // HV → MV transition (substation → MV feeder)
    if (sVL === 'HV' && tVL === 'MV') {
        return { color: '#60a5fa', weight: 3, opacity: 0.6, dash: undefined, layer: 'mv' };
    }
    // MV → MV connections
    if (sVL === 'MV' && tVL === 'MV') {
        return { color: '#60a5fa', weight: 3, opacity: 0.6, dash: undefined, layer: 'mv' };
    }
    // MV → LV transition (transformer → LV feeder, or any MV→LV)
    if (sVL === 'MV' && tVL === 'LV') {
        return { color: '#34d399', weight: 2, opacity: 0.5, dash: '6 3', layer: 'lv' };
    }
    // LV → LV (feeder → consumer)
    if (sVL === 'LV' && tVL === 'LV') {
        return { color: '#34d399', weight: 2, opacity: 0.5, dash: '6 3', layer: 'lv' };
    }
    // Default
    return { color: '#94a3b8', weight: 2, opacity: 0.4, dash: '4 4', layer: 'lv' };
}

/* ------------------------------------------------------------------ */
/* Layer visibility helper                                             */
/* ------------------------------------------------------------------ */

function isLayerVisible(layer, hv, mv, lv) {
    if (layer === 'hv') return hv;
    if (layer === 'mv') return mv;
    if (layer === 'lv') return lv;
    return true;
}

/* ------------------------------------------------------------------ */
/* Map click to deselect                                               */
/* ------------------------------------------------------------------ */

function MapClickHandler() {
    const { clearSelection } = useApp();
    const map = useMap();
    useEffect(() => {
        const h = () => clearSelection();
        map.on('click', h);
        return () => map.off('click', h);
    }, [map, clearSelection]);
    return null;
}

/* ------------------------------------------------------------------ */
/* Map Focuser - Pans map when selection changes                       */
/* ------------------------------------------------------------------ */

function MapFocuser({ selectedAssetId, assetMap }) {
    const map = useMap();
    
    useEffect(() => {
        if (!selectedAssetId || !assetMap[selectedAssetId]) return;
        const asset = assetMap[selectedAssetId];
        if (asset && asset.coordinates) {
            map.flyTo([asset.coordinates.lat, asset.coordinates.lng], Math.max(map.getZoom(), 14), {
                duration: 1.0,
            });
        }
    }, [selectedAssetId, assetMap, map]);

    return null;
}

/* ------------------------------------------------------------------ */
/* MapView                                                             */
/* ------------------------------------------------------------------ */

export default function MapView() {
    const { systemConfig, selectedAssetId, selectAsset, hvLayerVisible, mvLayerVisible, lvLayerVisible } = useApp();
    const { data: assets } = useAssets();
    const { data: network } = useNetwork();

    // Build a lookup map: asset_id → asset summary (with coordinates)
    const assetMap = useMemo(() => {
        if (!assets) return {};
        return Object.fromEntries(assets.map((a) => [a.id, a]));
    }, [assets]);

    // All point assets (everything that isn't a line-only entity — but now we render ALL assets as markers)
    const pointAssets = useMemo(() => {
        if (!assets) return [];
        // All assets get markers since we draw edges as separate lines
        return assets;
    }, [assets]);

    // Identify connected assets for highlighting
    const connectedAssetIds = useMemo(() => {
        if (!selectedAssetId || !network?.upstreamMap) return new Set();
        const up = network.upstreamMap[selectedAssetId] || [];
        const down = network.downstreamMap[selectedAssetId] || [];
        return new Set([...up, ...down, selectedAssetId]);
    }, [selectedAssetId, network]);

    // Compute edge lines from the network graph
    const edgeLines = useMemo(() => {
        if (!network || !assets || Object.keys(assetMap).length === 0) return [];

        return network.edges
            .map((edge) => {
                const src = assetMap[edge.source];
                const tgt = assetMap[edge.target];
                if (!src || !tgt) return null;

                const style = getEdgeStyle(src, tgt);
                const positions = [
                    [src.coordinates.lat, src.coordinates.lng],
                    [tgt.coordinates.lat, tgt.coordinates.lng],
                ];

                const isConnected = connectedAssetIds.has(src.id) && connectedAssetIds.has(tgt.id);
                // Highlight edge if it connects two assets in the connected set, OR if it directly connects to the selected asset
                const isDirectlyConnected = edge.source === selectedAssetId || edge.target === selectedAssetId;

                // Opacity logic
                let opacity = style.opacity;
                let weight = style.weight;
                if (selectedAssetId) {
                    if (isDirectlyConnected) {
                        opacity = 1;
                        weight += 2; // Thicker for direct connections
                    } else if (isConnected) {
                        opacity = Math.min(1, style.opacity + 0.3);
                        weight += 1;
                    } else {
                        opacity = 0.15; // Fade out unrelated edges
                    }
                }

                return {
                    key: `${edge.source}->${edge.target}`,
                    positions,
                    style: { ...style, opacity, weight },
                    sourceName: src.name,
                    targetName: tgt.name,
                };
            })
            .filter(Boolean);
    }, [network, assets, assetMap, selectedAssetId, connectedAssetIds]);

    // Use dynamic center from config, fallback to Munich
    const mapCenter = systemConfig?.location 
        ? [systemConfig.location.lat, systemConfig.location.lon] 
        : MUNICH_CENTER;

    return (
        <MapContainer center={mapCenter} zoom={DEFAULT_ZOOM} style={{ width: '100%', height: '100vh' }} zoomControl>
            <TileLayer attribution={TILE_ATTR} url={DARK_TILES} />
            <MapClickHandler />
            <MapFocuser selectedAssetId={selectedAssetId} assetMap={assetMap} />

            {/* Network edge lines — drawn first so markers sit on top */}
            {edgeLines.map((edge) => {
                if (!isLayerVisible(edge.style.layer, hvLayerVisible, mvLayerVisible, lvLayerVisible)) return null;
                return (
                    <Polyline
                        key={edge.key}
                        positions={edge.positions}
                        pathOptions={{
                            color: edge.style.color,
                            weight: edge.style.weight,
                            opacity: edge.style.opacity,
                            dashArray: edge.style.dash,
                            className: 'transition-all duration-300'
                        }}
                    >
                        <Tooltip className="!bg-slate-800 !text-slate-200 !border-slate-600 !rounded-lg !px-3 !py-1.5 !text-xs !font-medium !shadow-xl">
                            {edge.sourceName} → {edge.targetName}
                        </Tooltip>
                    </Polyline>
                );
            })}

            {/* Point markers for ALL assets */}
            {pointAssets.map((a) => {
                const cfg = getMarkerConfig(a.type, a.subtype);
                if (!isLayerVisible(cfg.layer, hvLayerVisible, mvLayerVisible, lvLayerVisible)) return null;
                
                const isSelected = selectedAssetId === a.id;
                const isConnected = connectedAssetIds.has(a.id);
                const hasSelection = !!selectedAssetId;
                const icon = createIcon(a.type, a.subtype, isSelected, isConnected, hasSelection);
                
                return (
                    <Marker
                        key={a.id}
                        position={[a.coordinates.lat, a.coordinates.lng]}
                        icon={icon}
                        eventHandlers={{
                            click: (e) => {
                                e.originalEvent.stopPropagation();
                                selectAsset(a.id);
                            },
                        }}
                    >
                        <Tooltip
                            direction="top"
                            offset={[0, -12]}
                            className="!bg-slate-800 !text-slate-200 !border-slate-600 !rounded-lg !px-3 !py-1.5 !text-xs !font-medium !shadow-xl"
                        >
                            {a.name}
                        </Tooltip>
                    </Marker>
                );
            })}
        </MapContainer>
    );
}
