import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  Sparkles, 
  Upload, 
  Search, 
  ArrowRight, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  MousePointer2,
  PieChart as PieChartIcon,
  MessageSquare,
  Send,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Cell, Pie
} from 'recharts';

interface KPI {
  label: string;
  value: string | number;
  trend: 'up' | 'down';
  description: string;
}

interface Insight {
  title: string;
  description: string;
  impact: 'high' | 'medium';
}

interface AnalysisResults {
  analysis_id: string;
  domain: string;
  mapping: Record<string, string>;
  executive_summary: string;
  kpis: KPI[];
  insights: Insight[];
  charts: any;
  follow_up_questions: string[];
}

const COLORS = ['#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];

const AnalyzeDataModule: React.FC<{ companyId: string, userId: string }> = ({ companyId, userId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'completed' | 'error'>('idle');
  const [statusPhrase, setStatusPhrase] = useState('Initializing business consultant...');
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const statusPhrases = [
    "Consulting AI business models...",
    "Scanning for revenue leaks...",
    "Correlating data dimensions...",
    "Generating market insights...",
    "Extracting KPI clusters...",
    "Finalizing executive report..."
  ];

  useEffect(() => {
    if (status === 'analyzing') {
      let i = 0;
      const interval = setInterval(() => {
        setStatusPhrase(statusPhrases[i % statusPhrases.length]);
        i++;
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [status]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setStatus('uploading');
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('user_id', userId);
    formData.append('company_id', companyId);

    try {
      setStatus('analyzing');
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Analysis failed with status ${response.status}`);
      }
      
      const data = await response.json();
      // The backend places analysis_id inside results now
      setResults(data.results);
      setStatus('completed');
    } catch (err: any) {
      console.error('[Analyzer] File analysis error:', err);
      setStatus('error');
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !results?.analysis_id) return;
    
    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_id: results.analysis_id,
          message: userMsg,
          // Pass context directly to avoid an extra DB round-trip
          context: {
            domain: results.domain,
            executive_summary: results.executive_summary,
            mapping: results.mapping,
            kpis: results.kpis,
          }
        })
      });
      
      if (!response.ok) throw new Error('Chat request failed');
      const data = await response.json();
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err: any) {
      console.error('[Analyzer] Chat error:', err);
      setChatHistory(prev => [...prev, { role: 'assistant', content: '⚠️ Sorry, I could not process that. Please try again.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const SkeletonCard = () => (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 h-32 animate-pulse overflow-hidden">
      <div className="h-4 w-24 bg-white/10 rounded mb-4" />
      <div className="h-8 w-32 bg-white/20 rounded" />
    </div>
  );

  return (
    <div className="p-8 min-h-screen bg-[#020617] text-white">
      {/* Header */}
      <div className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
            <Sparkles className="w-10 h-10 text-cyan-400" />
            Analyze Your Own Data
          </h1>
          <p className="text-slate-400 mt-2 text-lg">AI-Powered Business Intelligence at your fingertips.</p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={() => { setStatus('idle'); setResults(null); }}
            className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 transition-all"
          >
            New Analysis
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto"
          >
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-cyan-500/30 rounded-[40px] bg-slate-900/40 hover:bg-slate-900/60 hover:border-cyan-500/60 transition-all cursor-pointer overflow-hidden backdrop-blur-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-24 h-24 bg-cyan-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Upload className="w-12 h-12 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Drop your CSV or Excel file here</h2>
              <p className="text-slate-400">Secure analysis on your server. Fast & Deep Insights.</p>
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                title="Upload data file"
                aria-label="Upload data file"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              {[
                { icon: BarChart3, title: "Instant Magic KPIs", desc: "We automatically detect revenues, growth, and performance metrics." },
                { icon: Search, title: "Hidden Correlations", desc: "Our AI finds links between variables that humans often miss." },
                { icon: MessageSquare, title: "Interactive Chat", desc: "Ask specific questions about your data in natural language." }
              ].map((feature, i) => (
                <div key={i} className="p-6 rounded-2xl bg-slate-900/30 border border-white/5">
                  <feature.icon className="w-8 h-8 text-cyan-400 mb-4" />
                  <h3 className="font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400">{feature.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {status === 'analyzing' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto flex flex-col items-center justify-center py-20"
          >
            <div className="relative w-40 h-40 mb-10">
              <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" />
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-4 border-t-cyan-500 rounded-full" 
              />
              <div className="absolute inset-4 bg-slate-900 rounded-full flex items-center justify-center">
                <Sparkles className="w-16 h-16 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-white mb-4 animate-pulse uppercase tracking-[0.2em]">
              {statusPhrase}
            </h2>
            <div className="w-full max-w-md h-2 bg-slate-800 rounded-full overflow-hidden mt-6">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 15, ease: "easeInOut" }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6 ring-1 ring-red-500/30">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Analysis Failed</h2>
            <p className="text-slate-400 mb-2 max-w-md">
              Something went wrong. This could be a file format issue or the AI service is unavailable.
            </p>
            <p className="text-slate-500 text-sm mb-8">
              Make sure <code className="text-cyan-400 bg-white/5 px-1 rounded">GEMINI_API_KEY</code> is set in <code className="text-cyan-400 bg-white/5 px-1 rounded">server_py/.env</code>
            </p>
            <button
              onClick={() => { setStatus('idle'); setFile(null); setResults(null); }}
              className="px-8 py-3 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-colors"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {status === 'completed' && results && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-12 gap-8"
          >
            {/* KPI Section */}
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-5 gap-4">
              {results.kpis.map((kpi, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/30 transition-all"
                >
                  <div className={`absolute top-0 right-0 w-16 h-16 opacity-10 blur-xl ${kpi.trend === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <p className="text-slate-400 text-sm font-medium">{kpi.label}</p>
                  <div className="flex items-end gap-2 mt-2">
                    <span className="text-3xl font-black">{kpi.value}</span>
                    <span className={`text-xs mb-1 font-bold ${kpi.trend === 'up' ? 'text-green-400' : 'text-red-400'} flex items-center`}>
                      {kpi.trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : '▼'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-1 group-hover:line-clamp-none group-hover:absolute group-hover:bg-slate-900 group-hover:p-1 group-hover:z-10">{kpi.description}</p>
                </motion.div>
              ))}
            </div>

            {/* Main Content Area */}
            <div className="col-span-12 lg:col-span-8 space-y-8">
              {/* Executive Summary */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-8 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/10 blur-[80px]" />
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  Executive Consultant Summary
                </h3>
                <p className="text-slate-300 leading-relaxed text-lg italic">
                   "{results.executive_summary}"
                </p>
              </motion.div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                  <h4 className="font-bold mb-6 flex items-center justify-between">
                    Performance Trend
                    <MousePointer2 className="w-4 h-4 text-slate-500" />
                  </h4>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={results.charts.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                          itemStyle={{ color: '#06b6d4' }}
                        />
                        <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={3} dot={{ fill: '#06b6d4' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                  <h4 className="font-bold mb-6">Distribution Analysis</h4>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={results.charts.distribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {results.charts.distribution.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Insights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {results.insights.map((insight, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${insight.impact === 'high' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                    <h5 className="font-bold text-sm mb-2 uppercase tracking-wide opacity-80">{insight.title}</h5>
                    <p className="text-sm text-slate-400">{insight.description}</p>
                    <div className="mt-4 flex items-center text-[10px] uppercase font-bold text-slate-500">
                      Impact: <span className={`ml-1 ${insight.impact === 'high' ? 'text-orange-400' : 'text-blue-400'}`}>{insight.impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar / Chat Section */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
               <div className="bg-slate-900/80 backdrop-blur-xl border border-white/5 rounded-[32px] flex flex-col h-[600px] shadow-xl overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                      </div>
                      <h4 className="font-bold">Ask your Data</h4>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {chatHistory.length === 0 && (
                      <div className="text-center py-10">
                        <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 text-sm">Ask anything about the analyzed data. <br/>"What's causing the trend dip?"</p>
                        
                        <div className="mt-6 flex flex-wrap gap-2 justify-center">
                           {results.follow_up_questions.slice(0, 2).map((q, i) => (
                             <button 
                                key={i}
                                onClick={() => setChatMessage(q)}
                                className="text-[11px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-left max-w-xs"
                              >
                                {q}
                             </button>
                           ))}
                        </div>
                      </div>
                    )}
                    {chatHistory.map((chat, i) => (
                      <div key={i} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                          chat.role === 'user' ? 'bg-cyan-600' : 'bg-slate-800'
                        }`}>
                          {chat.content}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-800 p-4 rounded-2xl flex gap-2">
                           <Loader2 className="w-4 h-4 animate-spin" />
                           <span className="text-xs opacity-50">Thinking...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-6 border-t border-white/5">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type your question..."
                        aria-label="Chat with your data"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pr-14 focus:outline-none focus:border-cyan-500/50 transition-colors text-sm"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={!chatMessage.trim() || isChatLoading}
                        title="Send message"
                        className="absolute right-2 top-2 bottom-2 w-10 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnalyzeDataModule;
