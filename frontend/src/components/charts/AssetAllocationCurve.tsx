"use client";
import React, { useState, useEffect } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LabelList
} from 'recharts';
import { simulateAllocation } from '@/lib/api';

interface AssetAllocationCurveProps {
    data: any[];
    availableTickers?: string[];
    headless?: boolean;
}

const AssetAllocationCurve: React.FC<AssetAllocationCurveProps> = ({ data, availableTickers = [], headless = false }) => {
    const [curveData, setCurveData] = useState<any[]>(data || []);
    const [asset1, setAsset1] = useState<string>('');
    const [asset2, setAsset2] = useState<string>('');

    // Axis Controls
    const [xMin, setXMin] = useState<string>('');
    const [xMax, setXMax] = useState<string>('');
    const [yMin, setYMin] = useState<string>('');
    const [yMax, setYMax] = useState<string>('');

    useEffect(() => {
        if (data && data.length > 0) {
            setCurveData(data);
            if (!asset1) setAsset1(data[0].t1);
            if (!asset2) setAsset2(data[0].t2);
        }
    }, [data]);

    const handleSimulate = async () => {
        // Prevent simulation with same asset
        if (asset1 === asset2) {
            alert("Please select two different assets for simulation.");
            return;
        }

        if (!asset1 || !asset2) return;
        try {
            // Hardcoded dates for now, ideally passed from parent or context
            const result = await simulateAllocation([asset1, asset2], "2020-01-01", "2023-12-31");
            setCurveData(result.curve);
        } catch (e) {
            console.error(e);
            alert("Simulation failed");
        }
    };

    // Convert to % for display
    const chartData = curveData.map(d => ({
        ...d,
        riskPct: d.risk * 100,
        returnPct: d.return * 100,
        tooltipLabel: `${d.label} (${d.t1}:${d.t2})`
    }));

    // Clean tickers list if passed, or extract from data if not (though data only has 2)
    // Use passed availableTickers from parent
    const tickers = availableTickers.length > 0 ? availableTickers : (chartData.length > 0 ? [chartData[0].t1, chartData[0].t2] : []);

    const Container = headless ? 'div' : 'div';
    const containerClasses = headless
        ? "h-full flex flex-col"
        : "bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm h-full flex flex-col";

    return (
        <div className={containerClasses}>
            <div className={`flex flex-col gap-2 ${headless ? 'mb-2' : 'mb-4'}`}>
                <div className="flex justify-between items-center flex-wrap gap-2">
                    {!headless && (
                        <div>
                            <h3 className="text-lg font-bold text-white">Risk and Return Simulator</h3>
                            <p className="text-xs text-slate-400">Correlation & Efficient Frontier</p>
                        </div>
                    )}

                    {/* Combined Toolbar Area */}
                    <div className={`flex flex-1 items-center justify-between gap-2 ${headless ? 'w-full' : ''}`}>
                        {/* Asset Selectors (Left) */}
                        <div className="flex gap-2 items-center">
                            <select
                                className="bg-slate-700 text-white text-xs p-1 rounded border border-slate-600"
                                value={asset1}
                                onChange={(e) => setAsset1(e.target.value)}
                            >
                                {tickers.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <span className="text-slate-500 text-xs">vs</span>
                            <select
                                className="bg-slate-700 text-white text-xs p-1 rounded border border-slate-600"
                                value={asset2}
                                onChange={(e) => setAsset2(e.target.value)}
                            >
                                {tickers.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <button
                                onClick={handleSimulate}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded"
                            >
                                Run
                            </button>
                        </div>

                        {/* Axis Controls (Right) */}
                        <div className="flex gap-2 text-xs">
                            <div className="flex flex-col gap-1">
                                <input placeholder="Min X" className="bg-slate-900 border border-slate-700 w-12 px-1 rounded text-white" value={xMin} onChange={e => setXMin(e.target.value)} />
                                <input placeholder="Max X" className="bg-slate-900 border border-slate-700 w-12 px-1 rounded text-white" value={xMax} onChange={e => setXMax(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <input placeholder="Min Y" className="bg-slate-900 border border-slate-700 w-12 px-1 rounded text-white" value={yMin} onChange={e => setYMin(e.target.value)} />
                                <input placeholder="Max Y" className="bg-slate-900 border border-slate-700 w-12 px-1 rounded text-white" value={yMax} onChange={e => setYMax(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 12, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            type="number"
                            dataKey="riskPct"
                            name="Risk"
                            unit="%"
                            stroke="#94a3b8"
                            label={{ value: 'Risk (Volatility)', position: 'insideBottomRight', offset: -5, fill: '#64748b' }}
                            domain={[xMin ? Number(xMin) : 'auto', xMax ? Number(xMax) : 'auto']}
                            allowDataOverflow
                            padding={{ left: 20, right: 20 }}
                        />
                        <YAxis
                            type="number"
                            dataKey="returnPct"
                            name="Return"
                            unit="%"
                            stroke="#94a3b8"
                            label={{ value: 'Return (CAGR)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                            domain={[yMin ? Number(yMin) : 'auto', yMax ? Number(yMax) : 'auto']}
                            allowDataOverflow
                            padding={{ top: 20, bottom: 20 }}
                        />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-xs">
                                            <p className="font-bold text-amber-400 mb-1">{d.tooltipLabel}</p>
                                            <p className="text-slate-300">Return: {d.returnPct.toFixed(2)}%</p>
                                            <p className="text-slate-400">Risk: {d.riskPct.toFixed(2)}%</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Scatter name="Allocation" data={chartData} fill="#f59e0b" line={{ stroke: '#f59e0b', strokeWidth: 2 }} shape="circle">
                            <LabelList dataKey="label" position="top" style={{ fill: '#e2e8f0', fontSize: '10px', fontWeight: 'bold' }} />
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AssetAllocationCurve;
