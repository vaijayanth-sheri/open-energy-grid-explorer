/**
 * MetricsChart — Live Recharts line chart for asset metrics.
 */

import { useMemo } from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';

/**
 * Formats an ISO timestamp to HH:mm:ss.
 */
function formatTime(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
        return '';
    }
}

/**
 * Picks which metric keys to chart based on asset type.
 */
function getChartConfig(assetType) {
    switch (assetType) {
        case 'generator':
            return [
                { key: 'active_power_mw', label: 'Power (MW)', color: '#fbbf24' },
                { key: 'voltage_kv', label: 'Voltage (kV)', color: '#60a5fa' },
            ];
        case 'transmission_line_hv':
            return [
                { key: 'active_power_mw', label: 'Power (MW)', color: '#fb923c' },
                { key: 'loading_pct', label: 'Loading (%)', color: '#f87171' },
            ];
        case 'substation_hv_mv':
            return [
                { key: 'load_mw', label: 'Load (MW)', color: '#a78bfa' },
                { key: 'loading_pct', label: 'Loading (%)', color: '#f87171' },
            ];
        case 'feeder_mv':
            return [
                { key: 'load_mw', label: 'Load (MW)', color: '#60a5fa' },
                { key: 'loading_percent', label: 'Loading (%)', color: '#f87171' },
            ];
        case 'rmu':
            return [
                { key: 'load_mw', label: 'Load (MW)', color: '#22d3ee' },
            ];
        case 'transformer_mv_lv':
            return [
                { key: 'current_load_kw', label: 'Load (kW)', color: '#c084fc' },
                { key: 'utilization_percent', label: 'Utilization (%)', color: '#f87171' },
            ];
        case 'feeder_lv':
            return [
                { key: 'load_mw', label: 'Load (MW)', color: '#34d399' },
                { key: 'loading_percent', label: 'Loading (%)', color: '#f87171' },
            ];
        case 'consumer':
            return [
                { key: 'active_power_mw', label: 'Demand (MW)', color: '#34d399' },
            ];
        default:
            return [
                { key: 'load_mw', label: 'Load (MW)', color: '#fbbf24' },
            ];
    }
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="bg-slate-800/95 border border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs">
            <p className="text-slate-400 mb-1">{label}</p>
            {payload.map((entry, i) => (
                <p key={i} style={{ color: entry.color }} className="font-medium">
                    {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
                </p>
            ))}
        </div>
    );
};

export default function MetricsChart({ history, assetType }) {
    const configs = getChartConfig(assetType);

    const chartData = useMemo(() => {
        if (!history || history.length === 0) return [];
        return history.map((point) => ({
            time: formatTime(point.timestamp),
            ...point.values,
        }));
    }, [history]);

    if (chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                Waiting for data…
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis
                    dataKey="time"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={{ stroke: '#475569' }}
                    axisLine={{ stroke: '#475569' }}
                    interval="preserveStartEnd"
                    minTickGap={40}
                />
                <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={{ stroke: '#475569' }}
                    axisLine={{ stroke: '#475569' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
                {configs.map((cfg) => (
                    <Line
                        key={cfg.key}
                        type="monotone"
                        dataKey={cfg.key}
                        name={cfg.label}
                        stroke={cfg.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
}
