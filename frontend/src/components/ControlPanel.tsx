import React, { useState } from 'react';
import { Search, Calendar, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ControlPanelProps {
    onAnalyze: (tickers: string[], startDate: string, endDate: string) => void;
    isLoading: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onAnalyze, isLoading }) => {
    const [tickersInput, setTickersInput] = useState('SPY, SCHD, TLT');
    const [startDate, setStartDate] = useState('2020-01-01');
    const [endDate, setEndDate] = useState('2023-12-31');

    const handleAnalyze = () => {
        const tickers = tickersInput.split(',').map((t) => t.trim().toUpperCase()).filter(t => t);
        onAnalyze(tickers, startDate, endDate);
    };

    return (
        <div className="w-full md:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 h-screen overflow-y-auto fixed left-0 top-0 z-10 text-slate-100 shadow-xl">
            <div className="mb-4">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Investment Analyzer
                </h1>
                <p className="text-xs text-slate-400 mt-1">Pro Investment Tools</p>
            </div>

            <div className="space-y-4">
                {/* Tickers Input */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Tickers</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                        <input
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                            value={tickersInput}
                            onChange={(e) => setTickersInput(e.target.value)}
                            placeholder="SPY, QQQ, GLD..."
                        />
                    </div>
                    <p className="text-xs text-slate-500">Comma separated</p>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Period</label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                            <input
                                type="date"
                                className="w-full bg-slate-800 border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <input
                                type="date"
                                className="w-full bg-slate-800 border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Analyze Button */}
                <button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className={cn(
                        "w-full py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20",
                        isLoading
                            ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                            : "bg-emerald-500 hover:bg-emerald-600 text-slate-900 hover:scale-[1.02]"
                    )}
                >
                    {isLoading ? (
                        <span className="animate-pulse">Analyzing...</span>
                    ) : (
                        <>
                            <Play className="w-4 h-4 fill-current" />
                            Analyze Portfolio
                        </>
                    )}
                </button>
            </div>

            <div className="mt-auto pt-6 border-t border-slate-800">
                <div className="text-xs text-slate-500 bg-slate-800/50 p-3 rounded">
                    Designed for high-performance backtesting. Uses Adj Close for Total Return.
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
