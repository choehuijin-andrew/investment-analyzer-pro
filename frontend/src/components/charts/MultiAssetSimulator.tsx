"use client";
import React, { useState } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { simulateMultiAsset } from '@/lib/api';

interface SimulationResult {
    weights: { [ticker: string]: number };
    return: number;
    risk: number;
    sharpe: number;
}

const MultiAssetSimulator: React.FC = () => {
    // State
    const [tickers, setTickers] = useState<string[]>(['SPY', 'QQQ', 'TLT']);
    const [inputValue, setInputValue] = useState('');

    // New Data Structure
    const [frontier, setFrontier] = useState<SimulationResult[]>([]);
    const [maxSharpe, setMaxSharpe] = useState<SimulationResult | null>(null);
    const [minVol, setMinVol] = useState<SimulationResult | null>(null);

    const [loading, setLoading] = useState(false);
    const [selectedPoint, setSelectedPoint] = useState<SimulationResult | null>(null);

    // Handlers
    const addTicker = () => {
        const t = inputValue.toUpperCase().trim();
        if (t && !tickers.includes(t) && tickers.length < 10) {
            setTickers([...tickers, t]);
            setInputValue('');
        }
    };

    const removeTicker = (t: string) => {
        setTickers(tickers.filter(x => x !== t));
    };

    const handleRun = async () => {
        if (tickers.length < 2) return;
        setLoading(true);
        try {
            const res = await simulateMultiAsset(tickers);
            // Backend now returns { frontier, max_sharpe, min_vol }
            if (res.frontier) {
                setFrontier(res.frontier);
                setMaxSharpe(res.max_sharpe);
                setMinVol(res.min_vol);
                setSelectedPoint(res.max_sharpe); // Default select Max Sharpe
            } else {
                // Fallback for legacy format if any
                setFrontier(res.simulation || []);
                setSelectedPoint(null);
            }
        } catch (e) {
            console.error(e);
            alert("Simulation failed");
        }
        setLoading(false);
    };

    // Helper to get color based on Sharpe (reuses existing logic if needed, but curve is usually single color)
    // We will color the line simply, and highlight special points.

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Controls */}
            <div className="flex flex-wrap gap-2 items-center bg-slate-900 p-3 rounded">
                <div className="flex flex-wrap gap-2 items-center flex-1">
                    {tickers.map(t => (
                        <span key={t} className="bg-slate-700 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                            {t}
                            <button onClick={() => removeTicker(t)} className="text-slate-400 hover:text-white">×</button>
                        </span>
                    ))}
                    <div className="flex gap-1">
                        <input
                            className="bg-slate-800 text-white text-xs p-1 rounded border border-slate-700 w-20"
                            placeholder="Ticker"
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTicker()}
                        />
                        <button onClick={addTicker} className="text-slate-400 hover:text-white text-lg leading-none">+</button>
                    </div>
                </div>
                <button
                    onClick={handleRun}
                    disabled={loading || tickers.length < 2}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-4 py-2 rounded font-bold"
                >
                    {loading ? 'Optimizing...' : 'Run Analysis'}
                </button>
            </div>

            {/* Content: Chart + Details */}
            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden overflow-y-auto lg:overflow-y-hidden">
                {/* Chart Area */}
                <div className="flex-1 bg-slate-900 rounded p-2 relative flex flex-col min-h-[300px] lg:min-h-0">
                    {!frontier.length && !loading && (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                            Add assets and click Run to calculate Efficient Frontier.
                        </div>
                    )}
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis
                                    type="number"
                                    dataKey="risk"
                                    name="Risk"
                                    stroke="#94a3b8"
                                    tickFormatter={v => (v * 100).toFixed(1) + '%'}
                                    domain={['auto', 'auto']}
                                    padding={{ left: 20, right: 20 }}
                                    label={{ value: 'Risk (Volatility)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 12 }}
                                />
                                <YAxis
                                    type="number"
                                    dataKey="return"
                                    name="Return"
                                    stroke="#94a3b8"
                                    tickFormatter={v => (v * 100).toFixed(1) + '%'}
                                    domain={['auto', 'auto']}
                                    padding={{ top: 20, bottom: 20 }}
                                    label={{ value: 'Return (CAGR)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                                />
                                <Tooltip
                                    cursor={{ strokeDasharray: '3 3' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const d = payload[0].payload;
                                            return (
                                                <div className="bg-slate-800 border border-slate-600 p-2 rounded shadow-xl text-xs text-white">
                                                    <div className="font-bold mb-1 text-emerald-400">
                                                        {d === maxSharpe ? "★ Max Sharpe" : (d === minVol ? "◆ Min Volatility" : "Efficient Point")}
                                                    </div>
                                                    <div>Return: {(d.return * 100).toFixed(2)}%</div>
                                                    <div>Risk: {(d.risk * 100).toFixed(2)}%</div>
                                                    <div>Sharpe: {d.sharpe.toFixed(2)}</div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                {/* Efficient Frontier Line */}
                                <Scatter
                                    name="Efficient Frontier"
                                    data={frontier}
                                    fill="#8884d8"
                                    line={{ stroke: '#8b5cf6', strokeWidth: 2 }}
                                    shape="circle"
                                    onClick={(data) => setSelectedPoint(data.payload)}
                                />
                                {/* Highlights */}
                                {maxSharpe && (
                                    <Scatter name="Max Sharpe" data={[maxSharpe]} fill="#f59e0b" shape="star" zAxisId={10} onClick={(data) => setSelectedPoint(data.payload)}>
                                        <Cell fill="#f59e0b" stroke="#fff" strokeWidth={2} />
                                    </Scatter>
                                )}
                                {minVol && (
                                    <Scatter name="Min Vol" data={[minVol]} fill="#3b82f6" shape="diamond" zAxisId={10} onClick={(data) => setSelectedPoint(data.payload)}>
                                        <Cell fill="#3b82f6" stroke="#fff" strokeWidth={2} />
                                    </Scatter>
                                )}
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>

                </div>

                {/* Details Panel */}
                <div className="w-full lg:w-48 bg-slate-900 rounded p-3 flex flex-col h-auto lg:h-full shrink-0">
                    <h4 className="text-white text-xs font-bold mb-2 uppercase border-b border-slate-700 pb-1">
                        {selectedPoint ? 'Portfolio Details' : 'Select a Point'}
                    </h4>

                    {selectedPoint ? (
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <div className="mb-3 space-y-1">
                                <div className="flex justify-between text-xs text-emerald-400 font-bold">
                                    <span>Return</span>
                                    <span>{(selectedPoint.return * 100).toFixed(2)}%</span>
                                </div>
                                <div className="flex justify-between text-xs text-blue-400 font-bold">
                                    <span>Risk</span>
                                    <span>{(selectedPoint.risk * 100).toFixed(2)}%</span>
                                </div>
                                <div className="flex justify-between text-xs text-amber-400 font-bold">
                                    <span>Sharpe</span>
                                    <span>{selectedPoint.sharpe.toFixed(2)}</span>
                                </div>
                            </div>

                            <table className="w-full text-[10px] text-slate-300">
                                <thead>
                                    <tr className="text-slate-500 border-b border-slate-700">
                                        <th className="text-left py-1">Asset</th>
                                        <th className="text-right py-1">Weight</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(selectedPoint.weights)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([ticker, weight]) => (
                                            <tr key={ticker} className="border-b border-slate-800 last:border-0">
                                                <td className="py-1 font-medium text-white">{ticker}</td>
                                                <td className="py-1 text-right">{(weight * 100).toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 text-[10px] gap-2 min-h-[100px] lg:min-h-0">
                            <p>Click the Chart or Table to view details.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MultiAssetSimulator;
