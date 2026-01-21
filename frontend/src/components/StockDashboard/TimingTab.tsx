import React, { useEffect, useState } from 'react';
import { getTechnicalAnalysis } from '@/lib/api';
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from 'recharts';
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign, Activity, CheckCircle, XCircle } from 'lucide-react';
import ChartInfo from '../common/ChartInfo';

interface TimingTabProps {
    ticker: string;
}

const SignalCard = ({ label, value, status, icon: Icon, desc }: any) => {
    let color = "text-slate-400";
    let bg = "bg-slate-800";
    let border = "border-slate-700";

    if (status === 'buy') {
        color = "text-emerald-400";
        bg = "bg-emerald-950/30";
        border = "border-emerald-500/50";
    } else if (status === 'sell') {
        color = "text-red-400";
        bg = "bg-red-950/30";
        border = "border-red-500/50";
    } else if (status === 'neutral') {
        color = "text-yellow-400";
        bg = "bg-yellow-950/30";
        border = "border-yellow-500/50";
    }

    return (
        <div className={`p-4 rounded-xl border ${border} ${bg} flex flex-col gap-2`}>
            <div className="flex justify-between items-start">
                <span className="text-xs uppercase font-bold text-slate-500">{label}</span>
                {Icon && <Icon className={`w-5 h-5 ${color}`} />}
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <p className="text-xs text-slate-400">{desc}</p>
        </div>
    );
};

