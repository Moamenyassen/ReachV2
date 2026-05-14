import React, { ReactNode } from 'react';

interface MagicLayoutProps {
    children: ReactNode;
    className?: string;
}

const MagicLayout: React.FC<MagicLayoutProps> = ({ children, className = '' }) => {
    return (
        <div className="relative w-full h-full overflow-hidden bg-[#020617] text-slate-200">

            {/* --- PERSISTENT BACKGROUND EFFECTS --- */}

            {/* Base Gradient */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#020617] to-black"></div>

                {/* Animated Neural Grid */}
                <div className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.15) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                        maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
                        transform: 'perspective(1000px) rotateX(10deg) scale(1.1)'
                    }}>
                </div>

                {/* Ambient Glow Orbs */}
                <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-violet-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[100px] mix-blend-screen animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
            </div>

            {/* --- CONTENT CONTAINER --- */}
            <div className={`relative z-10 w-full h-full ${className}`}>
                {children}
            </div>

        </div>
    );
};

export default MagicLayout;
