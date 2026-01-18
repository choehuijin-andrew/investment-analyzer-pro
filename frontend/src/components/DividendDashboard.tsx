"use client";
import React, { useEffect, useState } from 'react';
import { getDividendStats, projectIncome, PortfolioItem } from '@/lib/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend
} from 'recharts';

interface DividendDashboardProps {
    tickers: string[];
}

import ChartInfo from './common/ChartInfo';

const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"];

const DividendDashboard: React.FC<DividendDashboardProps> = ({ tickers }) => {
    const [stats, setStats] = useState<any>(null);
    const [projection, setProjection] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!tickers.length) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Get Stats (Current Yield, CAGR)
                const statsData = await getDividendStats(tickers);
                setStats(statsData);

                // 2. Get Projection (Mock Portfolio: 100 shares of each)
                // In real app, we would take this from PortfolioInput
                const mockPortfolio: PortfolioItem[] = tickers.map(t => ({
                    ticker: t,
                    shares: 100, // Dummy assumption
                    cost_basis: 100,
                    monthly_contribution: 0
                }));
                const projData = await projectIncome(mockPortfolio);
                setProjection(projData);

            } catch (e) {
                console.error("Dividend fetch error", e);
            }
            setLoading(false);
        };

        fetchData();
    }, [tickers]);

    if (loading) return <div className="text-slate-400 p-10 text-center">Loading Dividend Analysis...</div>;
    if (!stats) return <div className="text-slate-500 p-10 text-center">Select tickers to analyze dividends.</div>;

    // Prepare chart data
    const incomeData = projection?.monthly_income || [];
    const snowballData = projection?.total_value.map((val: number, i: number) => ({
        year: `Year ${i + 1}`,
        value: val,
        income: projection.yearly_income[i]
    })) || [];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 1. Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {tickers.map(t => {
                    const s = stats[t];
                    return (
                        <div key={t} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-white text-lg">{t}</h4>
                                <span className="bg-emerald-900 text-emerald-300 text-xs px-2 py-1 rounded">
                                    {s.frequency}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Yield</span>
                                    <span className="text-emerald-400 font-bold">{s.yield}%</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">5Y CAGR</span>
                                    <span className="text-blue-400 font-bold">{s.cagr_5y}%</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Growth Streak</span>
                                    <span className="text-slate-200">{s.years_growth} Yrs</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 2. Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
                {/* Income Projection */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-white">Projected Monthly Income (Next 12M)</h3>
                        <ChartInfo
                            title="배당금 캘린더"
                            description="과거 배당 지급 이력을 기반으로 향후 1년간 예상되는 월별 배당금을 보여줍니다. 막대 그래프는 각 월에 배당을 지급하는 종목들의 기여도를 나타냅니다."
                        />
                    </div>

                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={incomeData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                                <YAxis stroke="#94a3b8" tickFormatter={v => `$${v}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                                    formatter={(value: number | undefined) => [value ? `$${value.toFixed(2)}` : '$0', '']}
                                    cursor={{ fill: '#334155', opacity: 0.2 }}
                                />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                {tickers.map((t, i) => (
                                    <Bar key={t} dataKey={t} stackId="a" fill={colors[i % colors.length]} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Snowball Effect */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-white">The Snowball Effect (10 Year Projection)</h3>
                        <ChartInfo
                            title="스노우볼 효과 (Snowball Effect)"
                            description="배당금을 재투자했을 때 자산이 얼마나 빠르게 불어나는지 보여주는 시뮬레이션입니다. 'Portfolio Value'는 원금 성장과 배당 재투자를 합친 자산 가치를, 'Annual Income'은 시간이 지날수록 늘어나는 연간 배당금 수령액을 의미합니다."
                        />
                    </div>

                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={snowballData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="year" stroke="#94a3b8" fontSize={10} />
                                <YAxis yAxisId="left" stroke="#94a3b8" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                                <YAxis yAxisId="right" orientation="right" stroke="#60a5fa" tickFormatter={v => `$${v}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                                />
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="value" name="Portfolio Value" stroke="#10b981" strokeWidth={2} dot={false} />
                                <Line yAxisId="right" type="monotone" dataKey="income" name="Annual Income" stroke="#60a5fa" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="text-center text-xs text-slate-500 italic">
                *Projections assume reinvestment of dividends and historical growth rates.
            </div>
        </div>
    );
};

export default DividendDashboard;
