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
import ChartInfo from '../common/ChartInfo';

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

    // Zoom State (Indices)
    const [zoomState, setZoomState] = useState<{ start: number, end: number }>({ start: 0, end: 0 });

    // Choose data based on mode
    const fullData = mode === 'TR' ? dataTR : dataPR;

    // Initialize/Reset zoom when data changes
    React.useEffect(() => {
        if (fullData && fullData.length > 0) {
            setZoomState({ start: 0, end: fullData.length });
        }
    }, [fullData]);

    if (!fullData || fullData.length === 0) return null;

    const slicedData = fullData.slice(zoomState.start, zoomState.end);
    const tickers = Object.keys(fullData[0]).filter(key => key !== 'date');

    const handleWheel = (e: React.WheelEvent) => {
        // Prevent page scrolling if needed (though difficult in passive event)
        // e.preventDefault(); 

        const zoomSpeed = Math.max(1, Math.floor(fullData.length * 0.05)); // 5% per scroll
        const direction = e.deltaY > 0 ? 1 : -1; // Positive = Zoom Out (Scroll Down), Negative = Zoom In

        let newStart = zoomState.start;
        let newEnd = zoomState.end;

        if (direction === -1) {
            // Zoom In: Cut from both sides
            if ((newEnd - newStart) > 20) { // Minimum 20 data points
                newStart += zoomSpeed;
                newEnd -= zoomSpeed;
            }
        } else {
            // Zoom Out: Expand both sides
            newStart = Math.max(0, newStart - zoomSpeed);
            newEnd = Math.min(fullData.length, newEnd + zoomSpeed);
        }

        // Clamp
        if (newStart < 0) newStart = 0;
        if (newEnd > fullData.length) newEnd = fullData.length;
        if (newStart >= newEnd) newStart = newEnd - 20; // Safety

        setZoomState({ start: newStart, end: newEnd });
    };

    return (
        <div
            className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm h-[400px] flex flex-col"
            onWheel={handleWheel}
        >
            <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        Cumulative Returns
                        <ChartInfo
                            title="Cumulative Returns (Total Return vs Price Return)"
                            description="Visualizes the aggregate return of assets over time. TR (Total Return) includes dividends reinvested, while PR (Price Return) only shows price appreciation. Use your mouse wheel or trackpad scroll to zoom in/out of specific time periods."
                        />
                    </h3>
                    <span className="text-xs text-slate-500">Normalized to 0% ({mode === 'TR' ? 'Total Return' : 'Price Return'})</span>
                </div>

                <div className="flex items-center gap-4">
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

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={slicedData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickFormatter={(val) => val.slice(0, 4)} // Show Year only (or adjust based on zoom?)
                            minTickGap={30}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            fontSize={12}
                            unit="%"
                            domain={['auto', 'auto']}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                            itemStyle={{ color: '#e2e8f0' }}
                            itemSorter={(item) => (item.value as number) * -1} // Sort Descending
                            formatter={(value: number | undefined) => [typeof value === 'number' ? `${value.toFixed(2)}%` : 'N/A', '']}
                            labelStyle={{ color: '#94a3b8', marginBottom: '0.5rem' }}
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
                                isAnimationActive={false} // Disable animation for smoother zooming
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default CumulativeReturns;
