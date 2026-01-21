"use client";
import React, { useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { checkOverlap } from '@/lib/api';

interface EtfComparisonProps {
    availableTickers: string[];
}

const EtfComparison: React.FC<EtfComparisonProps> = ({ availableTickers }) => {
    const [selected, setSelected] = useState<string[]>([]);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const toggleTicker = (t: string) => {
        if (selected.includes(t)) {
            setSelected(selected.filter(x => x !== t));
        } else {
            if (selected.length < 2) {
                setSelected([...selected, t]);
            } else {
                alert("Max 2 ETFs for comparison");
            }
        }
    };

    const handleCompare = async () => {
        if (selected.length < 2) return;
        setLoading(true);
        try {
            const data = await checkOverlap(selected);
            setResult(data);
        } catch (e) {
            console.error(e);
            alert("Failed to fetch overlap data (Holdings may not be available)");
        }
        setLoading(false);
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">ETF Comparison</h3>
                <span className="text-xs text-slate-500">Holdings Overlap</span>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
                {availableTickers.map(t => (
                    <button
                        key={t}
                        onClick={() => toggleTicker(t)}
                        className={`px-2 py-1 text-xs rounded border transition-colors ${selected.includes(t)
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'
                            }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <button
                onClick={handleCompare}
                disabled={selected.length < 2 || loading}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-900 font-bold py-2 px-4 rounded mb-4 text-sm"
            >
                {loading ? 'Analyzing...' : 'Compare Selected'}
            </button>

            {/* Results Display */}
            {result && result.overlap && (
                <div className="flex-1 overflow-auto space-y-4">
                    {/* Summary Row */}
                    <div className="flex gap-2 h-10">
                        <div className="flex-1 bg-slate-900 rounded flex items-center justify-between px-3">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Common Holdings</span>
                            <span className="text-lg font-bold text-white">{result.overlap.common_count}</span>
                        </div>
                        <div className="flex-1 bg-slate-900 rounded flex items-center justify-between px-3">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Overlap % {result.overlap.source === 'etfrc_scrape' ? '(Weight)' : '(Count)'}</span>
                            <span className="text-lg font-bold text-emerald-400">
                                {result.overlap.overlap_pct !== undefined
                                    ? result.overlap.overlap_pct.toFixed(1)
                                    : (result.overlap.total_count > 0
                                        ? ((result.overlap.common_count / result.overlap.total_count) * 100).toFixed(1)
                                        : 0)}%
                            </span>
                        </div>
                    </div>

                    {/* Details Grid: Sector Drift (Left) + Holdings (Right) */}
                    <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
                        {/* Sector Drift Chart */}
                        <div className="bg-slate-900 p-2 rounded flex flex-col h-[200px]">
                            <h4 className="text-[10px] font-bold text-slate-400 mb-1 uppercase truncate">Sector Drift ({selected[0]} - {selected[1]})</h4>
                            <div className="flex-1 min-h-0">
                                {result.overlap.sector_drift && result.overlap.sector_drift.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            layout="vertical"
                                            data={result.overlap.sector_drift}
                                            margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                                        >
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="sector" type="category" width={90} tick={{ fontSize: 10, fill: '#ffffff', fontWeight: 500 }} interval={0} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff', fontSize: '10px' }}
                                                formatter={(value: any) => [`${value}%`, 'Drift']}
                                            />
                                            <Bar dataKey="drift" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                                {
                                                    result.overlap.sector_drift.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={entry.drift > 0 ? '#60a5fa' : '#f87171'} />
                                                    ))
                                                }
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-500 text-[10px]">No sector data</div>
                                )}
                            </div>
                        </div>

                        {/* Holdings Table */}
                        <div className="bg-slate-900 p-2 rounded flex flex-col h-[200px] overflow-hidden">
                            <h4 className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Overlapping Holdings</h4>
                            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                                {result.overlap.detailed_holdings && result.overlap.detailed_holdings.length > 0 ? (
                                    <table className="w-full text-[10px] text-left text-slate-300">
                                        <thead className="text-slate-500 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
                                            <tr>
                                                <th className="py-1">Company</th>
                                                <th className="py-1 text-right">Wt {selected[0]}</th>
                                                <th className="py-1 text-right">Wt {selected[1]}</th>
                                                <th className="py-1 text-right">Overlap</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.overlap.detailed_holdings.map((h: any, i: number) => (
                                                <tr key={i} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50">
                                                    <td className="py-1 font-medium text-white truncate max-w-[80px]" title={h.ticker}>{h.ticker}</td>
                                                    <td className="py-1 text-right">{h.weight1}</td>
                                                    <td className="py-1 text-right">{h.weight2}</td>
                                                    <td className="py-1 text-right text-emerald-400 font-bold">{h.overlap_weight}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="text-[10px] text-slate-300">
                                        <p className="mb-1 font-bold">Top Common Holdings (Est.):</p>
                                        <div className="flex flex-wrap gap-1">
                                            {result.overlap.common_holdings.slice(0, 15).map((h: string) => (
                                                <span key={h} className="bg-slate-700 px-2 py-0.5 rounded text-[9px]">{h}</span>
                                            ))}
                                            {result.overlap.common_holdings.length === 0 && (
                                                <span className="text-slate-500 italic">No overlap found</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {!result && !loading && (
                <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
                    Select 2+ ETFs to compare holdings
                </div>
            )}
        </div>
    );
};

export default EtfComparison;
