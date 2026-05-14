
import L from 'leaflet';

// --- SHARED STYLES ---
const iconShadow = {
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41] as [number, number],
  iconAnchor: [12, 41] as [number, number],
  popupAnchor: [1, -34] as [number, number],
  shadowSize: [41, 41] as [number, number]
};

// --- CORE ICONS ---

export const createUserLocationIcon = () => new L.DivIcon({
  className: 'bg-transparent',
  html: `
    <div class="relative w-4 h-4">
      <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
      <div class="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md"></div>
    </div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// RESTORED BLUE HOUSE ICON (Original Design)
export const createBlueHouseIcon = (count?: number) => new L.DivIcon({
  className: 'bg-transparent',
  html: `
    <div class="relative w-10 h-10 flex items-center justify-center group hover:scale-110 transition-transform duration-500">
       ${count ? `<div class="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-[#020617] shadow-[0_0_10px_rgba(225,29,72,0.6)] z-20 pulse-light">${count > 99 ? '99+' : count}</div>` : ''}
       <div class="absolute inset-0 bg-cyan-500/20 rounded-full blur-md group-hover:bg-cyan-400/30 transition-all duration-500 animate-pulse"></div>
       <div class="relative z-10 w-8 h-8 bg-[#0f172a] rounded-full border-[2px] border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.7)] flex items-center justify-center overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-transparent"></div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-[0_0_3px_#22d3ee]">
             <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
             <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
       </div>
    </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

// CYBERPUNK BRANCH ICON (Glowing House/Base)
export const createBranchIcon = (size: number = 60, label?: string) => new L.DivIcon({
  className: 'bg-transparent',
  html: `
    <div class="relative flex items-center justify-center transition-all duration-500 group" style="width: ${size}px; height: ${size}px;">
       <!-- Exterior Glow Layers -->
       <div class="absolute inset-0 bg-cyan-500 rounded-full animate-ping opacity-10"></div>
       <div class="absolute inset-[-10px] bg-cyan-600/10 rounded-full blur-2xl animate-pulse"></div>
       
       <!-- Magic Portal Ring -->
       <div class="absolute inset-0 border-2 border-dashed border-cyan-400/30 rounded-full animate-[spin_10s_linear_infinite]"></div>
       
       <!-- Main Hexagon/Base Shape -->
       <div class="relative z-10 w-full h-full bg-[#020617] rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.6)] flex items-center justify-center overflow-hidden border border-cyan-500/40 group-hover:border-cyan-400 group-hover:scale-110 transition-all duration-300">
          <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-transparent to-indigo-500/20"></div>
          
          <!-- Scanning Line Animation -->
          <div class="absolute top-0 left-0 w-full h-[2px] bg-cyan-400/50 blur-[1px] animate-[scan_2s_ease-in-out_infinite]"></div>
          
          <!-- House/HQ Icon -->
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]">
             <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
             <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
       </div>

       <!-- Label Badge (Floating Above) -->
       ${label ? `
       <div class="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap z-50">
          <div class="bg-slate-900/90 border border-cyan-500/50 text-cyan-50 px-3 py-1 rounded-full text-[10px] font-black tracking-widest shadow-[0_4px_20px_rgba(0,0,0,0.8)] backdrop-blur-md flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
            ${label.toUpperCase()}
          </div>
          <div class="w-2 h-2 bg-slate-900 border-r border-b border-cyan-500/50 rotate-45 mx-auto -mt-1"></div>
       </div>` : ''}
       
       <style>
         @keyframes scan {
           0%, 100% { top: 0%; opacity: 0; }
           50% { top: 100%; opacity: 1; }
         }
         @keyframes spin_slow {
           from { transform: rotate(0deg); }
           to { transform: rotate(360deg); }
         }
       </style>
    </div>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2]
});

// CYBERPUNK CUSTOMER DOT (Neon Point)
export const createNeonCustomerIcon = () => new L.DivIcon({
  className: 'bg-transparent',
  html: `
      <div class="relative w-4 h-4 group cursor-pointer">
        <div class="absolute inset-[-4px] bg-cyan-400/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div class="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-40"></div>
        <div class="relative w-4 h-4 bg-slate-950 rounded-full border-2 border-cyan-400 shadow-[0_0_12px_#22d3ee] transition-all duration-300 group-hover:scale-125 group-hover:bg-cyan-500 flex items-center justify-center">
          <div class="w-1 h-1 bg-white rounded-full"></div>
        </div>
      </div>
    `,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

export const createTruckIcon = (color: string) => new L.DivIcon({
  className: 'bg-transparent',
  html: `
    <div class="relative w-8 h-8 flex items-center justify-center group hover:scale-125 transition-transform">
      <div class="absolute inset-0 bg-white dark:bg-gray-900 rounded-full border-2 shadow-lg flex items-center justify-center" style="border-color: ${color}">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
         </svg>
      </div>
      <div class="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white" style="background-color: ${color}"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -20]
});

export const createRouteMarker = (color: string, isSelected: boolean = false, hasSuggestion: boolean = false) => {
  const size = isSelected ? 44 : (hasSuggestion ? 38 : 22);
  const anchor = size / 2;
  const popupAnchor = -size;
  const displayColor = hasSuggestion && !isSelected ? '#f59e0b' : color;
  const borderWidth = isSelected ? '3px' : (hasSuggestion ? '2px' : '2px');

  let animationClass = '';
  if (isSelected) animationClass = 'marker-selected-pulse';
  else if (hasSuggestion) animationClass = 'marker-suggestion-glow';

  return new L.DivIcon({
    className: 'bg-transparent group',
    html: `
      <div class="marker-pin-wrapper" style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; position: relative;">
        <div class="${animationClass}" style="
          background-color: ${displayColor};
          width: 100%;
          height: 100%;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: ${borderWidth} solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          z-index: ${hasSuggestion ? 100 : 1};
          display: flex; align-items: center; justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        ">
          <div style="width: 30%; height: 30%; background-color: white; border-radius: 50%; transform: rotate(45deg);"></div>
        </div>
        ${hasSuggestion ? `<div style="position: absolute; top: -8px; right: -8px; background: #ef4444; color: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; z-index: 101; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">!</div>` : ''}
      </div>
      <style>
        .marker-selected-pulse {
          animation: marker-selected-anim 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        .marker-suggestion-glow {
          animation: marker-suggestion-anim 3s infinite ease-in-out;
        }
        @keyframes marker-selected-anim {
          0% { transform: rotate(-45deg) scale(1); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
          50% { transform: rotate(-45deg) scale(1.1); box-shadow: 0 0 0 12px rgba(79, 70, 229, 0); }
          100% { transform: rotate(-45deg) scale(1); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
        }
        @keyframes marker-suggestion-anim {
          0% { filter: brightness(1) drop-shadow(0 0 2px rgba(245, 158, 11, 0.4)); }
          50% { filter: brightness(1.2) drop-shadow(0 0 8px rgba(245, 158, 11, 0.8)); }
          100% { filter: brightness(1) drop-shadow(0 0 2px rgba(245, 158, 11, 0.4)); }
        }
      </style>
    `,
    iconSize: [size, size],
    iconAnchor: [anchor, size],
    popupAnchor: [0, popupAnchor]
  });
};

export const createLeadMarkerIcon = (markerType: 'VET' | 'SHOP' | 'PET_SHOP' | 'UNKNOWN') => {
  let bgColor = 'bg-slate-500';
  let shadowColor = 'rgba(100,116,139,0.6)';
  let iconHtml = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

  if (markerType === 'VET') {
    bgColor = 'bg-red-600';
    shadowColor = 'rgba(220,38,38,0.6)';
    iconHtml = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"></path></svg>';
  } else if (markerType === 'PET_SHOP') {
    bgColor = 'bg-purple-600';
    shadowColor = 'rgba(147,51,234,0.6)';
    iconHtml = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M17.92 14c-.63.28-1.38.14-1.92-.3a2.53 2.53 0 0 1-.57-2.73c.27-.82 1.13-1.25 1.95-1.07a2.53 2.53 0 0 1 1.9 2.1c.14.83-.35 1.63-1.07 1.91.13-.01.27.01.4.09z"></path><path d="M12 14c-2.3 0-4.3 1.5-5 3.5-.2.5.1 1.1.7 1.3.5.2 1.1-.1 1.3-.7.5-1.3 1.8-2.2 3-2.2s2.5.9 3 2.2c.2.6.8.9 1.3.7.6-.2.9-.8.7-1.3-.7-2-2.7-3.5-5-3.5z"></path></svg>';
  } else if (markerType === 'SHOP') {
    bgColor = 'bg-orange-500';
    shadowColor = 'rgba(249,115,22,0.6)';
    iconHtml = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';
  }

  return L.divIcon({
    className: 'bg-transparent',
    html: `
      <div class="relative w-10 h-10 flex items-center justify-center group lead-marker-animate">
        <div class="absolute inset-0 ${bgColor.replace('bg-', 'bg-')}/20 rounded-full animate-ping pointer-events-none"></div>
        <div class="relative z-10 w-8 h-8 ${bgColor} border-2 border-white shadow-[0_0_10px_${shadowColor}] rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-125 group-hover:shadow-[0_0_20px_${shadowColor}]">
           ${iconHtml}
        </div>
      </div>
      <style>
        .lead-marker-animate:hover .relative.z-10 { animation: marker-glow 0.8s ease-in-out infinite alternate; }
        @keyframes marker-glow {
          from { transform: scale(1.15); box-shadow: 0 0 10px rgba(255,255,255,0.4); }
          to { transform: scale(1.3); box-shadow: 0 0 25px rgba(255,255,255,0.8); }
        }
      </style>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

export const createArrowIcon = (bearing: number, color: string) => new L.DivIcon({
  className: 'bg-transparent',
  html: `<div style="transform: rotate(${bearing}deg); color: ${color}; filter: drop-shadow(0 0 2px white);">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display: block;">
       <path d="M12 2L2 22L12 18L22 22L12 2Z" />
    </svg>
  </div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

export const centroidIconCurrent = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div style="background-color: #ef4444; width: 12px; height: 12px; transform: rotate(45deg); border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

export const centroidIconTarget = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div style="background-color: #10b981; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

export const iconNeighbor = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  ...iconShadow
});
