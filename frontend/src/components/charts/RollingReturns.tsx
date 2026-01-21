"use client";
import React, { useState, useEffect } from 'react';
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

interface RollingReturnsProps {
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

const RollingReturns: React.FC<RollingReturnsProps> = ({ data }) => {
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
                    <h3 className="text-lg font-bold text-white">Rolling 1-Year Returns</h3>
                    <ChartInfo
                        title="1년 보유 수익률 (Rolling Returns)"
                        description="특정 시점에 매수해서 정확히 1년간 보유했을 때의 연수익률 추이입니다. 이 그래프가 0% 위에 머문다면, 언제 투자했더라도 1년 뒤에는 수익이 났음을 의미합니다. 투자 시점(Market Timing)에 따른 성과 편차를 확인할 수 있습니다."
                    />
                </div>
                <span className="text-xs text-slate-500">Annualized return over rolling 252-day windows</span>
            </div>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={slicedData}>
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
                            itemSorter={(item) => (item.value as number) * -1}
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
        </div>
    );
};

export default RollingReturns;
