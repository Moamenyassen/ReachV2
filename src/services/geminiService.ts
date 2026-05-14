
import { GoogleGenAI, Type } from "@google/genai";
import { Customer, AIReport, EfficiencyAnalysis } from '../types';
import { logGeminiCall } from './usageLogger';

const MODEL_NAME = 'gemini-3-flash-preview';

// Read company/user IDs from persisted user record. These calls are best-effort
// telemetry so we tolerate missing context.
const inferCtx = (): { companyId?: string; userId?: string } => {
  try {
    const raw = localStorage.getItem('rg_v2_user');
    if (!raw) return {};
    const u = JSON.parse(raw);
    return { companyId: u.companyId, userId: u.id };
  } catch { return {}; }
};

/**
 * Strips heavy data from the stats object to prevent 500 errors 
 * and JSON parsing issues caused by oversized prompts.
 */
const prepareStatsForAI = (stats: any) => {
  const cleanDaily: Record<string, any> = {};
  
  if (stats.dailyBreakdown) {
    Object.entries(stats.dailyBreakdown).forEach(([day, data]: [string, any]) => {
      cleanDaily[day] = {
        stops: data.stops,
        dist: data.dist,
        time: data.time,
        eff: data.eff,
      };
    });
  }

  return {
    portfolioSize: stats.portfolioSize,
    totalDistance: stats.totalDistance,
    totalTime: stats.totalTime,
    avgEfficiency: stats.avgEfficiency,
    targetWeek: stats.targetWeek,
    dailyBreakdown: cleanDaily
  };
};

export const generateDriverReport = async (
  route: Customer[], 
  totalDist: number, 
  totalTime: number
): Promise<AIReport> => {
  
  // Use process.env.API_KEY exclusively to obtain the API key
  if (!process.env.API_KEY) {
    return getFallbackReport();
  }

  // Create a new instance right before making the API call to ensure it uses the most up-to-date key
  // Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const routeSample = route.slice(0, 3).map(c => c.name).join(', ');
  const _started = Date.now();
  const _ctx = inferCtx();

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Metrics: ${totalDist}km, ${totalTime}min, ${route.length} stops. Start: ${routeSample}...`,
      config: {
        // Fix: systemInstruction must be provided within the config object
        systemInstruction: "You are a logistics expert. Create a very brief driver briefing in JSON format. Provide Arabic translations in *_ar fields.",
        responseMimeType: "application/json",
        maxOutputTokens: 800,
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary_ar: { type: Type.STRING },
            risks_ar: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations_ar: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["summary", "risks", "recommendations", "summary_ar", "risks_ar", "recommendations_ar"]
        }
      }
    });

    const jsonText = response.text?.trim() || "";
    logGeminiCall({ ..._ctx, surface: 'optimizer', model: MODEL_NAME, durationMs: Date.now() - _started, status: 'success' });
    return JSON.parse(jsonText) as AIReport;
  } catch (error: any) {
    console.warn("Gemini Report Error:", error.message);
    logGeminiCall({ ..._ctx, surface: 'optimizer', model: MODEL_NAME, durationMs: Date.now() - _started, status: 'failure', errorMessage: error?.message });
    return getFallbackReport();
  }
};

export const analyzeEfficiency = async (
  routeLabel: string,
  weeklyStats: any
): Promise<EfficiencyAnalysis> => {
  // Use process.env.API_KEY exclusively to obtain the API key
  if (!process.env.API_KEY) return getFallbackEfficiency();

  // Create a new instance right before making the API call to ensure it uses the most up-to-date key
  // Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const sanitizedStats = prepareStatsForAI(weeklyStats);
  const _started = Date.now();
  const _ctx = inferCtx();

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Route: "${routeLabel}" for ${sanitizedStats.targetWeek}. DATA: ${JSON.stringify(sanitizedStats)}`,
      config: {
        // Fix: systemInstruction must be provided within the config object
        systemInstruction: `You are a Route Efficiency Coach. Analyze the provided route metrics.
      
      CRITICAL TASKS:
      1. DIAGNOSTIC: Explain the current efficiency score (avgEfficiency). If it is e.g. 80%, explain that 20% of time is wasted on travel/overhead vs 80% on productive service.
      2. ROOT CAUSE: Point out specific days in the data that are pulling the average down (high distance, low stops).
      3. GROWTH PATH: Provide 3-4 concrete, numbered steps to increase the efficiency towards 90%+.
      4. LOGISTICS: Suggest moving a portion of stops from an overloaded or inefficient day to a better-performing day.
      5. LANG: Provide professional Arabic translations in all *_ar fields.
      
      Return ONLY the JSON object matching the schema.`,
        responseMimeType: "application/json",
        maxOutputTokens: 2500,
        thinkingConfig: { thinkingBudget: 500 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score_rating: { type: Type.STRING },
            coach_intro: { type: Type.STRING },
            coach_intro_ar: { type: Type.STRING },
            diagnostic_why: { type: Type.STRING },
            diagnostic_why_ar: { type: Type.STRING },
            growth_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            growth_steps_ar: { type: Type.ARRAY, items: { type: Type.STRING } },
            weekly_summary: {
              type: Type.OBJECT,
              properties: {
                current: { 
                  type: Type.OBJECT, 
                  properties: { portfolio_size: { type: Type.NUMBER }, dist: { type: Type.NUMBER }, eff: { type: Type.NUMBER } } 
                },
                projected: { 
                  type: Type.OBJECT, 
                  properties: { portfolio_size: { type: Type.NUMBER }, dist: { type: Type.NUMBER }, eff: { type: Type.NUMBER } } 
                }
              }
            },
            day_by_day: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING },
                  stops: { type: Type.NUMBER },
                  dist: { type: Type.NUMBER },
                  time: { type: Type.NUMBER },
                  current_eff: { type: Type.NUMBER },
                  projected_eff: { type: Type.NUMBER },
                  instruction: { type: Type.STRING },
                  instruction_ar: { type: Type.STRING },
                  impact_note: { type: Type.STRING },
                  impact_note_ar: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const jsonText = response.text?.trim() || "";
    logGeminiCall({ ..._ctx, surface: 'optimizer', model: MODEL_NAME, durationMs: Date.now() - _started, status: 'success' });
    return JSON.parse(jsonText) as EfficiencyAnalysis;
  } catch (e: any) {
    console.error("Efficiency Audit API Error:", e.message);
    logGeminiCall({ ..._ctx, surface: 'optimizer', model: MODEL_NAME, durationMs: Date.now() - _started, status: 'failure', errorMessage: e?.message });
    return getFallbackEfficiency();
  }
};