const TimingTab: React.FC<TimingTabProps> = ({ ticker }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchTech = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await getTechnicalAnalysis(ticker);
                setData(res);
            } catch (err) {
                console.error(err);
                setError("Failed to load technical data.");
            } finally {
                setLoading(false);
            }
        };
        fetchTech();
    }, [ticker]);

    if (loading) return <div className="h-64 flex items-center justify-center text-slate-500">Analyzing Market Psychology...</div>;
    if (error) return <div className="h-64 flex items-center justify-center text-red-500">{error}</div>;
    if (!data) return null;

    const { summary, timeseries } = data;

    // Determine Signals
    const rsiVal = summary.rsi;
    const mfiVal = summary.mfi;
    const bbPos = summary.bb_position; // % 

    let overallSignal = "WAIT"; // neutral
    if (rsiVal < 30 && mfiVal < 20) overallSignal = "STRONG_BUY";
    else if (rsiVal < 35 || mfiVal < 25 || bbPos < 0) overallSignal = "BUY";
    else if (rsiVal > 70 || mfiVal > 80) overallSignal = "SELL";

    // Sensitivity Price Estimation (Rough)
    // If RSI is 50, how much price drop to get to 30? 
    // Very roughly: 14-day RSI implies avg gain/loss. We assume logic based on recent volatility.
    // Simpler UI: Just show where the Lower Band is, as that's a hard support.
    const targetPrice = summary.bb_lower;
    const targetDrop = ((summary.current_price - targetPrice) / summary.current_price) * 100;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 1. Signal Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`col-span-2 lg:col-span-1 p-5 rounded-xl border flex flex-col justify-center items-center text-center gap-2
                    ${overallSignal.includes('BUY') ? 'bg-emerald-600 border-emerald-500 shadow-lg shadow-emerald-900/50' :
                        overallSignal === 'SELL' ? 'bg-red-600 border-red-500' : 'bg-slate-800 border-slate-700'}`}>
                    <h3 className="text-white font-bold text-lg opacity-80 uppercase tracking-wider">Analysis Result</h3>
                    <div className="text-3xl font-black text-white tracking-tight">
                        {overallSignal === 'STRONG_BUY' ? 'STRONG BUY 🚀' :
                            overallSignal === 'BUY' ? 'BUY 🤔' :
                                overallSignal === 'SELL' ? 'OVERHEATED 🔥' : 'HOLD ✋'}
                    </div>
                </div>

                <SignalCard
                    label="RSI (14)"
                    value={rsiVal.toFixed(1)}
                    icon={rsiVal < 30 ? TrendingDown : rsiVal > 70 ? TrendingUp : Activity}
                    status={rsiVal < 30 ? 'buy' : rsiVal > 70 ? 'sell' : 'neutral'}
                    desc={rsiVal < 30 ? "Oversold (<30)" : rsiVal > 70 ? "Overbought (>70)" : "Neutral Zone"}
                />

                <SignalCard
                    label="MFI (14)"
                    value={mfiVal.toFixed(1)}
                    icon={mfiVal < 20 ? DollarSign : Activity}
                    status={mfiVal < 20 ? 'buy' : mfiVal > 80 ? 'sell' : 'neutral'}
                    desc={mfiVal < 20 ? "Outflow Extreme (<20)" : mfiVal > 80 ? "Inflow Extreme (>80)" : "Normal Flow"}
                />

                <SignalCard
                    label="Wait for..."
                    value={`$${targetPrice.toFixed(2)}`}
                    icon={CheckCircle}
                    status="neutral"
                    desc={`Bollinger Low (-${targetDrop.toFixed(1)}%)`}
                />
            </div>

            {/* 2. Charts */}
            <div className="grid lg:grid-cols-1 gap-6">
                {/* Top: Price & Bollinger */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
                    <div className="flex justify-between items-center mb-4 pl-2">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white">Price Action & Support</h3>
                            <ChartInfo title="Bollinger Bands" description="The shaded area represents 2 standard deviations. Price touching the lower band often indicates a good entry point (support)." />
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={timeseries}>
                                <defs>
                                    <linearGradient id="colorBand" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                                <XAxis dataKey="date" hide />
                                <YAxis domain={['auto', 'auto']} stroke="#64748b" tickFormatter={(v) => `$${v}`} width={60} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                                <Legend />
                                <Area type="monotone" dataKey="bb_upper" stroke="none" fill="#3b82f6" fillOpacity={0.1} stackId="1" />
                                <Area type="monotone" dataKey="bb_lower" stroke="none" fill="#3b82f6" fillOpacity={0.1} stackId="1" />

                                <Line type="monotone" dataKey="price" stroke="#fff" strokeWidth={2} dot={false} name="Price" />
                                <Line type="monotone" dataKey="bb_upper" stroke="#3b82f6" strokeDasharray="3 3" dot={false} strokeOpacity={0.5} name="Upper Band" />
                                <Line type="monotone" dataKey="bb_lower" stroke="#3b82f6" strokeDasharray="3 3" dot={false} strokeOpacity={0.5} name="Lower Band (Buy)" />
                                <Line type="monotone" dataKey="bb_mid" stroke="#94a3b8" strokeWidth={1} dot={false} strokeOpacity={0.5} name="Moving Avg" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bottom: Momentum (RSI + MFI) */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
                    <div className="flex justify-between items-center mb-4 pl-2">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white">Momentum (RSI + MFI)</h3>
                            <ChartInfo title="RSI & MFI" description="RSI < 30 (Green Zone) indicates oversold. MFI < 20 indicates panic selling. When BOTH are low, it's a strong buy signal (SupeTV Strategy)." />
                        </div>
                    </div>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={timeseries}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(v) => v.split('-')[0]}
                                    stroke="#64748b"
                                    minTickGap={50}
                                />
                                <YAxis domain={[0, 100]} stroke="#64748b" width={40} ticks={[0, 20, 30, 50, 70, 80, 100]} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                                <Legend />

                                {/* Zones */}
                                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} label={{ value: "Overbought", fill: "#ef4444", fontSize: 10 }} />
                                <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" opacity={0.5} label={{ value: "Oversold", fill: "#10b981", fontSize: 10 }} />

                                <Line type="monotone" dataKey="rsi" stroke="#f59e0b" strokeWidth={2} dot={false} name="RSI (14)" />
                                <Line type="monotone" dataKey="mfi" stroke="#06b6d4" strokeWidth={2} dot={false} name="MFI (14)" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimingTab;
