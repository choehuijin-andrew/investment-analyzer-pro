"use client";
import React, { useState } from 'react';
import ControlPanel from '@/components/ControlPanel';
import SummaryCards from '@/components/SummaryCards';
import CumulativeReturns from '@/components/charts/CumulativeReturns';
import RiskRewardScatter from '@/components/charts/RiskRewardScatter';
import SimulatorContainer from '@/components/charts/SimulatorContainer';
import CorrelationHeatmap from '@/components/charts/CorrelationHeatmap';
import EtfComparison from '@/components/EtfComparison';
import RollingReturns from '@/components/charts/RollingReturns';
import DrawdownChart from '@/components/charts/DrawdownChart';

import PortfolioInput from '@/components/PortfolioInput';
import StockDashboard from '@/components/StockDashboard/StockDashboard';
import StockSidebar from '@/components/StockDashboard/StockSidebar';
import { analyzePortfolio, analyzeAdvanced } from '@/lib/api';

import { Menu, X } from 'lucide-react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'advanced' | 'portfolio' | 'inspector'>('dashboard');
  const [analysisParams, setAnalysisParams] = useState<{ tickers: string[], start: string, end: string } | null>(null);
  const [advancedData, setAdvancedData] = useState<any>(null);
  const [inspectorTicker, setInspectorTicker] = useState<string>('AAPL');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch Advanced Data when Tab Switches
  React.useEffect(() => {
    if (activeTab === 'advanced' && analysisParams && !advancedData) {
      const fetchAdvanced = async () => {
        try {
          const result = await analyzeAdvanced(analysisParams.tickers, analysisParams.start, analysisParams.end);
          setAdvancedData(result);
        } catch (e) {
          console.error("Advanced fetch failed", e);
        }
      };
      fetchAdvanced();
    }
  }, [activeTab, analysisParams, advancedData]);

  const handleAnalyze = async (tickers: string[], start: string, end: string) => {
    setLoading(true);
    setAdvancedData(null); // Reset cache for advanced tab
    setAnalysisParams({ tickers, start, end });
    setInspectorTicker(tickers[0]); // Update Inspector Default to first ticker
    try {
      const result = await analyzePortfolio(tickers, start, end);
      setData(result);
    } catch (error) {
      console.error(error);
      alert("Analysis failed. Please check tickers and try again. (Make sure Backend is running)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 overflow-hidden relative">

      {/* Mobile Header (Only visible on small screens) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-50">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400 hover:text-white">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
        <span className="font-bold text-lg bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
          Analyzer Pro
        </span>
        <div className="w-8"></div> {/* Spacer for alignment */}
      </div>

      {/* Responsive Sidebar Container */}
      {/* Mobile: Fixed full-screen overlay (Drawer) */}
      {/* Desktop: Static relative flex item */}
      <div className={`
          fixed inset-y-0 left-0 z-40 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 transition-transform duration-300 w-80
          lg:relative lg:translate-x-0 lg:bg-slate-900/50 lg:backdrop-blur-none
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full pt-16 lg:pt-0"> {/* Padding top on mobile for header */}
          {activeTab === 'inspector' ? (
            <StockSidebar
              initialTickers={analysisParams?.tickers || ['SPY', 'QQQ', 'SCHD', 'TLT', 'GLD']}
              selectedTicker={inspectorTicker}
              onSelectTicker={(t) => { setInspectorTicker(t); setIsMobileMenuOpen(false); }}
            />
          ) : (
            <ControlPanel onAnalyze={(t, s, e) => { handleAnalyze(t, s, e); setIsMobileMenuOpen(false); }} isLoading={loading} />
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 pt-16 lg:pt-0 h-screen"> {/* Add padding for mobile header */}

        {/* Header / Top Bar Area */}
        <div className="p-4 lg:p-8 pb-0">
          <div className="flex flex-col lg:flex-row justify-between items-start mb-4 lg:mb-8 gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent mb-2 hidden lg:block">
                Investment Analyzer Pro
              </h1>
              <p className="text-slate-400 text-sm lg:text-base hidden lg:block">Comprehensive portfolio analysis and asset management tool</p>
            </div>

            {/* Unified Tab Navigation - Scrollable on Mobile */}
            <div className="w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
              <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 backdrop-blur-sm min-w-max">
                {[
                  { id: 'dashboard', label: 'Performance' },
                  { id: 'advanced', label: 'Risk & Strategy' },
                  { id: 'inspector', label: 'Stock Inspector' },
                  { id: 'portfolio', label: 'Portfolio Editor' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 whitespace-nowrap
                                    ${activeTab === tab.id
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 pt-0 scrollbar-thin scrollbar-thumb-slate-800 pb-20 lg:pb-8">

          {!data && activeTab !== 'portfolio' && activeTab !== 'inspector' ? (
            <div className="h-[50vh] lg:h-[60vh] flex flex-col items-center justify-center opacity-30 pointer-events-none border-2 border-dashed border-slate-800 rounded-3xl mx-auto max-w-4xl mt-4 lg:mt-10 p-4 text-center">
              <h1 className="text-2xl lg:text-4xl font-bold mb-4">Ready to Analyze</h1>
              <p>Enter tickers in the sidebar to generate report</p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* 1. Performance (Dashboard) */}
              {activeTab === 'dashboard' && data && (
                <>
                  <SummaryCards stats={data.summary} />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 auto-rows-[minmax(400px,auto)]">
                    <div className="min-h-[400px] h-full"><CumulativeReturns dataTR={data.charts.trend_tr} dataPR={data.charts.trend_pr} /></div>
                    <div className="min-h-[400px] h-full"><RiskRewardScatter stats={data.summary} /></div>
                    <div className="min-h-[400px] h-full"><SimulatorContainer data={data.charts.allocation_curve} availableTickers={data.summary ? Object.keys(data.summary) : []} /></div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-[minmax(500px,auto)]">
                    <div className="min-h-[450px] h-full overflow-hidden"><CorrelationHeatmap data={data.charts.correlation} /></div>
                    <div className="min-h-[450px] h-full overflow-hidden"><EtfComparison availableTickers={data.summary ? Object.keys(data.summary) : []} /></div>
                  </div>
                </>
              )}

              {/* 2. Risk & Strategy (Advanced) */}
              {activeTab === 'advanced' && (
                <div className="space-y-8">
                  {!advancedData ? (
                    <div className="flex flex-col items-center justify-center p-20 h-[400px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-4"></div>
                      <p className="text-slate-400">Loading Risk Metrics...</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-[minmax(400px,auto)]">
                        <div className="min-h-[400px] h-full"><RollingReturns data={advancedData.rolling_1y} /></div>
                        <div className="min-h-[400px] h-full"><DrawdownChart data={advancedData.drawdowns} /></div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 3. Stock Inspector */}
              {activeTab === 'inspector' && (
                <div className="h-[calc(100vh-180px)] lg:h-[calc(100vh-140px)]">
                  <StockDashboard
                    tickers={analysisParams?.tickers || []}
                    activeTicker={inspectorTicker}
                  />
                </div>
              )}

              {/* 4. Portfolio Editor */}
              {activeTab === 'portfolio' && (
                <div className="max-w-4xl mx-auto">
                  <PortfolioInput initialTickers={analysisParams?.tickers} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main >
  );
}
