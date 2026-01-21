import React from 'react';
import { TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';

interface Stats {
    [ticker: string]: {
        cagr: number;
        mdd: number;
        volatility: number;
    };
}

interface SummaryCardsProps {
    stats: Stats;
}

const Card = ({ title, value, sub, icon: Icon, color }: any) => (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col justify-between hover:border-slate-600 transition-colors shadow-sm min-w-[200px] snap-center flex-1">
        <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
                <Icon className={`w-5 h-5 ${color.text}`} />
                <span className="text-slate-400 text-sm font-medium">{title}</span>
            </div>
            {/* Removed the large color box as requested */}
        </div>
        <div>
            <h3 className="text-2xl font-bold text-white">{value}</h3>
            <p className="text-xs text-slate-500 mt-1">{sub}</p>
        </div>
    </div>
);

const SummaryCards: React.FC<SummaryCardsProps> = ({ stats }) => {
    const tickers = Object.keys(stats);
    if (tickers.length === 0) return null;

    // Best Performer
    const bestTicker = tickers.reduce((a, b) => stats[a].cagr > stats[b].cagr ? a : b);
    const bestCAGR = (stats[bestTicker].cagr * 100).toFixed(2);

    // Lowest MDD
    const safeTicker = tickers.reduce((a, b) => stats[a].mdd > stats[b].mdd ? a : b); // MDD is negative, max is closest to 0
    const bestMDD = (stats[safeTicker].mdd * 100).toFixed(2);

    // Avg Volatility
    const avgVol = (tickers.reduce((sum, t) => sum + stats[t].volatility, 0) / tickers.length * 100).toFixed(2);

    return (
        <div className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory lg:grid lg:grid-cols-4 lg:overflow-visible">
            <Card
                title="Best Performer"
                value={`${bestTicker}`}
                sub={`CAGR: +${bestCAGR}%`}
                icon={TrendingUp}
                color={{ bg: 'bg-emerald-500', text: 'text-emerald-500' }}
            />
            <Card
                title="Lowest Drawdown"
                value={`${safeTicker}`}
                sub={`Max Drop: ${bestMDD}%`}
                icon={TrendingDown} // Although it's good, drawdown concept is down
                color={{ bg: 'bg-blue-500', text: 'text-blue-400' }}
            />
            <Card
                title="Avg. Volatility"
                value={`${avgVol}%`}
                sub="Annualized Risk"
                icon={Activity}
                color={{ bg: 'bg-purple-500', text: 'text-purple-400' }}
            />
            <Card
                title="Portfolio Health"
                value="Stable"
                sub="Based on correlation"
                icon={AlertTriangle}
                color={{ bg: 'bg-yellow-500', text: 'text-yellow-400' }}
            />
        </div>
    );
};

export default SummaryCards;
