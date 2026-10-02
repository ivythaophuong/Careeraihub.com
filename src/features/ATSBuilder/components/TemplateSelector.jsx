import React, { useState } from 'react';
import { LayoutGrid, Layers, ChevronLeft, ChevronRight, CheckCircle2, X } from 'lucide-react';
import { C } from '../../../styles/theme';
import { Card, Btn } from '../../../components/CommonUI';

const TEMPLATE_LIST = [
  { id: 'standard', name: 'The Standard', desc: 'Overleaf #1 most popular ATS layout.' },
  { id: 'harshibar', name: 'The Harshibar', desc: 'Premium TeX design with thick dividers.' },
  { id: 'minimalist', name: 'The Minimalist', desc: 'High-density layout for long histories.' },
  { id: 'modern', name: 'Modern Pro', desc: 'Sleek professional look with blue accents.' }
];

const ThumbnailPreview = ({ id }) => {
  const line = (w, h = 2, m = 4) => <div style={{ width: w, height: h, background: "#eee", marginBottom: m }} />;
  
  return (
    <div style={{ width: "100%", height: "100%", padding: 12, display: "flex", flexDirection: "column", alignItems: id === 'standard' ? "center" : "flex-start" }}>
      {/* Header mock */}
      <div style={{ width: "40%", height: 6, background: id === 'modern' ? "#0984e3" : "#ddd", marginBottom: 4 }} />
      <div style={{ width: "60%", height: 3, background: "#eee", marginBottom: 15 }} />
      
      {/* Content mocks */}
      {[1, 2, 3].map(i => (
        <div key={i} style={{ width: "100%", marginBottom: 10 }}>
          <div style={{ width: "100%", height: 3, background: "#f0f0f0", marginBottom: 4 }} />
          {line("90%", 2, 2)}
          {line("85%", 2, 2)}
          {line("70%", 2, 2)}
        </div>
      ))}
    </div>
  );
};

const TemplateSelector = ({ activeId, onSelect, onClose, data }) => {
  const [mode, setMode] = useState('grid'); // 'grid' or 'carousel'
  const [carouselIdx, setCarouselIdx] = useState(TEMPLATE_LIST.findIndex(t => t.id === activeId) || 0);

  const nextThumbnail = () => setCarouselIdx((prev) => (prev + 1) % TEMPLATE_LIST.length);
  const prevThumbnail = () => setCarouselIdx((prev) => (prev - 1 + TEMPLATE_LIST.length) % TEMPLATE_LIST.length);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.3s ease" }}>
      <div style={{ background: C.surface, width: "95vw", maxWidth: 1000, height: "85vh", borderRadius: 24, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
        
        {/* Header */}
        <div style={{ padding: "24px 32px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 className="t-h2" style={{ color: C.text, marginBottom: 4 }}>Select Your Theme</h2>
            <p style={{ color: C.muted, fontSize: 13 }}>Choose a recruiter-approved ATS layout</p>
          </div>
          
          <div style={{ display: "flex", background: C.bg, padding: 4, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <button 
              onClick={() => setMode('grid')}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: mode === 'grid' ? C.accent : "transparent", color: mode === 'grid' ? "#000" : C.muted, transition: "all 0.2s" }}
            >
              <LayoutGrid size={16} /> Grid
            </button>
            <button 
              onClick={() => setMode('carousel')}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: mode === 'carousel' ? C.accent : "transparent", color: mode === 'carousel' ? "#000" : C.muted, transition: "all 0.2s" }}
            >
              <Layers size={16} /> Page View
            </button>
          </div>

          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}><X size={24} /></button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: 32, background: C.bg + "88" }}>
          
          {mode === 'grid' ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
              {TEMPLATE_LIST.map((t) => (
                <div 
                  key={t.id} 
                  onClick={() => onSelect(t.id)}
                  style={{ cursor: "pointer", position: "relative", transition: "transform 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-4px)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <Card style={{ padding: 12, border: activeId === t.id ? `2px solid ${C.accent}` : `1.5px solid ${C.border}`, position: "relative" }} glow={activeId === t.id ? C.accent : null}>
                    <div style={{ aspectRatio: "1/1.4", background: "#fff", borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
                        <ThumbnailPreview id={t.id} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t.desc}</div>
                      </div>
                      {activeId === t.id && <CheckCircle2 color={C.accent} size={20} />}
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", position: "relative", gap: "clamp(8px, 3vw, 40px)" }}>
              <button 
                onClick={prevThumbnail}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "50%", padding: 12, color: C.text, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}
              >
                <ChevronLeft size={24} />
              </button>

              <div style={{ width: "min(450px, 100%)", minWidth: 0, flex: "0 1 450px", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", animation: "fadeIn 0.5s ease" }}>
                <Card style={{ padding: 20, border: activeId === TEMPLATE_LIST[carouselIdx].id ? `2px solid ${C.accent}` : `1px solid ${C.border}` }}>
                  <div style={{ aspectRatio: "1/1.4", background: "#fff", borderRadius: 12, marginBottom: 24, overflow: "hidden" }}>
                     <ThumbnailPreview id={TEMPLATE_LIST[carouselIdx].id} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <h3 className="t-h2" style={{ color: C.text, marginBottom: 8 }}>{TEMPLATE_LIST[carouselIdx].name}</h3>
                    <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>{TEMPLATE_LIST[carouselIdx].desc}</p>
                    <Btn 
                      onClick={() => onSelect(TEMPLATE_LIST[carouselIdx].id)} 
                      color={activeId === TEMPLATE_LIST[carouselIdx].id ? C.green : C.accent} 
                      dark 
                      style={{ width: "100%" }}
                    >
                      {activeId === TEMPLATE_LIST[carouselIdx].id ? "✓ Currently Selected" : "Select This Template"}
                    </Btn>
                  </div>
                </Card>
              </div>

              <button 
                onClick={nextThumbnail}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "50%", padding: 12, color: C.text, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}
              >
                <ChevronRight size={24} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateSelector;
