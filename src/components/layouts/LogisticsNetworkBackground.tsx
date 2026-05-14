import React, { useEffect, useRef } from 'react';

interface Props {
    isDarkMode: boolean;
}

const LogisticsNetworkBackground: React.FC<Props> = ({ isDarkMode }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };
        window.addEventListener('resize', resize);
        resize();

        // Configuration
        const NODE_COUNT = 40;
        const CONNECTION_DISTANCE = 250;
        const TRUCK_SPEED = 0.005; // Progress per frame (0-1 along line)

        // State
        const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
        const trucks: { from: number; to: number; progress: number; color: string }[] = [];

        // Colors
        // Using Google/Reach Brand colors but muted for background
        const colors = [
            'rgba(66, 133, 244, 1)',   // Blue
            'rgba(234, 67, 53, 1)',    // Red
            'rgba(251, 188, 5, 1)',    // Yellow
            'rgba(52, 168, 83, 1)'     // Green
        ];

        // Initialize Nodes
        for (let i = 0; i < NODE_COUNT; i++) {
            nodes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.5, // Slow drift
                vy: (Math.random() - 0.5) * 0.5
            });
        }



        const animate = () => {
            if (!ctx) return;

            // Clear / Fade
            // Dark mode: very dark blue/slate. Light mode: very light gray.
            ctx.fillStyle = isDarkMode ? '#0f172a' : '#f8fafc';
            ctx.fillRect(0, 0, width, height);

            // Update Nodes
            nodes.forEach(node => {
                node.x += node.vx;
                node.y += node.vy;

                // Bounce walls
                if (node.x < 0 || node.x > width) node.vx *= -1;
                if (node.y < 0 || node.y > height) node.vy *= -1;
            });

            // Draw Connections (Routes)
            ctx.lineWidth = 1;
            for (let i = 0; i < NODE_COUNT; i++) {
                for (let j = i + 1; j < NODE_COUNT; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < CONNECTION_DISTANCE) {
                        const alpha = 1 - (dist / CONNECTION_DISTANCE);
                        ctx.strokeStyle = isDarkMode
                            ? `rgba(148, 163, 184, ${alpha * 0.1})` // Subtle
                            : `rgba(100, 116, 139, ${alpha * 0.1})`;
                        ctx.beginPath();
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        ctx.stroke();
                    }
                }
            }

            // Draw Nodes (Hubs)
            nodes.forEach(node => {
                ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
                ctx.beginPath();
                ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
                ctx.fill();
            });

            requestAnimationFrame(animate);
        };

        const animationId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', resize);
        };
    }, [isDarkMode]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 w-full h-full pointer-events-none transition-colors duration-500"
            style={{ zIndex: 0 }}
        />
    );
};

export default LogisticsNetworkBackground;
