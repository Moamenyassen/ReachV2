import React from 'react';

interface BrandLogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showText?: boolean;
    animated?: boolean;
    className?: string;
    variant?: 'reach' | 'algorax';
    isDarkMode?: boolean;
}

const BrandLogo: React.FC<BrandLogoProps> = ({
    size = 'md',
    showText = true,
    animated = false,
    className = '',
    variant = 'reach',
    isDarkMode = true // Default to dark mode for backwards compatibility
}) => {
    // Size mappings
    const dimensions = {
        sm: { w: 32, h: 32, text: 'text-xl' },
        md: { w: 48, h: 48, text: 'text-2xl' },
        lg: { w: 64, h: 64, text: 'text-4xl' },
        xl: { w: 120, h: 120, text: 'text-6xl' },
    };

    const { w, h, text } = dimensions[size];

    // Text color classes based on mode
    const mainTextClass = isDarkMode
        ? 'text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-indigo-200'
        : 'text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-slate-700 to-indigo-800';

    const subTextClass = isDarkMode
        ? 'text-cyan-500/80'
        : 'text-cyan-600';

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* Logo Icon */}
            <div className={`relative flex items-center justify-center ${animated ? 'animate-[float_6s_ease-in-out_infinite]' : ''}`}>
                <svg
                    width={w}
                    height={h}
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                >
                    <defs>
                        <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#22d3ee" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                    </defs>

                    {variant === 'algorax' ? (
                        <>
                            <path
                                d="M50 20 L20 80 H35 L42.5 65 H57.5 L65 80 H80 L50 20 Z"
                                stroke="url(#brandGradient)"
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={animated ? "animate-[draw_3s_ease-out_forwards]" : ""}
                                fill="none"
                            />
                            <path
                                d="M30 80 L50 20 L70 80"
                                stroke="url(#brandGradient)"
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                            <path
                                d="M15 80 L85 20"
                                stroke="url(#brandGradient)"
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                                className="opacity-70"
                            />
                            <path
                                d="M40 55 H60"
                                stroke="url(#brandGradient)"
                                strokeWidth="6"
                                strokeLinecap="round"
                            />
                        </>
                    ) : (
                        <>
                            <circle cx="50" cy="50" r="12" stroke="url(#brandGradient)" strokeWidth="6" fill="none" />
                            <circle cx="20" cy="80" r="8" stroke="url(#brandGradient)" strokeWidth="4" fill="none" className={animated ? "animate-pulse" : ""} />
                            <circle cx="80" cy="80" r="8" stroke="url(#brandGradient)" strokeWidth="4" fill="none" className={animated ? "animate-pulse delay-75" : ""} />
                            <circle cx="50" cy="20" r="8" stroke="url(#brandGradient)" strokeWidth="4" fill="none" className={animated ? "animate-pulse delay-150" : ""} />
                            <path d="M50 38 V 28" stroke="url(#brandGradient)" strokeWidth="4" strokeLinecap="round" />
                            <path d="M41 59 L 26 74" stroke="url(#brandGradient)" strokeWidth="4" strokeLinecap="round" />
                            <path d="M59 59 L 74 74" stroke="url(#brandGradient)" strokeWidth="4" strokeLinecap="round" />
                            <path
                                d="M 15 50 A 35 35 0 0 1 85 50"
                                stroke="url(#brandGradient)"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray="4 6"
                                className="opacity-50"
                            />
                        </>
                    )}
                </svg>

                {/* Glow Effect */}
                <div className={`absolute inset-0 bg-blue-500/20 blur-xl rounded-full ${animated ? 'animate-pulse' : ''}`} />
            </div>

            {/* Text Mark */}
            {showText && (
                <div className="flex flex-col justify-center">
                    {variant === 'algorax' ? (
                        <>
                            <h1 className={`font-black tracking-tighter ${mainTextClass} ${text} ${animated ? 'animate-in fade-in slide-in-from-left-4 duration-1000' : ''}`}>
                                Algora<span className="text-cyan-400">X</span>
                            </h1>
                            <span className={`text-[10px] md:text-xs font-bold tracking-[0.4em] ${subTextClass} uppercase ml-0.5 leading-none`}>
                                REACH
                            </span>
                        </>
                    ) : (
                        <>
                            <h1 className={`font-black tracking-tighter ${mainTextClass} ${text} ${animated ? 'animate-in fade-in slide-in-from-left-4 duration-1000' : ''}`}>
                                Reach
                            </h1>
                            <span className={`text-[10px] md:text-xs font-bold tracking-[0.4em] ${subTextClass} uppercase ml-0.5 leading-none`}>
                                AlgoraX
                            </span>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default BrandLogo;

