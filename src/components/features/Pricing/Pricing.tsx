
import React from 'react';
import { ViewMode } from '../../../types';
import { Check, X, Zap, Crown, Building2, ArrowLeft } from 'lucide-react';

interface PricingProps {
    onBack: () => void;
    isAiTheme: boolean;
    onSubscribe: (plan: string) => void;
    hideHeader?: boolean;
}

const Pricing: React.FC<PricingProps> = ({ onBack, isAiTheme, onSubscribe, hideHeader = false }) => {
    const plans = [
        {
            name: 'Starter',
            price: '$0',
            period: '/month',
            description: 'Perfect for small teams getting started with route optimization.',
            icon: <Zap className="w-6 h-6" />,
            features: [
                'Up to 50 stops per route',
                'Basic Route Optimization',
                'CSV Upload',
                '1 User Account',
                'Standard Support'
            ],
            notIncluded: [
                'AI Enhancements',
                'Market Scanner',
                'Advanced Analytics',
                'API Access'
            ],
            cta: 'Get Started',
            popular: false,
            id: 'starter'
        },
        {
            name: 'Professional',
            price: '$49',
            period: '/month',
            description: 'Advanced AI features for growing businesses.',
            icon: <Crown className="w-6 h-6" />,
            features: [
                'Up to 500 stops per route',
                'Advanced AI Optimization',
                'Market Scanner Tool',
                'Smart Suggestions',
                '5 User Accounts',
                'Priority Support'
            ],
            notIncluded: [
                'Custom Integration',
                'Dedicated Success Manager'
            ],
            cta: 'Start Pro Trial',
            popular: true,
            id: 'pro'
        },
        {
            name: 'Enterprise',
            price: 'Custom',
            period: '',
            description: 'Full-scale solutions for large organizations.',
            icon: <Building2 className="w-6 h-6" />,
            features: [
                'Unlimited stops',
                'Full AI Suite',
                'Market Scanner + Heatmaps',
                'Unlimited Users',
                'API Access',
                'Custom Integration',
                'Dedicated Success Manager'
            ],
            notIncluded: [],
            cta: 'Contact Sales',
            popular: false,
            id: 'enterprise'
        }
    ];

    return (
        <div className={`min-h-full flex flex-col ${isAiTheme ? '' : 'bg-gray-50 dark:bg-gray-900'} overflow-y-auto custom-scrollbar p-6`}>
            <div className="max-w-7xl mx-auto w-full">
                {!hideHeader && (
                    <button
                        onClick={onBack}
                        className="mb-8 flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-semibold">Back to Dashboard</span>
                    </button>
                )}

                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h1 className="text-4xl md:text-5xl font-black mb-6 text-gray-900 dark:text-white tracking-tight">
                        Choose Your <span className="text-indigo-600 dark:text-indigo-400">Power</span>
                    </h1>
                    <p className="text-xl text-gray-500 dark:text-gray-400">
                        Unlock the full potential of Reach with our AI-powered plans designed to scale with your business.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative rounded-3xl p-8 flex flex-col transition-all duration-300 ${plan.popular
                                ? 'border-2 border-indigo-500 shadow-2xl scale-105 z-10 bg-white dark:bg-gray-800'
                                : 'border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 hover:border-indigo-300 dark:hover:border-indigo-700'
                                } ${isAiTheme ? 'glass-panel' : ''}`}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                                    Most Popular
                                </div>
                            )}

                            <div className="flex items-center gap-4 mb-6">
                                <div className={`p-3 rounded-2xl ${plan.popular ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                    {plan.icon}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Since {plan.name === 'Starter' ? 'Forever' : '2024'}</p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-gray-900 dark:text-white">{plan.price}</span>
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">{plan.period}</span>
                                </div>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{plan.description}</p>
                            </div>

                            <div className="flex-1 space-y-4 mb-8">
                                {plan.features.map((feature) => (
                                    <div key={feature} className="flex items-start gap-3">
                                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{feature}</span>
                                    </div>
                                ))}
                                {plan.notIncluded.map((feature) => (
                                    <div key={feature} className="flex items-start gap-3 opacity-50">
                                        <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm text-gray-500 dark:text-gray-400">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => onSubscribe(plan.id)}
                                className={`w-full py-4 rounded-xl font-bold transition-all duration-300 ${plan.popular
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl hover:shadow-2xl shadow-indigo-500/20'
                                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                                    }`}
                            >
                                {plan.cta}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Pricing;
