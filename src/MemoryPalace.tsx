import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';

function Node({ position, color, label, size = 1 }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[size, 1]} />
        <meshStandardMaterial color={color} wireframe />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[size * 0.9, 1]} />
        <meshStandardMaterial color={color} transparent opacity={0.3} />
      </mesh>
      <Text
        position={[0, size + 0.5, 0]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  );
}

function Connections({ nodes }: { nodes: any[] }) {
  const lineGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        // connect nodes randomly to simulate connections
        if (Math.random() > 0.8) {
          points.push(new THREE.Vector3(...nodes[i].position));
          points.push(new THREE.Vector3(...nodes[j].position));
        }
      }
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [nodes]);

  return (
    <lineSegments geometry={lineGeometry}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.15} />
    </lineSegments>
  );
}

export function MemoryPalace({ episodes, semanticEntries }: { episodes: any[], semanticEntries: any[] }) {
  
  const nodes = useMemo(() => {
    const allNodes: any[] = [];
    
    // Spread semantic entries in a structured inner sphere
    semanticEntries.slice(0, 50).forEach((se, i) => {
      const phi = Math.acos(-1 + (2 * i) / 50);
      const theta = Math.sqrt(50 * Math.PI) * phi;
      const r = 10;
      allNodes.push({
        id: se.id,
        position: [r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi)],
        color: '#3b82f6', // blue
        label: se.tags[0] || 'Fact',
        size: 1.5
      });
    });

    // Spread episodic entries in a chaotic outer cloud
    episodes.slice(0, 100).forEach((ep, i) => {
      const r = 15 + Math.random() * 15;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(Math.random() * 2 - 1);
      allNodes.push({
        id: ep.id,
        position: [r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi)],
        color: ep.type === 'user' ? '#818cf8' : ep.type === 'agent' ? '#34d399' : '#f43f5e',
        label: ep.tags[0] || 'Ep',
        size: 0.8
      });
    });
    
    return allNodes;
  }, [episodes, semanticEntries]);

  return (
    <div className="w-full h-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 relative">
      <div className="absolute top-4 left-4 z-10 bg-slate-900/80 p-4 rounded-xl border border-slate-700/50 backdrop-blur pointer-events-none">
        <h3 className="text-blue-400 font-bold tracking-widest text-xs uppercase mb-2">Memory Palace Navigation</h3>
        <div className="text-slate-400 text-[10px] font-mono space-y-1">
          <p>Drag to rotate. Scroll to zoom.</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div> Semantic Core
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-indigo-400 rounded-full"></div> User Episodes
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div> Agent Episodes
          </div>
        </div>
      </div>
      
      <Canvas camera={{ position: [0, 0, 35], fov: 60 }}>
        <color attach="background" args={['#020617']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#3b82f6" />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <group>
          {nodes.map(node => (
            <Node key={node.id} {...node} />
          ))}
          <Connections nodes={nodes} />
        </group>
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          autoRotate={true}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