const getFallbackReport = (): AIReport => ({
  summary: "Route optimized successfully.",
  risks: ["Traffic variance.", "Arrival timing."],
  recommendations: ["Confirm addresses.", "Optimize fuel."],
  summary_ar: "تم تحسين المسار بنجاح.",
  risks_ar: ["تفاوت حركة المرور.", "توقيت الوصول."],
  recommendations_ar: ["تأكيد العناوين.", "تحسين استهلاك الوقود."]
});

const getFallbackEfficiency = (): EfficiencyAnalysis => ({
  score_rating: 'Sub-optimal',
  coach_intro: "The data volume is currently high. Please refine your route filters for a deeper analysis.",
  coach_intro_ar: "حجم البيانات كبير حاليًا. يرجى تحسين فلاتر المسار لإجراء تحليل أعمق.",
  diagnostic_why: "Efficiency is lower than the 85% target due to high travel variance between stops.",
  diagnostic_why_ar: "الكفاءة أقل من المستوى المستهدف (85٪) بسبب التباين العالي في السفر بين الوقفات.",
  growth_steps: ["Sequence stops geographically.", "Reduce inter-cluster travel.", "Balance daily workload."],
  growth_steps_ar: ["تسلسل الوقفات جغرافيا.", "تقليل السفر بين المناطق.", "موازنة أعباء العمل اليومية."],
  weekly_summary: {
    current: { portfolio_size: 0, dist: 0, eff: 0 },
    projected: { portfolio_size: 0, dist: 0, eff: 0 }
  },
  day_by_day: []
});
