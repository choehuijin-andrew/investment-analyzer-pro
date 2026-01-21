"use client";
import React, { useState, useEffect } from 'react';
import { getStockDetails, getPriceHistory } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, DollarSign, Activity, PieChart, BarChart } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart as RechartsBarChart, Bar, Legend } from 'recharts';
import ChartInfo from '../common/ChartInfo';
import TimingTab from './TimingTab';

// Mock components for now, will modularize later
const MetricCard = ({ title, value, subtext, isPositive }: any) => (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
        <p className="text-slate-400 text-xs font-medium uppercase">{title}</p>
        <div className="flex items-end gap-2 mt-1">
            <h4 className="text-xl font-bold text-white">{value}</h4>
            {subtext && (
                <span className={`text-xs ${isPositive ? 'text-emerald-400' : isPositive === false ? 'text-red-400' : 'text-slate-500'}`}>
                    {subtext}
                </span>
            )}
        </div>
    </div>
);

interface StockDashboardProps {
    tickers: string[];
    activeTicker?: string; // Passed from parent
}

const StockDashboard: React.FC<StockDashboardProps> = ({ tickers, activeTicker }) => {
    // If activeTicker is provided, use it. Otherwise default to first ticker or AAPL.
    const effectiveTicker = activeTicker || (tickers && tickers.length > 0 ? tickers[0] : 'AAPL');

    const [details, setDetails] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [period, setPeriod] = useState("1y"); // 1d, 5d, 1m, 6m, 1y, 5y, 10y

    // Fetch Details when Selected Ticker Changes
    useEffect(() => {
        const fetchData = async () => {
            if (!effectiveTicker) return;
            setLoading(true);
            try {
                const data = await getStockDetails(effectiveTicker);
                setDetails(data);
            } catch (err) {
                console.error("Failed to fetch details", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        // Also fetch default history
        fetchHistory(effectiveTicker, "1y");
    }, [effectiveTicker]);

    const fetchHistory = async (t: string, p: string) => {
        setHistoryLoading(true);
        setPeriod(p);
        try {
            // Determine interval based on period
            let interval = "1d";
            if (p === "1d") interval = "5m";
            if (p === "5d") interval = "15m";
            if (p === "1mo") interval = "1h"; // or 90m

            const data = await getPriceHistory(t, p, interval);
            setHistory(data);
        } catch (err) {
            console.error("History fetch failed", err);
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-950">
            {/* Main Content Area (No Sidebar Here) */}
            <div className="flex-1 rounded-xl overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 pr-2">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                            <p>Loading details for {effectiveTicker}...</p>
                        </div>
                    </div>
                ) : !details ? (
                    <div className="h-full flex items-center justify-center text-slate-500">Select a ticker to view details</div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Header */}
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end border-b border-slate-800 pb-6 gap-4 lg:gap-0">
                            <div>
                                <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">{details.name} <span className="text-slate-500 font-medium text-xl lg:text-2xl ml-2">{effectiveTicker}</span></h1>
                                <p className="text-slate-400 mt-2 text-base lg:text-lg">{details.sector} <span className="text-slate-600 mx-2">•</span> {details.currency}</p>
                            </div>
                            <div className="text-left lg:text-right">
                                <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tighter">${details.price?.toFixed(2)}</h2>
                                {/* Change logic needed if API doesn't provide it directly in Info */}
                            </div>
                        </div>

                        {/* Chart Section */}
                        <Card className="bg-slate-900 border-slate-800 shadow-lg">
                            <CardHeader className="flex flex-col lg:flex-row items-start lg:items-center justify-between pb-4 border-b border-slate-800/50 gap-4 lg:gap-0">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-white text-xl">Price History</CardTitle>
                                        <ChartInfo title="주가 차트" description="과거 주가 흐름을 보여줍니다." />
                                    </div>
                                    <CardDescription>Historical Performance</CardDescription>
                                </div>
                                {/* Period Selectors */}
                                <div className="flex flex-wrap gap-1 bg-slate-950 p-1.5 rounded-lg border border-slate-800 w-full lg:w-auto overflow-x-auto">
                                    {["1d", "5d", "1mo", "6mo", "1y", "5y", "10y"].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => fetchHistory(effectiveTicker, p)}
                                            className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all whitespace-nowrap flex-1 lg:flex-none ${period === p ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                        >
                                            {p.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="h-[300px] lg:h-[450px] w-full">
                                    {historyLoading ? (
                                        <div className="h-full flex items-center justify-center text-slate-500">Loading chart data...</div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={history}>
                                                <defs>
                                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                                                <XAxis
                                                    dataKey="date"
                                                    hide={false}
                                                    tickFormatter={(val) => {
                                                        // Simple format based on string length or basic parsing
                                                        // Assuming val is ISO date or similar "YYYY-MM-DD"
                                                        if (period === '1d' || period === '5d') return val.split(' ')[1] || val; // Time
                                                        if (period === '1mo' || period === '6mo') return val.split('-').slice(1).join('/'); // MM/DD
                                                        return val.split('-')[0]; // Year for long term
                                                    }}
                                                    minTickGap={50}
                                                    tick={{ fontSize: 10, fill: '#64748b' }}
                                                />
                                                <YAxis domain={['auto', 'auto']} stroke="#64748b" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                                                    itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                                                    labelStyle={{ color: '#94a3b8' }}
                                                />
                                                <Area type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
                            <MetricCard title="Market Cap" value={details.marketCap !== 'N/A' ? (details.marketCap / 1e9).toFixed(2) + 'B' : 'N/A'} subtext="USD" />
                            <MetricCard title="PE Ratio (TTM)" value={typeof details.pe === 'number' ? details.pe.toFixed(2) : details.pe} />
                            <MetricCard title="Dividend Yield" value={typeof details.div_yield === 'number' ? `${details.div_yield.toFixed(2)}%` : 'N/A'} isPositive={true} />
                            <MetricCard title="Beta (5Y)" value={typeof details.beta === 'number' ? details.beta.toFixed(2) : details.beta} />
                            <MetricCard title="ROE" value={typeof details.roe === 'number' ? (details.roe * 100).toFixed(2) + '%' : 'N/A'} />
                            <MetricCard title="Forward PE" value={typeof details.forward_pe === 'number' ? details.forward_pe.toFixed(2) : details.forward_pe} />
                            <MetricCard title="P/B Ratio" value={typeof details.pbr === 'number' ? details.pbr.toFixed(2) : details.pbr} />
                            <MetricCard title="Sector" value={details.sector} />
                        </div>

                        {/* Tabs for Deep Dive */}
                        <Tabs defaultValue="timing" className="w-full mt-4">
                            <TabsList className="bg-slate-900 border border-slate-800 text-slate-400 p-1 rounded-lg w-full justify-start h-auto overflow-x-auto">
                                <TabsTrigger value="timing" className="px-6 py-2 rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold">Timing & Valuation</TabsTrigger>
                                <TabsTrigger value="dividends" className="px-6 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">Dividends</TabsTrigger>
                                <TabsTrigger value="financials" className="px-6 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">Financials</TabsTrigger>
                                <TabsTrigger value="summary" className="px-6 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">Business Summary</TabsTrigger>
                            </TabsList>

                            <TabsContent value="timing" className="mt-6">
                                <TimingTab ticker={effectiveTicker} />
                            </TabsContent>

                            <TabsContent value="dividends" className="space-y-6 mt-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Growth Stats */}
                                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-md">
                                        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                                            <h3 className="font-bold text-white flex items-center gap-2 text-lg"><TrendingUp className="w-5 h-5 text-emerald-400" /> Dividend Growth</h3>
                                            <ChartInfo title="배당 성장률 (CAGR)" description="회사가 배당금을 매년 얼마나 인상했는지 보여주는 지표입니다. 7% 이상이면 매우 훌륭한 성장주입니다." />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center p-3 hover:bg-slate-800/50 rounded-lg transition-colors">
                                                <span className="text-slate-400 font-medium">3 Year CAGR</span>
                                                <span className="text-white font-bold text-lg">{details.dividend_growth.cagr_3y}%</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 hover:bg-slate-800/50 rounded-lg transition-colors">
                                                <span className="text-slate-400 font-medium">5 Year CAGR</span>
                                                <span className="text-white font-bold text-lg">{details.dividend_growth.cagr_5y}%</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 hover:bg-slate-800/50 rounded-lg transition-colors">
                                                <span className="text-slate-400 font-medium">10 Year CAGR</span>
                                                <span className="text-white font-bold text-lg">{details.dividend_growth.cagr_10y}%</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 hover:bg-slate-800/50 rounded-lg border-t border-slate-800 pt-3">
                                                <span className="text-slate-400 font-medium">Growth Streak</span>
                                                <span className="text-emerald-400 font-bold text-xl">{details.dividend_growth.years_growth} Years</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* History Chart */}
                                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-md h-[350px] flex flex-col">
                                        <h3 className="font-bold text-white mb-4 text-lg border-b border-slate-800 pb-2">Payout History (Annual)</h3>
                                        <div className="flex-1 w-full min-h-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsBarChart data={details.dividend_history.slice(-10)}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                                    <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 12 }} />
                                                    <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                                                    <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} name="Dividend ($)" barSize={40} />
                                                </RechartsBarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="financials" className="mt-6">
                                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-md h-[500px] flex flex-col">
                                    <h3 className="font-bold text-white mb-4 text-lg border-b border-slate-800 pb-2">Revenue & Net Income</h3>
                                    <div className="flex-1 w-full min-h-0">
                                        {details.financials && details.financials.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsBarChart data={details.financials} margin={{ top: 10 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                                    <XAxis dataKey="date" stroke="#64748b" tickFormatter={(v) => v.split('-')[0]} tick={{ fontSize: 12 }} />
                                                    <YAxis stroke="#64748b" tickFormatter={(v) => `$${(v / 1e9).toFixed(0)}B`} tick={{ fontSize: 12 }} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                                        formatter={(value: any) => [`$${(Number(value) / 1e9).toFixed(2)}B`, ""]}
                                                    />
                                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                                    <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                                    <Bar dataKey="net_income" fill="#8b5cf6" name="Net Income" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                                </RechartsBarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-slate-500 flex-col gap-2">
                                                <BarChart className="w-12 h-12 opacity-50" />
                                                <p>No financial data available (likely an ETF)</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="summary" className="mt-6">
                                <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-md">
                                    <h3 className="font-bold text-white mb-6 text-lg border-b border-slate-800 pb-4">Business Summary</h3>
                                    <p className="text-slate-300 leading-relaxed text-base">
                                        {details.description || "No description available."}
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockDashboard;
