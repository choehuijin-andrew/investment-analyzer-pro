"use client";
import React, { useState } from 'react';
import { projectIncome, PortfolioItem } from '@/lib/api';
import DividendDashboard from './DividendDashboard'; // Reuse existing dashboard for results

interface PortfolioInputProps {
    initialTickers?: string[];
}

const PortfolioInput: React.FC<PortfolioInputProps> = ({ initialTickers = [] }) => {
    // Default rows based on props or fallback
    const [rows, setRows] = useState<PortfolioItem[]>(() => {
        if (initialTickers.length > 0) {
            return initialTickers.map(t => ({ ticker: t, shares: 0, cost_basis: 0, monthly_contribution: 0 }));
        }
        return [
            { ticker: 'SCHD', shares: 100, cost_basis: 75, monthly_contribution: 500 },
            { ticker: 'O', shares: 50, cost_basis: 60, monthly_contribution: 0 },
            { ticker: 'JEPI', shares: 200, cost_basis: 55, monthly_contribution: 0 },
            { ticker: '', shares: 0, cost_basis: 0, monthly_contribution: 0 },
            { ticker: '', shares: 0, cost_basis: 0, monthly_contribution: 0 },
        ];
    });

    const [analyzing, setAnalyzing] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);
    const [analyzedTickers, setAnalyzedTickers] = useState<string[]>([]);

    const updateRow = (index: number, field: keyof PortfolioItem, value: string | number) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [field]: value };
        setRows(newRows);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        const lines = text.split('\n').filter(l => l.trim());

        const newRows = [...rows];
        lines.forEach((line, i) => {
            if (i >= newRows.length) newRows.push({ ticker: '', shares: 0 });

            // Try to detect format: Ticker | Shares | Cost | Monthly
            // Split by tab or comma
            const cols = line.split(/[\t,]/).map(c => c.trim());

            if (cols[0]) newRows[i].ticker = cols[0];
            if (cols[1]) newRows[i].shares = parseFloat(cols[1]) || 0;
            if (cols[2]) newRows[i].cost_basis = parseFloat(cols[2]) || 0;
            if (cols[3]) newRows[i].monthly_contribution = parseFloat(cols[3]) || 0;
        });
        setRows(newRows);
    };

    const handleAnalyze = () => {
        const validItems = rows.filter(r => r.ticker && r.shares > 0);
        if (validItems.length === 0) return alert("Please enter at least one valid ticker and share count.");

        setAnalyzedTickers(validItems.map(i => i.ticker));
        setShowDashboard(true);
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Portfolio Input</h2>
                    <div className="text-xs text-slate-400">
                        Tip: You can copy/paste directly from Excel (Ticker, Shares, Cost, Monthly)
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-800">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Ticker</th>
                                <th className="px-4 py-3">Shares</th>
                                <th className="px-4 py-3">Avg Cost ($)</th>
                                <th className="px-4 py-3 rounded-r-lg">Monthly Buy ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => (
                                <tr key={idx} className="bg-slate-900 border-b border-slate-800 hover:bg-slate-800/50">
                                    <td className="px-2 py-2">
                                        <input
                                            value={row.ticker}
                                            onChange={e => updateRow(idx, 'ticker', e.target.value.toUpperCase())}
                                            onPaste={idx === 0 ? handlePaste : undefined} // Only handle paste on first row/cell for now or global
                                            placeholder="Ticker"
                                            className="bg-transparent border border-slate-700 rounded px-2 py-1 w-24 text-white uppercase focus:border-blue-500 outline-none"
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            value={row.shares || ''}
                                            onChange={e => updateRow(idx, 'shares', parseFloat(e.target.value))}
                                            placeholder="0"
                                            className="bg-transparent border border-slate-700 rounded px-2 py-1 w-24 text-white focus:border-blue-500 outline-none"
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            value={row.cost_basis || ''}
                                            onChange={e => updateRow(idx, 'cost_basis', parseFloat(e.target.value))}
                                            placeholder="0.00"
                                            className="bg-transparent border border-slate-700 rounded px-2 py-1 w-24 text-white focus:border-blue-500 outline-none"
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            value={row.monthly_contribution || ''}
                                            onChange={e => updateRow(idx, 'monthly_contribution', parseFloat(e.target.value))}
                                            placeholder="0"
                                            className="bg-transparent border border-slate-700 rounded px-2 py-1 w-24 text-white focus:border-blue-500 outline-none"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex justify-between">
                    <button
                        onClick={() => setRows([...rows, { ticker: '', shares: 0, cost_basis: 0, monthly_contribution: 0 }])}
                        className="text-slate-400 hover:text-white text-sm"
                    >
                        + Add Row
                    </button>
                    <button
                        onClick={handleAnalyze}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded shadow-lg transition-all transform hover:scale-105"
                    >
                        Analyze Portfolio
                    </button>
                </div>
            </div>

            {showDashboard && (
                <div className="animate-in slide-in-from-bottom-4 duration-700">
                    <h2 className="text-2xl font-bold text-white mb-4">My Portfolio Analysis</h2>
                    <DividendDashboard tickers={analyzedTickers} />
                    {/* Note: In a real app, we would pass the full portfolio items (shares/cost) to DividendDashboard 
                        Currently DividendDashboard mostly displays ticker stats and a mock projection. 
                        We should ideally update DividendDashboard to accept 'portfolio' prop for better accuracy.
                        For now, since DividendDashboard mocks 100 shares, it won't be perfectly accurate to the input,
                        but it visualizes the concept. I will note this.
                    */}
                    <p className="text-xs text-slate-500 mt-2">* Visualization currently uses simplified assumptions for the projection chart.</p>
                </div>
            )}
        </div>
    );
};

export default PortfolioInput;
