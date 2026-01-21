"use client";
import React, { useState } from 'react';
import ChartInfo from '../common/ChartInfo';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ZAxis,
    Legend,
    Cell,
    LabelList
} from 'recharts';

interface RiskRewardScatterProps {
    stats: any;
}

const CustomLabel = (props: any) => {
    const { x, y, value, index, data } = props;
    // ...

    const pointData = data[index];
    const pos = pointData.labelPos || 'top';

    let dy = -10;
    let dx = 0;
    let textAnchor: "middle" | "start" | "end" | "inherit" = "middle";

    if (pos === 'top') { dy = -10; }
    else if (pos === 'bottom') { dy = 15; }
    else if (pos === 'left') { dx = -10; dy = 4; textAnchor = "end"; }
    else if (pos === 'right') { dx = 10; dy = 4; textAnchor = "start"; }

    return (
        <text
            x={x}
            y={y}
            dy={dy}
            dx={dx}
            fill="#e2e8f0"
            fontSize={12}
            fontWeight="bold"
            textAnchor={textAnchor}
            style={{ pointerEvents: 'none' }}
        >
            {value}
        </text>
    );
};

const RiskRewardScatter: React.FC<RiskRewardScatterProps> = ({ stats }) => {
    const [xDomain, setXDomain] = useState<[number | 'auto', number | 'auto']>(['auto', 'auto']);
    const [yDomain, setYDomain] = useState<[number | 'auto', number | 'auto']>(['auto', 'auto']);

    // Reset when stats change
    React.useEffect(() => {
        setXDomain(['auto', 'auto']);
        setYDomain(['auto', 'auto']);
    }, [stats]);

    if (!stats) return null;

    // 1. Prepare Data
    let data = Object.keys(stats).map(ticker => ({
        ticker,
        x: Math.abs(stats[ticker].mdd) * 100,
        y: stats[ticker].cagr * 100,
        z: 1,
        labelPos: 'top' // default
    }));

    // 2. Simple Collision Detection
    const THRESHOLD = 5;

    for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
            const p1 = data[i];
            const p2 = data[j];

            const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

            if (dist < THRESHOLD) {
                if (p1.labelPos === 'top') {
                    p2.labelPos = 'bottom';
                } else if (p1.labelPos === 'bottom') {
                    p2.labelPos = 'right';
                }
            }
        }
    }

    const handleWheel = (e: React.WheelEvent) => {
        const xValues = data.map(d => d.x);
        const yValues = data.map(d => d.y);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);

        let curMinX = typeof xDomain[0] === 'number' ? xDomain[0] : (minX * 0.9);
        let curMaxX = typeof xDomain[1] === 'number' ? xDomain[1] : (maxX * 1.1);
        let curMinY = typeof yDomain[0] === 'number' ? yDomain[0] : (minY * 0.9);
        let curMaxY = typeof yDomain[1] === 'number' ? yDomain[1] : (maxY * 1.1);

        const direction = e.deltaY > 0 ? 1 : -1;
        const factor = 0.1;

        const xRange = curMaxX - curMinX;
        const yRange = curMaxY - curMinY;

        if (direction === -1) {
            curMinX += xRange * factor;
            curMaxX -= xRange * factor;
            curMinY += yRange * factor;
            curMaxY -= yRange * factor;
        } else {
            curMinX -= xRange * factor;
            curMaxX += xRange * factor;
            curMinY -= yRange * factor;
            curMaxY += yRange * factor;
        }

        setXDomain([curMinX, curMaxX]);
        setYDomain([curMinY, curMaxY]);
    };

    return (
        <div
            className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm h-full min-h-[400px] flex flex-col"
            onWheel={handleWheel}
        >
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">Risk vs Reward Analysis</h3>
                        <ChartInfo
                            title="위험 대비 수익 (Risk vs Reward)"
                            description="각 자산의 변동성(위험) 대비 연평균 수익률을 보여줍니다. 좌측 상단(저위험 고수익)에 위치할수록 효율적인 투자처입니다."
                        />
                    </div>
                    <span className="text-xs text-slate-500">X: Max Drawdown (Risk), Y: CAGR (Return)</span>
                </div>

                <div className="flex gap-2 text-xs text-slate-500">
                    Scroll to Zoom
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 12, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            type="number"
                            dataKey="x"
                            name="Max Drawdown"
                            unit="%"
                            stroke="#94a3b8"
                            label={{ value: 'Risk (MDD)', position: 'insideBottomRight', offset: -5, fill: '#64748b' }}
                            domain={xDomain}
                            allowDataOverflow
                            padding={{ left: 20, right: 20 }}
                        />
                        <YAxis
                            type="number"
                            dataKey="y"
                            name="CAGR"
                            unit="%"
                            stroke="#94a3b8"
                            label={{ value: 'Return (CAGR)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                            domain={yDomain}
                            allowDataOverflow
                            padding={{ top: 20, bottom: 20 }}
                        />
                        <ZAxis type="number" dataKey="z" range={[100, 300]} />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-xs">
                                            <p className="font-bold text-emerald-400 mb-1">{data.ticker}</p>
                                            <p className="text-slate-300">Return: {data.y.toFixed(2)}%</p>
                                            <p className="text-slate-400">Risk (MDD): {data.x.toFixed(2)}%</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Scatter name="Assets" data={data} fill="#8884d8">
                            <LabelList dataKey="ticker" content={<CustomLabel data={data} />} />
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={["#10b981", "#3b82f6", "#f59e0b"][index % 3]} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default RiskRewardScatter;
