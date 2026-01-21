"use client";
import React, { useState, useEffect } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

interface DrawdownChartProps {
    data: any[];
}

const colors = [
    "#10b981", // Emerald 500
    "#3b82f6", // Blue 500
    "#8b5cf6", // Violet 500
    "#f59e0b", // Amber 500
    "#ef4444", // Red 500
];

import ChartInfo from '../common/ChartInfo';

const DrawdownChart: React.FC<DrawdownChartProps> = ({ data }) => {
    const [zoomState, setZoomState] = useState<{ start: number, end: number }>({ start: 0, end: 0 });

    useEffect(() => {
        if (data && data.length > 0) {
            setZoomState({ start: 0, end: data.length });
        }
    }, [data]);

    if (!data || data.length === 0) return null;

    const slicedData = data.slice(zoomState.start, zoomState.end);
    const tickers = Object.keys(data[0]).filter(key => key !== 'date');

    const handleWheel = (e: React.WheelEvent) => {
        const zoomSpeed = Math.max(1, Math.floor(data.length * 0.05));
        const direction = e.deltaY > 0 ? 1 : -1;
        let newStart = zoomState.start;
        let newEnd = zoomState.end;

        if (direction === -1) {
            if ((newEnd - newStart) > 20) {
                newStart += zoomSpeed;
                newEnd -= zoomSpeed;
            }
        } else {
            newStart = Math.max(0, newStart - zoomSpeed);
            newEnd = Math.min(data.length, newEnd + zoomSpeed);
        }

        if (newStart < 0) newStart = 0;
        if (newEnd > data.length) newEnd = data.length;
        if (newStart >= newEnd) newStart = newEnd - 20;

        setZoomState({ start: newStart, end: newEnd });
    };

    return (
        <div
            className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm h-full min-h-[400px] flex flex-col"
            onWheel={handleWheel}
        >
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">Underwater Plot (Drawdowns)</h3>
                    <ChartInfo
                        title="최대 낙폭 (Underwater Plot)"
                        description="역대 최고점(High Water Mark) 대비 현재 자산 가치가 얼마나 하락했는지를 보여줍니다. 0%는 신고가를 의미하며, -20%는 고점 대비 20% 하락한 상태입니다. 하락장에서의 방어력과 회복 탄력성을 평가하는 중요 지표입니다."
                    />
                </div>
                <span className="text-xs text-slate-500">Decline from historical peak over time</span>
            </div>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={slicedData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickFormatter={(val) => val.slice(0, 4)}
                            minTickGap={30}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            fontSize={12}
                            unit="%"
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                            itemStyle={{ color: '#e2e8f0' }}
                            formatter={(value: number | undefined, name: any) => [value !== undefined ? value.toFixed(2) + "%" : "N/A", name]}
                            itemSorter={(item) => Math.abs(item.value as number) * -1}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        {tickers.map((ticker, index) => (
                            <Area
                                key={ticker}
                                type="monotone"
                                dataKey={ticker}
                                stroke={colors[index % colors.length]}
                                fill={colors[index % colors.length]}
                                fillOpacity={0.1}
                                strokeWidth={2}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default DrawdownChart;
