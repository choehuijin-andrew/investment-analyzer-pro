import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface StockSidebarProps {
    initialTickers: string[];
    selectedTicker: string;
    onSelectTicker: (ticker: string) => void;
}

const StockSidebar: React.FC<StockSidebarProps> = ({ initialTickers, selectedTicker, onSelectTicker }) => {
    // Merge user provided tickers with some defaults or just use provided
    const [tickerList, setTickerList] = useState<string[]>(initialTickers.length > 0 ? initialTickers : ['AAPL', 'MSFT', 'SCHD', 'JEPI']);

    const handleAddTicker = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const input = form.elements.namedItem('ticker') as HTMLInputElement;
        if (input.value) {
            const t = input.value.toUpperCase();
            if (!tickerList.includes(t)) {
                setTickerList([...tickerList, t]);
            }
            onSelectTicker(t);
            input.value = '';
        }
    }

    return (
        <div className="w-80 flex-shrink-0 bg-slate-900 border-r border-slate-800 p-6 flex flex-col h-full fixed left-0 top-0 overflow-hidden">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-lg mt-16">
                Watchlist
            </h3>

            <form onSubmit={handleAddTicker} className="mb-4 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                    name="ticker"
                    placeholder="Add Symbol (e.g. KO)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
            </form>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                {tickerList.map(t => (
                    <button
                        key={t}
                        onClick={() => onSelectTicker(t)}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex justify-between items-center group
                            ${selectedTicker === t
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'}`}
                    >
                        <span className="font-bold">{t}</span>
                    </button>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 text-center">
                Select a ticker to view detailed analysis
            </div>
        </div>
    );
};

export default StockSidebar;
