import React, { useState } from 'react';
import { Search, X, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
    symbol: string;
    name: string;
    exchange: string;
    typeDisp: string;
}

interface StockSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (ticker: string) => void;
}

const StockSearchModal: React.FC<StockSearchModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsLoading(true);
        setError('');
        setResults([]);

        try {
            // Dynamic API URL for LAN support
            // If NEXT_PUBLIC_API_URL is set, use it. Otherwise, infer from current hostname.
            // This allows laptops/phones to hit the backend on the same IP as the frontend.
            let baseUrl = process.env.NEXT_PUBLIC_API_URL;
            if (!baseUrl && typeof window !== 'undefined') {
                baseUrl = `http://${window.location.hostname}:8000`;
            }
            const API_URL = baseUrl || 'http://localhost:8000';
            const res = await fetch(`${API_URL}/api/search?query=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error('Search failed');

            const data = await res.json();
            setResults(data);
        } catch (err) {
            console.error(err);
            // If backend returns 400/500, it's likely a query issue (e.g. pure Korean text rejected by Yahoo)
            setError('Search failed. Try searching in English (e.g. "Samsung") or by Code (e.g. "005930").');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <h3 className="text-lg font-bold text-white">Search Stock</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="p-4 border-b border-slate-800">
                    <div className="relative">
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type company name (e.g. Samsung)"
                            className="w-full bg-slate-800 border-slate-700 rounded-lg py-3 pl-4 pr-12 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <button
                            onClick={handleSearch}
                            className="absolute right-2 top-2 p-1 bg-emerald-600 hover:bg-emerald-500 rounded-md text-white transition-colors"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {error && (
                        <div className="p-4 text-center text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {!isLoading && results.length === 0 && query && !error && (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            No results found.
                        </div>
                    )}

                    {results.map((item) => (
                        <button
                            key={item.symbol}
                            onClick={() => {
                                onSelect(item.symbol);
                                onClose();
                            }}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-800 transition-colors text-left group"
                        >
                            <div>
                                <div className="font-bold text-emerald-400 text-sm">{item.symbol}</div>
                                <div className="text-white text-sm truncate max-w-[200px]">{item.name}</div>
                            </div>
                            <div className="text-xs text-slate-500 text-right">
                                <div>{item.exchange}</div>
                                <div>{item.typeDisp}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StockSearchModal;
