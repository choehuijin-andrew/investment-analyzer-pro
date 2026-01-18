"use client";
import React from 'react';
import ChartInfo from '../common/ChartInfo';
import { cn } from '@/lib/utils';

interface CorrelationHeatmapProps {
    data: any[];
}

const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ data }) => {
    if (!data || data.length === 0) return null;

    // Extract unique tickers
    // data is like [{x: 'SPY', y: 'SCHD', value: 0.5}, ...]
    // We need to pivot this or just map it.

    // Get list of tickers from 'x' field unique values
    const tickers = Array.from(new Set(data.map(d => d.x)));

    // Helper to find value
    const getValue = (x: string, y: string) => {
        const item = data.find(d => d.x === x && d.y === y);
        return item ? item.value : 0;
    };

    // Color scale helper (Blue to Red)
    // -1 (Blue) -> 0 (White/Dark) -> 1 (Red)
    // Color scale helper (Blue -> Yellow -> Red)
    // -1 (Blue) -> 0 (Yellow) -> 1 (Red)
    const getColor = (val: number) => {
        // Colors
        const red = { r: 239, g: 68, b: 68 };    // Red-500
        const yellow = { r: 253, g: 224, b: 71 }; // Yellow-300 (Bright Yellow)
        const blue = { r: 59, g: 130, b: 246 };   // Blue-500

        const lerp = (start: number, end: number, t: number) => Math.round(start + (end - start) * t);

        if (val >= 0) {
            // Yellow -> Red
            // t goes from 0 to 1
            const t = Math.min(1, val);
            return `rgba(${lerp(yellow.r, red.r, t)}, ${lerp(yellow.g, red.g, t)}, ${lerp(yellow.b, red.b, t)}, 0.9)`;
        } else {
            // Yellow -> Blue
            // t goes from 0 to 1 (using abs(val))
            const t = Math.min(1, Math.abs(val));
            return `rgba(${lerp(yellow.r, blue.r, t)}, ${lerp(yellow.g, blue.g, t)}, ${lerp(yellow.b, blue.b, t)}, 0.9)`;
        }
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">Correlation Matrix</h3>
                    <ChartInfo
                        title="상관관계 분석 (Correlation)"
                        description="자산 간의 가격 움직임이 얼마나 비슷한지를 나타냅니다. 1에 가까우면 같이 움직이고, -1은 반대로 움직입니다. 분산 투자를 위해 낮은 상관관계를 찾으세요."
                    />
                </div>
                <span className="text-xs text-slate-500">Pearson Coefficient</span>
            </div>

            <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                <div
                    className="grid w-full h-full max-w-full max-h-full"
                    style={{
                        gridTemplateColumns: `auto repeat(${tickers.length}, 1fr)`,
                        gridTemplateRows: `auto repeat(${tickers.length}, 1fr)`,
                    }}
                >
                    {/* Corner */}
                    <div className="font-bold text-xs text-slate-500 flex items-center justify-center"></div>

                    {/* Header Row */}
                    {tickers.map(t => (
                        <div key={`head-${t}`} className="flex items-center justify-center font-bold text-[10px] sm:text-xs text-slate-300 p-1 truncate">
                            {t}
                        </div>
                    ))}

                    {/* Data Rows */}
                    {tickers.map(rowTicker => (
                        <React.Fragment key={`row-${rowTicker}`}>
                            {/* Row Label */}
                            <div className="flex items-center justify-end font-bold text-[10px] sm:text-xs text-slate-300 pr-2 truncate">
                                {rowTicker}
                            </div>

                            {/* Cells */}
                            {tickers.map(colTicker => {
                                const val = getValue(rowTicker, colTicker);
                                return (
                                    <div
                                        key={`${rowTicker}-${colTicker}`}
                                        className="flex items-center justify-center text-[10px] sm:text-xs font-medium text-white transition-all hover:scale-105 cursor-pointer relative group rounded-sm m-[1px]"
                                        style={{ backgroundColor: getColor(val) }}
                                    >
                                        {val.toFixed(2)}
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-black text-white px-2 py-1 rounded text-[10px] whitespace-nowrap z-50 pointer-events-none">
                                            {rowTicker} vs {colTicker}: {val}
                                        </div>
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="flex justify-between mt-2 text-[10px] text-slate-500 flex-shrink-0">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Negative</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Positive</div>
            </div>
        </div>
    );
};

export default CorrelationHeatmap;
