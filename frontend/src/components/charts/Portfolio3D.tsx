"use client";
import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// Props
interface Portfolio3DProps {
    frontier: any[];
}

const PointCloud = ({ data }: { data: any[] }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const [hovered, setHover] = useState<number | null>(null);

    // Parse data for positions and colors
    const { positions, colors } = useMemo(() => {
        const count = data.length;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        // Normalize logic roughly
        // Typically Risk ~ 0.1 to 0.3, Return ~ 0.05 to 0.2
        // We scale them up to fit in a box of 5x5 roughly
        const scale = 20;

        data.forEach((pt, i) => {
            // x: Risk (Volatility)
            // y: Return
            // z: Sharpe (for height) or just 0

            const x = pt.risk * scale - 2; // Centering
            const y = pt.return * scale - 1;
            const z = pt.sharpe * 2 - 1;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Color by Sharpe Ratio (Blue -> Red)
            const color = new THREE.Color();
            // Simple gradient: low sharpe (0) -> high sharpe (1+)
            const t = Math.min(Math.max((pt.sharpe - 0.2) / 0.8, 0), 1);
            color.setHSL(0.6 - t * 0.6, 1, 0.5); // Blue (0.6) to Red (0.0)

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        });

        return { positions, colors };
    }, [data]);

    const tempObject = new THREE.Object3D();

    // Update instance matrices
    React.useLayoutEffect(() => {
        if (!meshRef.current) return;
        for (let i = 0; i < data.length; i++) {
            tempObject.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            tempObject.scale.setScalar(1);
            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObject.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) {
            for (let i = 0; i < data.length; i++) {
                meshRef.current.setColorAt(i, new THREE.Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]));
            }
            meshRef.current.instanceColor.needsUpdate = true;
        }
    }, [data, positions, colors]);

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, data.length]}
            onClick={(e) => {
                e.stopPropagation();
                setHover(e.instanceId ?? null);
                console.log("Clicked instance", e.instanceId, data[e.instanceId ?? 0]);
            }}
        >
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial vertexColors />

            {hovered !== null && (
                <Html position={[positions[hovered * 3], positions[hovered * 3 + 1], positions[hovered * 3 + 2]]}>
                    <div className="pointer-events-none bg-black/80 text-white text-[10px] p-2 rounded whitespace-nowrap z-50">
                        <div className="font-bold mb-1">Portfolio {hovered}</div>
                        <div>Return: {(data[hovered].return * 100).toFixed(2)}%</div>
                        <div>Risk: {(data[hovered].risk * 100).toFixed(2)}%</div>
                        <div>Sharpe: {data[hovered].sharpe}</div>
                        <div className="mt-1 opacity-75">
                            {Object.entries(data[hovered].weights).map(([k, v]) => (
                                <div key={k}>{k}: {Math.round((v as number) * 100)}%</div>
                            ))}
                        </div>
                    </div>
                </Html>
            )}
        </instancedMesh>
    );
}

const Portfolio3D: React.FC<Portfolio3DProps> = ({ frontier }) => {
    if (!frontier || frontier.length === 0) return (
        <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Add 2+ tickers to see Monte Carlo Simulation (Efficient Frontier)
        </div>
    );

    return (
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden h-full relative group">
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <h3 className="text-lg font-bold text-white drop-shadow-md">Efficient Frontier (3D)</h3>
                <p className="text-xs text-slate-300 drop-shadow-md">10,000 Scenarios • Color = Sharpe Ratio</p>
            </div>
            <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <PointCloud data={frontier} />
                <OrbitControls autoRotate autoRotateSpeed={0.5} />
                <gridHelper args={[20, 20, 0x334155, 0x1e293b]} />
                <axesHelper args={[2]} />
            </Canvas>
        </div>
    );
};

export default Portfolio3D;
