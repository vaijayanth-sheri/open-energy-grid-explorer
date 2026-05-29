/**
 * Homepage — System Initialization Layer.
 * Configures Location, Data Sources, Input Methods, and Network Types before starting the digital twin.
 */

import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { MapPin, Search, Database, Layers, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Option Cards (Radio / Checkbox style)                               */
/* ------------------------------------------------------------------ */

function OptionCard({ title, description, active, disabled, onClick, badge }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`
                relative flex flex-col text-left p-4 rounded-xl border transition-all h-full
                ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-900/50 border-white/5' : ''}
                ${!disabled && active ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/50' : ''}
                ${!disabled && !active ? 'bg-slate-800/50 border-white/10 hover:bg-slate-800 hover:border-white/20' : ''}
            `}
        >
            <div className="flex justify-between items-start w-full mb-1">
                <span className={`font-semibold text-sm ${active ? 'text-blue-400' : 'text-slate-200'}`}>
                    {title}
                </span>
                {active && !disabled && <CheckCircle2 size={16} className="text-blue-500" />}
                {badge && (
                    <span className="text-[9px] uppercase tracking-wider font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-white/5">
                        {badge}
                    </span>
                )}
            </div>
            <span className="text-xs text-slate-500 mt-auto pt-2">{description}</span>
        </button>
    );
}

/* ------------------------------------------------------------------ */
/* Location Section                                                    */
/* ------------------------------------------------------------------ */

function LocationSelector({ location, setLocation }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState(null);

    // Using Nominatim API (OpenStreetMap)
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setError(null);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            if (!res.ok) throw new Error('Failed to fetch from Nominatim');
            const data = await res.json();

            if (data && data.length > 0) {
                const result = data[0];
                setLocation({
                    city: result.display_name.split(',')[0],
                    lat: parseFloat(result.lat),
                    lon: parseFloat(result.lon)
                });
            } else {
                setError('Location not found. Try a different city or region.');
            }
        } catch (err) {
            setError(err.message || 'Error occurred during search.');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="bg-slate-800/30 p-5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <MapPin className="text-blue-400" size={18} />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Geographic Context</h3>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search city (e.g., Munich, Berlin)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isSearching}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSearching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
                </button>
            </form>

            {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 p-2 rounded border border-red-400/20">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            <div className="flex items-center gap-4 mt-4 text-sm bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <div className="flex-1">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Determined City</div>
                    <div className="font-medium text-slate-300">
                        {location ? location.city : <span className="text-slate-600 italic">Not set</span>}
                    </div>
                </div>
                <div className="w-px h-8 bg-slate-800" />
                <div className="flex-1">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Latitude</div>
                    <input
                        type="number"
                        step="any"
                        value={location ? location.lat : ''}
                        onChange={(e) => setLocation(prev => ({ ...prev, lat: parseFloat(e.target.value), city: 'Manual Entry' }))}
                        className="w-full bg-transparent text-slate-300 focus:outline-none focus:text-blue-400 font-mono"
                        placeholder="0.0000"
                    />
                </div>
                <div className="w-px h-8 bg-slate-800" />
                <div className="flex-1">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Longitude</div>
                    <input
                        type="number"
                        step="any"
                        value={location ? location.lon : ''}
                        onChange={(e) => setLocation(prev => ({ ...prev, lon: parseFloat(e.target.value), city: 'Manual Entry' }))}
                        className="w-full bg-transparent text-slate-300 focus:outline-none focus:text-blue-400 font-mono"
                        placeholder="0.0000"
                    />
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function Homepage() {
    const { initializeSystem } = useApp();

    // Form State
    const [location, setLocation] = useState(null);
    const [dataSource, setDataSource] = useState('mock');
    const [inputMethod, setInputMethod] = useState('template');
    const [networks, setNetworks] = useState(['electricity']); // multi-select array

    // Validation
    const isValid = location && !isNaN(location.lat) && !isNaN(location.lon) && networks.length > 0;

    const handleSubmit = () => {
        if (!isValid) return;
        initializeSystem({
            location,
            data_source: dataSource,
            input_method: inputMethod,
            networks
        });
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 overflow-y-auto p-4 sm:p-8 pb-24">
            <div className="w-full max-w-4xl mx-auto py-8 lg:py-16">
                
                {/* Header */}
                <div className="mb-10 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/20 mb-6">
                        <Layers size={32} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-3">
                        System Setup
                    </h1>
                    <p className="text-slate-400 text-lg">
                        Configure digital twin parameters before initialization.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* 1. Location */}
                    <LocationSelector location={location} setLocation={setLocation} />

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* 2. Data Source */}
                        <div className="bg-slate-800/30 p-5 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-2 mb-4">
                                <Database className="text-indigo-400" size={18} />
                                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Data Source</h3>
                            </div>
                            <div className="grid gap-3">
                                <OptionCard
                                    title="Mock Data"
                                    description="Generate synthetic load profiles based on standard diurnal curves."
                                    active={dataSource === 'mock'}
                                    onClick={() => setDataSource('mock')}
                                />
                                <OptionCard
                                    title="Local JSON Upload"
                                    description="Upload historical time-series datasets."
                                    disabled
                                    badge="Coming Soon"
                                />
                                <OptionCard
                                    title="Live REST API"
                                    description="Connect to remote SCADA or smart meter feeds."
                                    disabled
                                    badge="Coming Soon"
                                />
                            </div>
                        </div>

                        {/* 3. Input Method */}
                        <div className="bg-slate-800/30 p-5 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-2 mb-4">
                                <Layers className="text-violet-400" size={18} />
                                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Network Model</h3>
                            </div>
                            <div className="grid gap-3">
                                <OptionCard
                                    title="Predefined Template"
                                    description="Load the default established network topology."
                                    active={inputMethod === 'template'}
                                    onClick={() => setInputMethod('template')}
                                />
                                <OptionCard
                                    title="Manual Builder"
                                    description="Interactively draw nodes and edges on the map canvas."
                                    disabled
                                    badge="Coming Soon"
                                />
                                <OptionCard
                                    title="File Import"
                                    description="Import network topology from GeoJSON or CIM formats."
                                    disabled
                                    badge="Coming Soon"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 4. Network Types */}
                    <div className="bg-slate-800/30 p-5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 mb-4">
                            <Layers className="text-emerald-400" size={18} />
                            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Simulated Networks</h3>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <OptionCard
                                title="Electricity"
                                description="MV / LV Distribution"
                                active={networks.includes('electricity')}
                                onClick={() => {}} // Always active for now
                            />
                            <OptionCard title="Water" description="Pipes & Valves" disabled badge="Soon" onClick={()=>{}} />
                            <OptionCard title="District Heating" description="Thermal Grid" disabled badge="Soon" onClick={()=>{}} />
                            <OptionCard title="Cooling" description="Chiller Network" disabled badge="Soon" onClick={()=>{}} />
                            <OptionCard title="Natural Gas" description="Pressure Grid" disabled badge="Soon" onClick={()=>{}} />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-8 mt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-slate-400 font-medium">
                            {!location ? '⚠️ Please search and select a Geographic Context first.' : '✅ Ready to initialize.'}
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={!isValid}
                            className={`
                                flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all w-full sm:w-auto
                                border
                                ${isValid 
                                    ? 'bg-blue-600 border-blue-500 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5' 
                                    : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-80 hover:bg-slate-800'
                                }
                            `}
                        >
                            Initialize System
                            <ArrowRight size={20} />
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
