"use client";
import React from 'react';
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
    if (!data || data.length === 0) return null;

    const tickers = Object.keys(data[0]).filter(key => key !== 'date');

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm h-[400px]">
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

            <ResponsiveContainer width="100%" height="90%">
                <LineChart data={data}>
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
                        formatter={(value: any) => [typeof value === 'number' ? `${value.toFixed(2)}%` : value, '']}
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

export default RollingReturns;
