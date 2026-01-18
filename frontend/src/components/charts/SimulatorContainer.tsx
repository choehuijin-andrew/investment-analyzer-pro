"use client";
import React, { useState } from 'react';
import AssetAllocationCurve from './AssetAllocationCurve';
import MultiAssetSimulator from './MultiAssetSimulator';

interface SimulatorContainerProps {
    data: any[]; // Passed to AssetAllocationCurve initially
    availableTickers?: string[];
}

const SimulatorContainer: React.FC<SimulatorContainerProps> = ({ data, availableTickers }) => {
    const [activeTab, setActiveTab] = useState<'pair' | 'multi'>('pair');

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm h-full min-h-[400px] flex flex-col">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-bold text-white">Risk and Return Simulator</h3>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-900 rounded p-1 gap-1">
                    <button
                        onClick={() => setActiveTab('pair')}
                        className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'pair' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                        Pair Comparison
                    </button>
                    <button
                        onClick={() => setActiveTab('multi')}
                        className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'multi' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                        Multi-Asset (Beta)
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 relative overflow-hidden">
                {activeTab === 'pair' ? (
                    // We wrap AssetAllocationCurve in a simplified div because it has its own chrome (which we might want to hide or adapt)
                    // Actually, AssetAllocationCurve has its own card styling. 
                    // To avoid double borders, we might need to refactor AssetAllocationCurve or just render it inside.
                    // Let's render it directly but we might see nested cards. 
                    // Ideally check AssetAllocationCurve again.
                    // It has: <div className="bg-slate-800 ... p-5 ...">
                    // Since SimulatorContainer already has the frame, we should ideally strip it from AssetAllocationCurve.
                    // But for speed, I'll validly hack it by rendering it minus the outer classes? No, can't easily.
                    // I will render it and maybe obscure the outer padding via CSS or just accept nested cards for now.
                    // Better: I will use a refactor request to strip the container from AssetAllocationCurve later. 
                    // For now, let's just render it. A nested card isn't fatal.
                    <div className="h-full">
                        <AssetAllocationCurve data={data} availableTickers={availableTickers} headless={true} />
                    </div>
                ) : (
                    <MultiAssetSimulator />
                )}
            </div>
        </div>
    );
};

export default SimulatorContainer;
