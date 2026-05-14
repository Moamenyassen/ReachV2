import React, { useState, useEffect } from 'react';
import { Save, Settings, ShieldCheck, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DemoConfig {
    maxUsers: number;
    maxRoutesPerDay: number;
    maxCustomers: number;
    durationDays: number;
    allowedFeatures: string[];
}

interface SubscriptionConfigProps {
    onSave: (config: DemoConfig) => Promise<void>;
    initialConfig?: DemoConfig;
}

const SubscriptionConfig: React.FC<SubscriptionConfigProps> = ({ onSave, initialConfig }) => {
    const [config, setConfig] = useState<DemoConfig>({
        maxUsers: 5,
        maxRoutesPerDay: 10,
        maxCustomers: 1000,
        durationDays: 3,
        allowedFeatures: ['optimization', 'analytics']
    });

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (initialConfig) setConfig(initialConfig);
    }, [initialConfig]);

    const AVAILABLE_FEATURES = [
        { id: 'optimization', label: 'Route Optimization' },
        { id: 'analytics', label: 'Advanced Analytics' },
        { id: 'live_tracking', label: 'Live Tracking' },
        { id: 'territory_planning', label: 'Territory Planning' },
        { id: 'driver_app', label: 'Driver App Access' },
        { id: 'api_access', label: 'API Access' }
    ];

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(config);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-8 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                    <Zap className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Demo & Trial Configuration</h2>
                    <p className="text-sm text-slate-500">Define default limits for auto-provisioned free trial accounts.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* limits */}
                <div className="space-y-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Usage Limits
                    </h3>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Max Users</label>
                            <input
                                type="number"
                                value={config.maxUsers}
                                onChange={(e) => setConfig({ ...config, maxUsers: parseInt(e.target.value) || 0 })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-orange-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Max Routes / Day</label>
                            <input
                                type="number"
                                value={config.maxRoutesPerDay}
                                onChange={(e) => setConfig({ ...config, maxRoutesPerDay: parseInt(e.target.value) || 0 })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-orange-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Max Customers</label>
                            <input
                                type="number"
                                value={config.maxCustomers}
                                onChange={(e) => setConfig({ ...config, maxCustomers: parseInt(e.target.value) || 0 })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-orange-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Trial Duration (Days)</label>
                            <input
                                type="number"
                                value={config.durationDays}
                                onChange={(e) => setConfig({ ...config, durationDays: parseInt(e.target.value) || 0 })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-orange-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Features */}
                <div className="space-y-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Allowed Features
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        {AVAILABLE_FEATURES.map(feat => (
                            <label key={feat.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 cursor-pointer transition-colors group">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${config.allowedFeatures.includes(feat.id) ? 'bg-orange-500 border-orange-500' : 'border-slate-600 group-hover:border-slate-500'}`}>
                                    {config.allowedFeatures.includes(feat.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={config.allowedFeatures.includes(feat.id)}
                                    onChange={(e) => {
                                        if (e.target.checked) setConfig({ ...config, allowedFeatures: [...config.allowedFeatures, feat.id] });
                                        else setConfig({ ...config, allowedFeatures: config.allowedFeatures.filter(f => f !== feat.id) });
                                    }}
                                />
                                <span className={`text-sm font-medium ${config.allowedFeatures.includes(feat.id) ? 'text-white' : 'text-slate-400'}`}>{feat.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-yellow-500/80 text-xs bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Changes will apply to all <strong>future</strong> auto-provisioned trials.</span>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-white text-black hover:bg-slate-200 font-bold rounded-xl flex items-center gap-2 transition-transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                >
                    {saving ? <Settings className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Configuration
                </button>
            </div>
        </div>
    );
};

export default SubscriptionConfig;
