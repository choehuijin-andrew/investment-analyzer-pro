"use client";
import React, { useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';

interface CumulativeReturnsProps {
    dataTR: any[];
    dataPR: any[];
}

const colors = [
    "#10b981", // Emerald 500
    "#3b82f6", // Blue 500
    "#8b5cf6", // Violet 500
    "#f59e0b", // Amber 500
    "#ef4444", // Red 500
];

const CumulativeReturns: React.FC<CumulativeReturnsProps> = ({ dataTR, dataPR }) => {
    const [mode, setMode] = useState<'TR' | 'PR'>('TR');
    const [yMin, setYMin] = useState<string>('');
    const [yMax, setYMax] = useState<string>('');

    // Choose data based on mode
    const data = mode === 'TR' ? dataTR : dataPR;

    if (!data || data.length === 0) return null;

    const tickers = Object.keys(data[0]).filter(key => key !== 'date');

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm h-[400px]">
            <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-white">Cumulative Returns</h3>
                    <span className="text-xs text-slate-500">Normalized to 0% ({mode === 'TR' ? 'Total Return' : 'Price Return'})</span>
                </div>

                <div className="flex items-center gap-4">
                    {/* Axis Control */}
                    <div className="flex items-center gap-2">
                        <input
                            placeholder="Min %"
                            className="bg-slate-900 border border-slate-700 w-16 px-2 py-1 rounded text-white text-xs"
                            value={yMin}
                            onChange={e => setYMin(e.target.value)}
                        />
                        <span className="text-slate-500 text-xs">-</span>
                        <input
                            placeholder="Max %"
                            className="bg-slate-900 border border-slate-700 w-16 px-2 py-1 rounded text-white text-xs"
                            value={yMax}
                            onChange={e => setYMax(e.target.value)}
                        />
                    </div>

                    {/* Toggle Switch */}
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                        <button
                            onClick={() => setMode('TR')}
                            className={cn(
                                "px-3 py-1 text-xs font-bold rounded transition-colors",
                                mode === 'TR' ? "bg-emerald-500 text-slate-900" : "text-slate-400 hover:text-white"
                            )}
                        >
                            TR
                        </button>
                        <button
                            onClick={() => setMode('PR')}
                            className={cn(
                                "px-3 py-1 text-xs font-bold rounded transition-colors",
                                mode === 'PR' ? "bg-emerald-500 text-slate-900" : "text-slate-400 hover:text-white"
                            )}
                        >
                            PR
                        </button>
                    </div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height="90%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        fontSize={12}
                        tickFormatter={(val) => val.slice(0, 4)} // Show Year only for cleanliness
                        minTickGap={30}
                    />
                    <YAxis
                        stroke="#94a3b8"
                        fontSize={12}
                        unit="%"
                        domain={[yMin ? Number(yMin) : 'auto', yMax ? Number(yMax) : 'auto']}
                        allowDataOverflow
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                        itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    {tickers.map((ticker, index) => (
                        <Line
                            key={ticker}
                            type="monotone"
                            dataKey={ticker}
                            stroke={colors[index % colors.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6 }}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default CumulativeReturns;
