// Auto-generated demo HTML strings
export const l1HtmlHeight = 640;
export const l1Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CareerAiHub — Layer 01: Resume Creation</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#09090d;--s1:#111218;--s2:#161820;--s3:#1c1f2c;
  --bdr:rgba(255,255,255,0.06);--bdr2:rgba(255,255,255,0.12);
  --text:#e8eaf0;--text2:#8b92a8;--text3:#3d4560;
  --teal:#00d4aa;--tdim:rgba(0,212,170,0.1);--tb:rgba(0,212,170,0.25);
  --cyan:#00c8ff;--cdim:rgba(0,200,255,0.1);--cb:rgba(0,200,255,0.25);
  --green:#00e5a0;--gdim:rgba(0,229,160,0.1);--gb:rgba(0,229,160,0.25);
  --gold:#f5c842;--goldim:rgba(245,200,66,0.1);
  --red:#ff5f6e;--rdim:rgba(255,95,110,0.1);
  --purple:#F59E0B;--pdim:rgba(245,158,11,0.1);--pb:rgba(245,158,11,0.25);
  --mono:'JetBrains Mono',monospace;--disp:'Syne',sans-serif;--body:'DM Sans',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:var(--body);font-size:13px;height:100vh;display:flex;flex-direction:column;overflow:hidden;}

/* TOP */
.topbar{height:46px;background:rgba(9,9,13,0.96);border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;padding:0 18px;flex-shrink:0;backdrop-filter:blur(12px);}
.logo{font-family:var(--disp);font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px;}
.logo-icon{display:none}
.layer-pill{font-size:9px;font-family:var(--mono);padding:3px 10px;border-radius:20px;background:var(--tdim);color:var(--teal);border:1px solid var(--tb);display:flex;align-items:center;gap:5px;}
.ldot{width:5px;height:5px;border-radius:50%;background:var(--teal);box-shadow:0 0 6px var(--teal);animation:p 2s ease-in-out infinite;}
@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
.top-right{display:flex;gap:8px;align-items:center;}
.score-pill{font-size:10px;font-family:var(--mono);padding:4px 12px;border-radius:6px;background:var(--s2);border:1px solid var(--bdr2);color:var(--text2);}
.score-pill span{color:var(--cyan);}
.btn{padding:5px 14px;border-radius:6px;font-size:11px;font-weight:600;border:none;cursor:pointer;font-family:var(--body);}
.btn-teal{background:var(--teal);color:#000;}
.btn-outline{background:transparent;border:1px solid var(--bdr2);color:var(--text2);}

/* 3-COL GRID */
.workspace{display:grid;grid-template-columns:220px 1fr 240px;flex:1;overflow:hidden;}

/* ── LEFT: COVER LETTER ── */
.panel{border-right:1px solid var(--bdr);display:flex;flex-direction:column;overflow:hidden;}
.panel-head{padding:12px 14px;border-bottom:1px solid var(--bdr);flex-shrink:0;}
.phtitle{font-family:var(--disp);font-size:12px;font-weight:700;margin-bottom:1px;}
.phsub{font-size:9px;color:var(--text2);font-family:var(--mono);}
.panel-body{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;}

.tone-row{display:flex;align-items:center;gap:8px;margin-bottom:2px;}
.tone-label{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.08em;}
.tone-track{flex:1;height:4px;background:var(--s3);border-radius:4px;position:relative;cursor:pointer;}
.tone-thumb{position:absolute;top:-5px;width:14px;height:14px;border-radius:50%;background:var(--teal);box-shadow:0 0 8px var(--teal);transition:left .3s;cursor:grab;}
.tone-ends{display:flex;justify-content:space-between;font-size:9px;font-family:var(--mono);color:var(--text3);margin-top:3px;}

.cl-preview{background:var(--s2);border:1px solid var(--bdr);border-radius:8px;padding:12px;font-size:11px;line-height:1.8;color:var(--text2);flex:1;}
.cl-preview p{margin-bottom:8px;}
.cl-cursor{display:inline-block;width:6px;height:12px;background:var(--teal);animation:blink 1s step-end infinite;vertical-align:middle;}
@keyframes blink{50%{opacity:0}}

.mini-label{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;}

/* Templates */
.tpl-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;}
.tpl-card{background:var(--s2);border:1px solid var(--bdr);border-radius:6px;padding:8px 8px;cursor:pointer;transition:all .15s;text-align:center;}
.tpl-card:hover{border-color:var(--tb);}
.tpl-card.active{border-color:var(--teal);background:var(--tdim);}
.tpl-icon{font-size:14px;margin-bottom:3px;}
.tpl-name{font-size:9px;font-family:var(--mono);color:var(--text2);}
.tpl-card.active .tpl-name{color:var(--teal);}

/* Export */
.export-row{display:flex;gap:6px;}
.export-btn{flex:1;padding:7px;border-radius:6px;font-size:10px;font-weight:600;border:none;cursor:pointer;font-family:var(--mono);transition:all .15s;}
.export-pdf{background:var(--rdim);color:var(--red);border:1px solid rgba(255,95,110,0.25);}
.export-pdf:hover{background:var(--red);color:#fff;}
.export-docx{background:var(--cdim);color:var(--cyan);border:1px solid var(--cb);}
.export-docx:hover{background:var(--cyan);color:#000;}

/* Versions */
.ver-list{display:flex;flex-direction:column;gap:4px;}
.ver-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:var(--s2);border:1px solid var(--bdr);cursor:pointer;transition:all .15s;}
.ver-item:hover{border-color:var(--bdr2);}
.ver-item.current{border-color:var(--teal);background:var(--tdim);}
.ver-dot{width:6px;height:6px;border-radius:50%;background:var(--text3);flex-shrink:0;}
.ver-item.current .ver-dot{background:var(--teal);box-shadow:0 0 5px var(--teal);}
.ver-name{font-size:10px;font-family:var(--mono);color:var(--text2);flex:1;}
.ver-item.current .ver-name{color:var(--teal);}
.ver-tag{font-size:8px;font-family:var(--mono);padding:2px 6px;border-radius:3px;background:var(--tdim);color:var(--teal);}

/* ── CENTER: EDITOR ── */
.editor-wrap{display:flex;flex-direction:column;overflow:hidden;}
.editor-toolbar{padding:8px 16px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px;flex-shrink:0;}
.etool{padding:4px 10px;border-radius:5px;font-size:10px;font-family:var(--mono);background:var(--s2);border:1px solid var(--bdr);color:var(--text3);cursor:pointer;transition:all .15s;}
.etool:hover{border-color:var(--bdr2);color:var(--text);}
.etool.active{background:var(--tdim);border-color:var(--tb);color:var(--teal);}
.etool-sep{width:1px;height:16px;background:var(--bdr2);}
.editor-area{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:20px;}

/* Resume sections */
.resume-section{}
.rs-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.rs-title{font-family:var(--disp);font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:.1em;}
.rs-line{flex:1;height:1px;background:var(--tb);}
.rs-name-block{text-align:center;margin-bottom:6px;}
.rs-name{font-family:var(--disp);font-size:20px;font-weight:800;}
.rs-contact{font-size:10px;color:var(--text2);font-family:var(--mono);margin-top:4px;}

.exp-item{margin-bottom:12px;}
.exp-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;}
.exp-role{font-size:12px;font-weight:600;font-family:var(--disp);}
.exp-dates{font-size:10px;color:var(--text2);font-family:var(--mono);}
.exp-company{font-size:11px;color:var(--text2);margin-bottom:6px;}

/* Bullet with XYZ highlight */
.bullet-row{display:flex;gap:8px;align-items:flex-start;padding:4px 8px;border-radius:6px;transition:background .2s;cursor:pointer;position:relative;}
.bullet-row:hover{background:var(--s2);}
.bullet-row.active-xyz{background:var(--tdim);border-left:2px solid var(--teal);}
.bullet-dot{width:4px;height:4px;border-radius:50%;background:var(--text3);flex-shrink:0;margin-top:7px;}
.bullet-row.active-xyz .bullet-dot{background:var(--teal);}
.bullet-text{font-size:12px;line-height:1.7;flex:1;}
.xyz-mark{font-size:9px;font-family:var(--mono);padding:1px 5px;border-radius:3px;vertical-align:middle;margin-left:4px;}
.xyz-x{background:rgba(0,200,255,0.15);color:var(--cyan);}
.xyz-y{background:rgba(0,229,160,0.15);color:var(--green);}
.xyz-z{background:rgba(245,200,66,0.15);color:var(--gold);}
.ai-dot{font-size:11px;cursor:pointer;}

/* XYZ popover */
.xyz-popover{position:absolute;left:100%;top:0;margin-left:8px;width:220px;background:var(--s1);border:1px solid var(--tb);border-radius:10px;padding:12px;z-index:50;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:none;}
.bullet-row.active-xyz .xyz-popover{display:block;}
.pop-title{font-size:9px;font-family:var(--mono);color:var(--teal);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;}
.pop-row{display:flex;gap:8px;margin-bottom:6px;align-items:flex-start;}
.pop-key{font-size:9px;font-family:var(--mono);padding:2px 6px;border-radius:3px;flex-shrink:0;margin-top:1px;}
.pop-desc{font-size:10px;color:var(--text2);line-height:1.5;}
.pop-suggestion{margin-top:8px;padding:8px;background:var(--tdim);border-radius:6px;font-size:10px;color:var(--teal);font-family:var(--mono);line-height:1.6;}

/* skills */
.skills-wrap{display:flex;flex-wrap:wrap;gap:5px;}
.skill-chip{padding:3px 10px;border-radius:20px;font-size:10px;font-family:var(--mono);}
.sc-teal{background:var(--tdim);color:var(--teal);border:1px solid var(--tb);}
.sc-cyan{background:var(--cdim);color:var(--cyan);border:1px solid var(--cb);}
.sc-dim{background:var(--s2);color:var(--text3);border:1px solid var(--bdr);}

/* ── RIGHT: COPILOT ── */
.copilot{display:flex;flex-direction:column;border-left:1px solid var(--bdr);overflow:hidden;}
.cp-body{flex:1;overflow-y:auto;padding:14px 14px;display:flex;flex-direction:column;gap:12px;}

/* ATS gauge */
.ats-gauge-wrap{display:flex;flex-direction:column;align-items:center;background:var(--s2);border:1px solid var(--bdr);border-radius:10px;padding:14px;}
.gauge-label{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;}
.gauge-svg{overflow:visible;}
.gauge-bg{fill:none;stroke:var(--s3);stroke-width:8;stroke-linecap:round;}
.gauge-fill{fill:none;stroke:var(--cyan);stroke-width:8;stroke-linecap:round;transition:stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 0 6px var(--cyan));}
.gauge-num{font-family:var(--disp);font-size:22px;font-weight:800;fill:var(--text);}
.gauge-pct{font-family:var(--mono);font-size:9px;fill:var(--text3);}
.jd-paste{width:100%;padding:6px 10px;border-radius:6px;background:var(--s3);border:1px solid var(--bdr);color:var(--text2);font-size:10px;font-family:var(--mono);resize:none;height:46px;outline:none;margin-top:6px;}
.jd-paste:focus{border-color:var(--cb);}
.jd-btn{width:100%;margin-top:6px;padding:7px;border-radius:6px;background:var(--cdim);color:var(--cyan);border:1px solid var(--cb);font-size:10px;font-weight:700;cursor:pointer;font-family:var(--mono);transition:all .2s;}
.jd-btn:hover{background:var(--cyan);color:#000;}

/* Missing keywords */
.missing-box{background:var(--rdim);border:1px solid rgba(255,95,110,0.2);border-radius:8px;padding:10px 12px;}
.mb-title{font-size:9px;font-family:var(--mono);color:var(--red);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;}
.kw-list{display:flex;flex-wrap:wrap;gap:4px;}
.kw{padding:3px 9px;border-radius:4px;font-size:9px;font-family:var(--mono);background:rgba(255,95,110,0.1);color:var(--red);border:1px solid rgba(255,95,110,0.2);cursor:pointer;transition:all .15s;}
.kw:hover{background:var(--red);color:#fff;}

/* Matched keywords */
.matched-box{background:var(--gdim);border:1px solid var(--gb);border-radius:8px;padding:10px 12px;}
.mb-title-g{font-size:9px;font-family:var(--mono);color:var(--green);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;}
.kw-g{padding:3px 9px;border-radius:4px;font-size:9px;font-family:var(--mono);background:var(--gdim);color:var(--green);border:1px solid var(--gb);}

/* Progress bars */
.prog-item{margin-bottom:6px;}
.prog-label{display:flex;justify-content:space-between;font-size:10px;font-family:var(--mono);color:var(--text2);margin-bottom:3px;}
.prog-val{color:var(--cyan);}
.prog-bar{height:3px;background:var(--s3);border-radius:3px;overflow:hidden;}
.prog-fill{height:100%;border-radius:3px;transition:width 1s ease;}

/* LOG BAR */
.log-bar{height:88px;border-top:1px solid var(--bdr);flex-shrink:0;display:flex;flex-direction:column;}
.log-head{padding:5px 16px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:7px;flex-shrink:0;}
.log-live-dot{width:5px;height:5px;border-radius:50%;background:var(--teal);box-shadow:0 0 5px var(--teal);animation:p 1.5s infinite;}
.log-ht{font-size:9px;font-family:var(--mono);color:var(--text3);}
.log-entries{flex:1;overflow-y:auto;padding:5px 16px;display:flex;flex-direction:column;gap:3px;}
.log-row{display:flex;gap:10px;font-size:10px;font-family:var(--mono);}
.log-ts{color:var(--text3);flex-shrink:0;}
.tc-parse{color:var(--teal);}
.tc-ats{color:var(--cyan);}
.tc-xyz{color:var(--gold);}
.tc-cover{color:var(--purple);}
.tc-skill{color:var(--green);}
.log-msg{color:var(--text2);}
.log-cur{display:inline-block;width:6px;height:10px;background:var(--teal);animation:blink 1s step-end infinite;vertical-align:middle;}

::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:3px;}
</style>
</head>
<body>

<!-- TOPBAR -->
<div class="topbar">
  <div style="display:flex;align-items:center;gap:12px">
    <div class="logo"><svg width="28" height="28" viewBox="0 0 100 100" fill="none" style="flex-shrink:0"><defs><linearGradient id="orb-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#EC4899"/><stop offset="55%" stop-color="#F59E0B"/><stop offset="100%" stop-color="#F59E0B"/></linearGradient></defs><ellipse cx="50" cy="50" rx="42" ry="18" transform="rotate(-28 50 50)" stroke="url(#orb-g)" stroke-width="2" opacity="0.32"/><ellipse cx="50" cy="50" rx="42" ry="18" transform="rotate(28 50 50)" stroke="url(#orb-g)" stroke-width="2" opacity="0.32"/><circle cx="50" cy="50" r="11" fill="url(#orb-g)"/><circle cx="81.94" cy="26.03" r="4.5" fill="url(#orb-g)"/><circle cx="70.42" cy="75.19" r="4" fill="url(#orb-g)"/><circle cx="18.06" cy="73.97" r="3.5" fill="url(#orb-g)"/></svg>career<span style="background:linear-gradient(110deg,#EC4899 0%,#F59E0B 55%,#F59E0B 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent">ai</span>hub</div>
    <div class="layer-pill"><div class="ldot"></div>LAYER 01 — RESUME CREATION</div>
  </div>
  <div class="top-right">
    <div class="score-pill">ATS Score <span id="atsTopNum">78%</span></div>
    <button class="btn btn-outline">Templates</button>
    <button class="btn btn-teal">Export →</button>
  </div>
</div>

<div class="workspace">

<!-- ── LEFT PANEL ── -->
<div class="panel" style="border-right:1px solid var(--bdr);">
  <div class="panel-head">
    <div class="phtitle">Cover Letter</div>
    <div class="phsub">Auto-generated · AI Co-pilot</div>
  </div>
  <div class="panel-body">

    <!-- Tone Control -->
    <div>
      <div class="mini-label">Tone Control</div>
      <div class="tone-row">
        <div class="tone-label" style="font-size:8px">Formal</div>
        <div class="tone-track" id="toneTrack" onclick="moveTone(event)">
          <div class="tone-thumb" id="toneThumb" style="left:35%"></div>
        </div>
        <div class="tone-label" style="font-size:8px">Direct</div>
      </div>
      <div class="tone-ends" style="margin-top:0;justify-content:center;font-size:9px;color:var(--teal)">
        <span id="toneLbl">Professional</span>
      </div>
    </div>

    <!-- Letter preview -->
    <div class="cl-preview">
      <p>Dear Hiring Manager,</p>
      <p>I am writing to express my strong interest in the <strong style="color:var(--teal)">Senior AI Engineer</strong> position at your organisation. With over five years of hands-on experience building and deploying large-scale ML systems, I have consistently delivered production-ready solutions that reduce inference latency by <span style="color:var(--cyan)">40%</span> while maintaining &gt;99.9% uptime.</p>
      <p id="clPara2">My recent work at DataCore involved architecting a RAG-based retrieval pipeline using LangChain and AWS Bedrock, reducing manual review time by 60%.<span class="cl-cursor"></span></p>
    </div>

    <!-- Templates -->
    <div>
      <div class="mini-label">Template</div>
      <div class="tpl-grid">
        <div class="tpl-card active" onclick="setTpl(this)"><div class="tpl-icon">🗂</div><div class="tpl-name">Executive</div></div>
        <div class="tpl-card" onclick="setTpl(this)"><div class="tpl-icon">⚡</div><div class="tpl-name">Modern</div></div>
        <div class="tpl-card" onclick="setTpl(this)"><div class="tpl-icon">🎯</div><div class="tpl-name">Minimal</div></div>
        <div class="tpl-card" onclick="setTpl(this)"><div class="tpl-icon">📐</div><div class="tpl-name">Classic</div></div>
      </div>
    </div>

    <!-- Export -->
    <div>
      <div class="mini-label">Export</div>
      <div class="export-row">
        <button class="export-btn export-pdf">📄 PDF</button>
        <button class="export-btn export-docx">📝 DOCX</button>
      </div>
    </div>

    <!-- Versions -->
    <div>
      <div class="mini-label">Saved Versions</div>
      <div class="ver-list">
        <div class="ver-item current"><div class="ver-dot"></div><div class="ver-name">Draft 5</div><div class="ver-tag">Current</div></div>
        <div class="ver-item"><div class="ver-dot"></div><div class="ver-name">Draft 4 · ATS 74%</div></div>
        <div class="ver-item"><div class="ver-dot"></div><div class="ver-name">Draft 3 · ATS 68%</div></div>
        <div class="ver-item"><div class="ver-dot"></div><div class="ver-name">Draft 1 · Original</div></div>
      </div>
    </div>

  </div>
</div>

<!-- ── CENTER: EDITOR ── -->
<div class="editor-wrap">
  <div class="editor-toolbar">
    <div class="etool active">✦ XYZ Mode</div>
    <div class="etool" onclick="this.classList.toggle('active')">B</div>
    <div class="etool" onclick="this.classList.toggle('active')">I</div>
    <div class="etool-sep"></div>
    <div class="etool" onclick="this.classList.toggle('active')">H1</div>
    <div class="etool" onclick="this.classList.toggle('active')">H2</div>
    <div class="etool-sep"></div>
    <div class="etool" onclick="this.classList.toggle('active')">🔗 Link</div>
    <div style="flex:1"></div>
    <div style="font-size:9px;font-family:var(--mono);color:var(--text3)">AI co-pilot active 🤖</div>
  </div>
  <div class="editor-area">

    <!-- NAME BLOCK -->
    <div class="resume-section">
      <div class="rs-name-block">
        <div class="rs-name">Ivy Nguyen</div>
        <div class="rs-contact">ivy.nguyen@email.com · +65 9123 4567 · Singapore · linkedin.com/in/ivynguyen</div>
      </div>
    </div>

    <!-- EXPERIENCE -->
    <div class="resume-section">
      <div class="rs-head"><div class="rs-title">Experience</div><div class="rs-line"></div></div>
      <div class="exp-item">
        <div class="exp-top">
          <div class="exp-role">Senior ML Engineer</div>
          <div class="exp-dates">Jan 2022 – Present</div>
        </div>
        <div class="exp-company">DataCore Technologies · Singapore</div>

        <!-- Bullet 1 — XYZ active -->
        <div class="bullet-row active-xyz" id="bullet1" onclick="toggleXYZ(this)">
          <div class="bullet-dot"></div>
          <div class="bullet-text">
            Reduced model inference latency by <strong style="color:var(--cyan)">40%</strong>
            <span class="xyz-mark xyz-x">X: Result</span> by re-architecting the serving pipeline using TorchServe
            <span class="xyz-mark xyz-y">Y: Action</span> for a 50M-request/day production system
            <span class="xyz-mark xyz-z">Z: Context</span>
            <span class="ai-dot">🤖</span>
          </div>
          <div class="xyz-popover">
            <div class="pop-title">XYZ Guidance · Achievement</div>
            <div class="pop-row"><div class="pop-key xyz-x">X</div><div class="pop-desc"><strong>Result achieved:</strong> Reduced latency 40% — strong quantified impact ✓</div></div>
            <div class="pop-row"><div class="pop-key xyz-y">Y</div><div class="pop-desc"><strong>Action taken:</strong> Re-architecting pipeline — clear ownership ✓</div></div>
            <div class="pop-row"><div class="pop-key xyz-z">Z</div><div class="pop-desc"><strong>Context/Scale:</strong> 50M req/day — shows scope ✓</div></div>
            <div class="pop-suggestion">💡 Add tool used (TorchServe) to boost keyword density for ATS</div>
          </div>
        </div>

        <!-- Bullet 2 -->
        <div class="bullet-row" onclick="toggleXYZ(this)">
          <div class="bullet-dot"></div>
          <div class="bullet-text">Built end-to-end RAG pipeline integrating LangChain + AWS Bedrock, cutting manual review time by <strong style="color:var(--cyan)">60%</strong> across 3 product lines <span class="ai-dot">🤖</span></div>
        </div>

        <!-- Bullet 3 — needs improvement -->
        <div class="bullet-row" onclick="toggleXYZ(this)">
          <div class="bullet-dot" style="background:var(--gold)"></div>
          <div class="bullet-text" style="color:var(--text2)">Worked on model training and deployment tasks <span style="font-size:9px;font-family:var(--mono);padding:1px 5px;border-radius:3px;background:rgba(245,200,66,0.15);color:var(--gold)">⚠ Needs XYZ</span></div>
        </div>

        <!-- Bullet 4 -->
        <div class="bullet-row" onclick="toggleXYZ(this)">
          <div class="bullet-dot"></div>
          <div class="bullet-text">Led cross-functional team of 6 engineers, delivering ML platform on-time with <strong style="color:var(--cyan)">zero critical incidents</strong> in first 90 days <span class="ai-dot">🤖</span></div>
        </div>
      </div>

      <div class="exp-item">
        <div class="exp-top">
          <div class="exp-role">ML Engineer</div>
          <div class="exp-dates">Mar 2019 – Dec 2021</div>
        </div>
        <div class="exp-company">NovaTech AI · Singapore</div>
        <div class="bullet-row" onclick="toggleXYZ(this)">
          <div class="bullet-dot"></div>
          <div class="bullet-text">Improved NLP model F1-score by <strong style="color:var(--cyan)">12%</strong> through systematic hyperparameter tuning on 2M-sample dataset <span class="ai-dot">🤖</span></div>
        </div>
      </div>
    </div>

    <!-- EDUCATION -->
    <div class="resume-section">
      <div class="rs-head"><div class="rs-title">Education</div><div class="rs-line"></div></div>
      <div class="exp-top">
        <div class="exp-role">MSc Computer Science · AI Specialisation</div>
        <div class="exp-dates">2017 – 2019</div>
      </div>
      <div class="exp-company">National University of Singapore · GPA 4.0/4.0</div>
    </div>

    <!-- SKILLS -->
    <div class="resume-section">
      <div class="rs-head"><div class="rs-title">Skills</div><div class="rs-line"></div></div>
      <div class="skills-wrap">
        <div class="skill-chip sc-teal">Python</div>
        <div class="skill-chip sc-teal">PyTorch</div>
        <div class="skill-chip sc-teal">TensorFlow</div>
        <div class="skill-chip sc-cyan">AWS</div>
        <div class="skill-chip sc-cyan">LangChain</div>
        <div class="skill-chip sc-cyan">Docker</div>
        <div class="skill-chip sc-dim">RAG Frameworks</div>
        <div class="skill-chip sc-dim" style="border-color:rgba(255,95,110,0.3);color:var(--red)">+ Add missing</div>
      </div>
    </div>

  </div>
</div>

<!-- ── RIGHT: CO-PILOT ── -->
<div class="copilot">
  <div class="panel-head">
    <div class="phtitle">Resume Co-pilot</div>
    <div class="phsub">Live ATS · Keyword engine</div>
  </div>
  <div class="cp-body">

    <!-- ATS gauge -->
    <div class="ats-gauge-wrap">
      <div class="gauge-label">Live ATS Score</div>
      <svg class="gauge-svg" width="100" height="60" viewBox="0 0 120 70">
        <path class="gauge-bg" d="M15 65 A55 55 0 0 1 105 65"/>
        <path class="gauge-fill" id="gaugeFill" d="M15 65 A55 55 0 0 1 105 65" stroke-dasharray="173" stroke-dashoffset="38"/>
        <text class="gauge-num" x="60" y="58" text-anchor="middle" id="atsNum">78%</text>
      </svg>
      <div style="display:flex;gap:6px;margin-top:6px;font-size:9px;font-family:var(--mono)">
        <span style="color:var(--text3)">Target:</span>
        <span style="color:var(--green)">85%+</span>
        <span style="color:var(--text3)">· +7% needed</span>
      </div>
      <textarea class="jd-paste" id="jdInput" placeholder="Paste job description to compare…"></textarea>
      <button class="jd-btn" onclick="runATS()">⚡ Analyse JD Match</button>
    </div>

    <!-- Missing keywords -->
    <div class="missing-box">
      <div class="mb-title">Missing Keywords</div>
      <div class="kw-list" id="missingKW">
        <div class="kw" onclick="addKW(this,'RAG Frameworks')">RAG Frameworks</div>
        <div class="kw" onclick="addKW(this,'LangChain')">LangChain</div>
        <div class="kw" onclick="addKW(this,'MLOps')">MLOps</div>
        <div class="kw" onclick="addKW(this,'Kubernetes')">Kubernetes</div>
      </div>
    </div>

    <!-- Matched -->
    <div class="matched-box">
      <div class="mb-title-g">Matched ✓</div>
      <div class="kw-list" id="matchedKW">
        <div class="kw-g">Python</div>
        <div class="kw-g">AWS</div>
        <div class="kw-g">PyTorch</div>
        <div class="kw-g">ML/AI</div>
      </div>
    </div>

    <!-- Score breakdown -->
    <div style="background:var(--s2);border:1px solid var(--bdr);border-radius:8px;padding:10px 12px;">
      <div class="mini-label" style="margin-bottom:8px">Score Breakdown</div>
      <div class="prog-item">
        <div class="prog-label"><span>Keywords</span><span class="prog-val" id="kwScore">72%</span></div>
        <div class="prog-bar"><div class="prog-fill" id="kwBar" style="width:72%;background:var(--cyan);box-shadow:0 0 6px var(--cyan)"></div></div>
      </div>
      <div class="prog-item">
        <div class="prog-label"><span>Format</span><span class="prog-val">91%</span></div>
        <div class="prog-bar"><div class="prog-fill" style="width:91%;background:var(--green);box-shadow:0 0 6px var(--green)"></div></div>
      </div>
      <div class="prog-item">
        <div class="prog-label"><span>XYZ Structure</span><span class="prog-val" id="xyzScore">68%</span></div>
        <div class="prog-bar"><div class="prog-fill" id="xyzBar" style="width:68%;background:var(--gold);box-shadow:0 0 4px var(--gold)"></div></div>
      </div>
      <div class="prog-item">
        <div class="prog-label"><span>Readability</span><span class="prog-val">84%</span></div>
        <div class="prog-bar"><div class="prog-fill" style="width:84%;background:var(--teal);box-shadow:0 0 4px var(--teal)"></div></div>
      </div>
    </div>

  </div>
</div>

</div><!-- /workspace -->

<!-- LOG BAR -->
<div class="log-bar">
  <div class="log-head">
    <div class="log-live-dot"></div>
    <div class="log-ht">AI MEMORY — LAYER 01 CORE WRITE LOG</div>
  </div>
  <div class="log-entries" id="logEntries">
    <div class="log-row"><span class="log-ts">[2026-04-26 14:30]</span><span class="tc-parse">PARSED</span><span class="log-msg">Resume extracted: 5 yrs experience, 2 roles, NUS MSc AI. Core seeded.</span></div>
    <div class="log-row"><span class="log-ts">[2026-04-26 14:31]</span><span class="tc-skill">SKILLS</span><span class="log-msg">12 technical skills mapped: Python, PyTorch, AWS, LangChain… Gaps flagged: RAG, MLOps.</span></div>
    <div class="log-row"><span class="log-ts">[2026-04-26 14:32]</span><span class="tc-ats">ATS</span><span class="log-msg">Benchmark stored: 78% for 'Senior AI Engineer'. Target 85% (+7% gap).</span></div>
    <div class="log-row" id="liveLog"><span class="log-ts">[2026-04-26 14:33]</span><span class="tc-xyz">XYZ</span><span class="log-msg">Achievement structure active. 3/4 bullets optimised. 1 flagged. <span class="log-cur"></span></span></div>
  </div>
</div>

<script>
// XYZ toggle
function toggleXYZ(el){
  document.querySelectorAll('.bullet-row').forEach(b=>b.classList.remove('active-xyz'));
  el.classList.add('active-xyz');
  addLog('xyz','XYZ guidance triggered. Achievement structure analysed.');
}

// Template select
function setTpl(el){document.querySelectorAll('.tpl-card').forEach(c=>c.classList.remove('active'));el.classList.add('active');}

// Tone
function moveTone(e){
  const t=document.getElementById('toneTrack');
  const r=t.getBoundingClientRect();
  const pct=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));
  document.getElementById('toneThumb').style.left=pct+'%';
  const labels=['Formal','Professional','Balanced','Confident','Direct'];
  document.getElementById('toneLbl').textContent=labels[Math.floor(pct/25)];
}

// ATS analyse
let atsScore=78;
function runATS(){
  const jd=document.getElementById('jdInput').value;
  if(!jd.trim()){document.getElementById('jdInput').placeholder='Please paste a job description…';return;}
  // Example only: this demo does not read the pasted text, so it never computes a score from it.
  addLog('ats','Example only: this demo does not analyse your text. The score shown is a sample. Sign up to run the real ATS Scanner on your resume.');
}

function updateATS(score){
  document.getElementById('atsNum').textContent=score+'%';
  document.getElementById('atsTopNum').textContent=score+'%';
  const offset=173-(173*score/100);
  document.getElementById('gaugeFill').setAttribute('stroke-dashoffset',offset);
  const col=score>=85?'var(--green)':score>=70?'var(--cyan)':'var(--red)';
  document.getElementById('gaugeFill').setAttribute('stroke',col.replace('var(','').replace(')',''));
  document.getElementById('gaugeFill').style.stroke=col;
  document.getElementById('kwScore').textContent=Math.min(95,score-6)+'%';
  document.getElementById('kwBar').style.width=Math.min(95,score-6)+'%';
}

// Add keyword click
function addKW(el,name){
  el.remove();
  const m=document.getElementById('matchedKW');
  const chip=document.createElement('div');chip.className='kw-g';chip.textContent=name;m.appendChild(chip);
  atsScore=Math.min(95,atsScore+3);
  updateATS(atsScore);
  document.getElementById('xyzScore').textContent=Math.min(90,parseInt(document.getElementById('xyzScore').textContent)+3)+'%';
  document.getElementById('xyzBar').style.width=document.getElementById('xyzScore').textContent;
  addLog('ats',\`Keyword added: "\${name}". ATS score improved to \${atsScore}%.\`);
}

// Log
const autoLogs=[
  ['cover','Cover letter tone updated. Professional voice applied to all paragraphs.'],
  ['parse','Version Draft 5 auto-saved. ATS delta tracked.'],
  ['skill','Skills vector refreshed. LangChain detected in experience. Cross-seeded.'],
  ['xyz','XYZ guidance: 4th bullet flagged for restructuring. Suggestion queued.'],
  ['ats','ATS benchmark comparison updated. Target role: Senior AI Engineer.'],
];
let li=0;
const tc={'parse':'tc-parse','ats':'tc-ats','xyz':'tc-xyz','cover':'tc-cover','skill':'tc-skill'};
function addLog(type,msg){
  const entries=document.getElementById('logEntries');
  const live=document.getElementById('liveLog');
  const now=new Date();
  const ts=\`[2026-04-26 \${String(now.getHours()).padStart(2,'0')}:\${String(now.getMinutes()).padStart(2,'0')}]\`;
  const row=document.createElement('div');row.className='log-row';
  const typeLabel=type.toUpperCase().padEnd(6);
  row.innerHTML=\`<span class="log-ts">\${ts}</span><span class="\${tc[type]||'tc-ats'}">\${type.toUpperCase()}</span><span class="log-msg">\${msg}</span>\`;
  entries.insertBefore(row,live);entries.scrollTop=entries.scrollHeight;
}
setInterval(()=>{const l=autoLogs[li%autoLogs.length];addLog(l[0],l[1]);li++;},8000);
</script>
</body>
</html>
`;

export const l2HtmlHeight = 640;
export const l2Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CareerAiHub — Layer 02: Interview + Salary Prep</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#09090d;--s1:#111218;--s2:#161820;--s3:#1c1f2c;
  --bdr:rgba(255,255,255,0.06);--bdr2:rgba(255,255,255,0.12);
  --text:#e8eaf0;--text2:#8b92a8;--text3:#3d4560;
  --teal:#00d4aa;--tdim:rgba(0,212,170,0.1);--tb:rgba(0,212,170,0.25);
  --cyan:#00c8ff;--cdim:rgba(0,200,255,0.1);--cb:rgba(0,200,255,0.25);
  --green:#00e5a0;--gdim:rgba(0,229,160,0.1);--gb:rgba(0,229,160,0.25);
  --gold:#f5c842;--goldim:rgba(245,200,66,0.1);--goldb:rgba(245,200,66,0.25);
  --red:#ff5f6e;--rdim:rgba(255,95,110,0.1);
  --purple:#F59E0B;--pdim:rgba(245,158,11,0.1);--pb:rgba(245,158,11,0.25);
  --mono:'JetBrains Mono',monospace;--disp:'Syne',sans-serif;--body:'DM Sans',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:var(--body);font-size:13px;height:100vh;display:flex;flex-direction:column;overflow:hidden;}

/* TOP */
.topbar{height:46px;background:rgba(9,9,13,0.96);border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;padding:0 18px;flex-shrink:0;}
.logo{font-family:var(--disp);font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px;}
.logo-icon{display:none}
.layer-pill{font-size:9px;font-family:var(--mono);padding:3px 10px;border-radius:20px;background:var(--cdim);color:var(--cyan);border:1px solid var(--cb);display:flex;align-items:center;gap:5px;}
.ldot{width:5px;height:5px;border-radius:50%;background:var(--cyan);box-shadow:0 0 6px var(--cyan);animation:p 2s ease-in-out infinite;}
@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
.btn{padding:5px 14px;border-radius:6px;font-size:11px;font-weight:600;border:none;cursor:pointer;font-family:var(--body);}
.btn-cyan{background:var(--cyan);color:#000;}
.btn-outline{background:transparent;border:1px solid var(--bdr2);color:var(--text2);}

/* MODULE TABS */
.mod-tabs{display:flex;border-bottom:1px solid var(--bdr);flex-shrink:0;padding:0 18px;}
.mod-tab{padding:10px 18px;font-size:11px;font-family:var(--mono);color:var(--text3);cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;display:flex;align-items:center;gap:6px;}
.mod-tab:hover{color:var(--text2);}
.mod-tab.active{color:var(--cyan);border-bottom-color:var(--cyan);}

/* 3-COL GRID */
.workspace{display:grid;grid-template-columns:1fr 1fr 1fr;flex:1;overflow:hidden;}
.col{border-right:1px solid var(--bdr);display:flex;flex-direction:column;overflow:hidden;}
.col:last-child{border-right:none;}
.col-head{padding:12px 16px;border-bottom:1px solid var(--bdr);flex-shrink:0;}
.ch-eyebrow{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px;}
.ch-title{font-family:var(--disp);font-size:13px;font-weight:700;}
.ch-sub{font-size:10px;color:var(--text2);margin-top:2px;}
.col-body{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px;}

/* ── COL 1: MOCK INTERVIEW ── */
.role-select-row{display:flex;gap:6px;}
.role-select{flex:1;padding:7px 10px;background:var(--s2);border:1px solid var(--bdr);border-radius:7px;color:var(--text);font-size:11px;font-family:var(--mono);outline:none;}
.role-select:focus{border-color:var(--cb);}

.question-card{background:var(--s2);border:1px solid var(--bdr);border-radius:10px;padding:12px;position:relative;}
.qc-num{font-size:9px;font-family:var(--mono);color:var(--text3);margin-bottom:5px;}
.qc-text{font-size:12px;line-height:1.7;margin-bottom:10px;}
.qc-type{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-family:var(--mono);padding:2px 8px;border-radius:4px;background:var(--cdim);color:var(--cyan);border:1px solid var(--cb);}

.answer-area{width:100%;padding:9px 11px;background:var(--s3);border:1px solid var(--bdr);border-radius:7px;color:var(--text);font-size:11px;font-family:var(--body);resize:none;height:70px;outline:none;line-height:1.6;}
.answer-area:focus{border-color:var(--cb);}

.submit-row{display:flex;gap:6px;margin-top:4px;}
.sub-btn{flex:1;padding:8px;border-radius:7px;font-size:10px;font-weight:700;border:none;cursor:pointer;font-family:var(--mono);transition:all .2s;}
.sub-btn-primary{background:var(--cyan);color:#000;}
.sub-btn-primary:hover{background:#22d4ff;}
.sub-btn-sec{background:var(--s2);color:var(--text2);border:1px solid var(--bdr2);}

/* scoring */
.score-card{background:var(--gdim);border:1px solid var(--gb);border-radius:10px;padding:12px;}
.sc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.sc-label{font-size:9px;font-family:var(--mono);color:var(--green);}
.sc-num{font-family:var(--disp);font-size:22px;font-weight:800;color:var(--green);}
.sc-dim{font-size:9px;color:var(--text3);font-family:var(--mono);}
.score-bars{display:flex;flex-direction:column;gap:5px;}
.sb-row{display:flex;align-items:center;gap:8px;}
.sb-label{font-size:9px;font-family:var(--mono);color:var(--text2);width:70px;flex-shrink:0;}
.sb-bar{flex:1;height:3px;background:var(--s3);border-radius:3px;overflow:hidden;}
.sb-fill{height:100%;border-radius:3px;}
.sb-val{font-size:9px;font-family:var(--mono);color:var(--text);width:28px;text-align:right;flex-shrink:0;}

/* question bank chips */
.qbank{display:flex;flex-direction:column;gap:4px;}
.qb-item{padding:8px 10px;border-radius:7px;background:var(--s2);border:1px solid var(--bdr);font-size:11px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:8px;}
.qb-item:hover{border-color:var(--cb);background:var(--cdim);}
.qb-item.done{border-color:var(--gb);background:var(--gdim);}
.qb-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}

/* ── COL 2: HM SIMULATOR ── */
.hm-context{background:var(--s2);border:1px solid var(--bdr);border-radius:8px;padding:10px 12px;font-size:10px;color:var(--text2);line-height:1.6;}
.hm-context strong{color:var(--text);}

.chat-window{flex:1;display:flex;flex-direction:column;gap:8px;min-height:0;}
.msg-wrap{display:flex;flex-direction:column;gap:8px;flex:1;overflow-y:auto;}
.msg{max-width:88%;}
.msg-hm{background:var(--rdim);border:1px solid rgba(255,95,110,0.2);border-radius:10px 10px 10px 2px;padding:9px 12px;font-size:11px;line-height:1.6;}
.msg-user{background:var(--cdim);border:1px solid var(--cb);border-radius:10px 10px 2px 10px;padding:9px 12px;font-size:11px;margin-left:auto;line-height:1.6;}
.msg-label{font-size:8px;font-family:var(--mono);margin-bottom:3px;}
.msg-hm .msg-label{color:var(--red);}
.msg-user .msg-label{color:var(--cyan);text-align:right;}
.pressure-tag{display:inline-flex;align-items:center;gap:4px;font-size:8px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:rgba(255,95,110,0.15);color:var(--red);border:1px solid rgba(255,95,110,0.2);margin-top:5px;}

.hm-input-row{display:flex;gap:6px;flex-shrink:0;}
.hm-input{flex:1;padding:8px 10px;background:var(--s2);border:1px solid var(--bdr);border-radius:7px;color:var(--text);font-size:11px;font-family:var(--body);outline:none;}
.hm-input:focus{border-color:var(--cb);}
.hm-send{padding:8px 14px;border-radius:7px;background:var(--red);color:#fff;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:var(--body);transition:all .15s;flex-shrink:0;}
.hm-send:hover{background:#ff7a86;}

/* pressure meter */
.pressure-meter{background:var(--s2);border:1px solid var(--bdr);border-radius:8px;padding:10px 12px;}
.pm-label{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;}
.pm-bar{height:6px;background:var(--s3);border-radius:6px;overflow:hidden;}
.pm-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,var(--green),var(--gold),var(--red));transition:width .5s;width:65%;}
.pm-row{display:flex;justify-content:space-between;font-size:9px;font-family:var(--mono);color:var(--text3);margin-top:4px;}

/* ── COL 3: SALARY COACH ── */
.salary-role-row{display:flex;gap:6px;margin-bottom:4px;}
.sal-select{flex:1;padding:7px 10px;background:var(--s2);border:1px solid var(--bdr);border-radius:7px;color:var(--text);font-size:11px;font-family:var(--mono);outline:none;}
.sal-select:focus{border-color:var(--goldb);}

/* bench chart */
.bench-chart{background:var(--s2);border:1px solid var(--bdr);border-radius:10px;padding:14px;}
.bc-title{font-size:10px;font-family:var(--mono);color:var(--text2);margin-bottom:10px;}
.bc-bars{display:flex;flex-direction:column;gap:8px;}
.bc-row{display:flex;align-items:center;gap:8px;}
.bc-label{font-size:10px;color:var(--text2);width:72px;flex-shrink:0;font-family:var(--mono);}
.bc-bar-track{flex:1;height:18px;background:var(--s3);border-radius:4px;overflow:hidden;position:relative;}
.bc-bar-fill{height:100%;border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:9px;font-family:var(--mono);font-weight:600;transition:width 1s ease;}
.bc-user{background:linear-gradient(90deg,var(--cyan),rgba(0,200,255,0.6));color:#000;}
.bc-p25{background:rgba(255,255,255,0.07);color:var(--text3);}
.bc-p75{background:rgba(255,255,255,0.05);color:var(--text3);}
.bc-marker{position:absolute;top:0;bottom:0;width:2px;background:var(--gold);box-shadow:0 0 6px var(--gold);}
.bc-val{font-size:10px;font-family:var(--mono);color:var(--text);width:48px;text-align:right;flex-shrink:0;}

/* offer card */
.offer-card{background:var(--goldim);border:1px solid var(--goldb);border-radius:10px;padding:12px;}
.oc-title{font-size:9px;font-family:var(--mono);color:var(--gold);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;}
.oc-amount{font-family:var(--disp);font-size:26px;font-weight:800;color:var(--gold);margin-bottom:4px;}
.oc-sub{font-size:10px;color:var(--text2);margin-bottom:10px;}
.counter-input{width:100%;padding:7px 10px;background:var(--s2);border:1px solid var(--bdr2);border-radius:6px;color:var(--text);font-size:12px;font-family:var(--mono);outline:none;margin-bottom:6px;}
.counter-btn{width:100%;padding:8px;border-radius:6px;background:var(--gold);color:#000;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:var(--body);transition:all .2s;}
.counter-btn:hover{background:#ffe066;}

/* negotiation tips */
.tip-card{background:var(--s2);border:1px solid var(--bdr);border-radius:8px;padding:10px 12px;}
.tip-title{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px;}
.tip-item{display:flex;gap:7px;margin-bottom:6px;font-size:11px;line-height:1.5;}
.tip-icon{color:var(--gold);flex-shrink:0;}

/* LOG BAR */
.log-bar{height:88px;border-top:1px solid var(--bdr);flex-shrink:0;display:flex;flex-direction:column;}
.log-head{padding:5px 16px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:7px;flex-shrink:0;}
.log-live-dot{width:5px;height:5px;border-radius:50%;background:var(--cyan);box-shadow:0 0 5px var(--cyan);animation:p 1.5s infinite;}
.log-ht{font-size:9px;font-family:var(--mono);color:var(--text3);}
.log-entries{flex:1;overflow-y:auto;padding:5px 16px;display:flex;flex-direction:column;gap:3px;}
.log-row{display:flex;gap:10px;font-size:10px;font-family:var(--mono);}
.log-ts{color:var(--text3);flex-shrink:0;}
.tc-int{color:var(--cyan);}
.tc-sal{color:var(--gold);}
.tc-hm{color:var(--red);}
.tc-score{color:var(--green);}
.log-msg{color:var(--text2);}
.log-cur{display:inline-block;width:6px;height:10px;background:var(--cyan);animation:blink 1s step-end infinite;vertical-align:middle;}
@keyframes blink{50%{opacity:0}}

::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:3px;}
</style>
</head>
<body>

<!-- TOPBAR -->
<div class="topbar">
  <div style="display:flex;align-items:center;gap:12px">
    <div class="logo"><svg width="28" height="28" viewBox="0 0 100 100" fill="none" style="flex-shrink:0"><defs><linearGradient id="orb-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#EC4899"/><stop offset="55%" stop-color="#F59E0B"/><stop offset="100%" stop-color="#F59E0B"/></linearGradient></defs><ellipse cx="50" cy="50" rx="42" ry="18" transform="rotate(-28 50 50)" stroke="url(#orb-g)" stroke-width="2" opacity="0.32"/><ellipse cx="50" cy="50" rx="42" ry="18" transform="rotate(28 50 50)" stroke="url(#orb-g)" stroke-width="2" opacity="0.32"/><circle cx="50" cy="50" r="11" fill="url(#orb-g)"/><circle cx="81.94" cy="26.03" r="4.5" fill="url(#orb-g)"/><circle cx="70.42" cy="75.19" r="4" fill="url(#orb-g)"/><circle cx="18.06" cy="73.97" r="3.5" fill="url(#orb-g)"/></svg>career<span style="background:linear-gradient(110deg,#EC4899 0%,#F59E0B 55%,#F59E0B 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent">ai</span>hub</div>
    <div class="layer-pill"><div class="ldot"></div>LAYER 02 — INTERVIEW + SALARY PREP</div>
  </div>
  <div style="display:flex;gap:8px;">
    <button class="btn btn-outline">Resume Context: Ivy Nguyen ✓</button>
    <button class="btn btn-cyan">Try Free →</button>
  </div>
</div>

<!-- MODULE TABS -->
<div class="mod-tabs">
  <div class="mod-tab active" id="tab0" onclick="setTab(0)">🎯 Mock Interview</div>
  <div class="mod-tab" id="tab1" onclick="setTab(1)">🔥 HM Simulator</div>
  <div class="mod-tab" id="tab2" onclick="setTab(2)">💰 Salary Coach</div>
</div>

<div class="workspace">

<!-- ── COL 1: MOCK INTERVIEW ── -->
<div class="col">
  <div class="col-head">
    <div class="ch-eyebrow">Module 1</div>
    <div class="ch-title">Mock Interviews</div>
    <div class="ch-sub">Role-specific · Real data · AI-scored</div>
  </div>
  <div class="col-body">

    <div>
      <div style="font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Target Role</div>
      <select class="role-select" id="roleSelect" onchange="changeRole()">
        <option>Senior AI Engineer</option>
        <option>ML Research Scientist</option>
        <option>Data Engineering Lead</option>
        <option>Cloud Architect</option>
      </select>
    </div>

    <!-- active question -->
    <div class="question-card">
      <div class="qc-num">Question 2 of 8 · <span id="roleLabel" style="color:var(--cyan)">Senior AI Engineer</span></div>
      <div class="qc-text" id="qText">"Describe a time you optimised a production ML model for latency without sacrificing accuracy. What was your approach and what was the measurable outcome?"</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        <div class="qc-type">🎯 Behavioural</div>
        <div style="display:inline-flex;align-items:center;gap:4px;font-size:9px;font-family:var(--mono);padding:2px 8px;border-radius:4px;background:var(--gdim);color:var(--green);border:1px solid var(--gb)">⭐ High frequency</div>
      </div>
    </div>

    <div>
      <div style="font-size:9px;font-family:var(--mono);color:var(--text3);margin-bottom:4px">Your Answer (AI will score)</div>
      <textarea class="answer-area" id="answerBox" placeholder="Type your answer using STAR method…"></textarea>
      <div class="submit-row">
        <button class="sub-btn sub-btn-primary" onclick="submitAnswer()">⚡ Score Answer</button>
        <button class="sub-btn sub-btn-sec" onclick="nextQ()">Next Q →</button>
      </div>
    </div>

    <!-- score card -->
    <div class="score-card" id="scoreCard">
      <div class="sc-head">
        <div>
          <div class="sc-label">AI Score</div>
          <div class="sc-num" id="scoreNum">88</div>
          <div class="sc-dim">/ 100</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:9px;font-family:var(--mono);color:var(--text3)">Trend</div>
          <div style="font-family:var(--disp);font-size:13px;font-weight:700;color:var(--green)">▲ +6</div>
          <div style="font-size:8px;font-family:var(--mono);color:var(--text3)">vs prev</div>
        </div>
      </div>
      <div class="score-bars">
        <div class="sb-row"><div class="sb-label">Clarity</div><div class="sb-bar"><div class="sb-fill" style="width:90%;background:var(--cyan);box-shadow:0 0 4px var(--cyan)"></div></div><div class="sb-val">90</div></div>
        <div class="sb-row"><div class="sb-label">Structure</div><div class="sb-bar"><div class="sb-fill" style="width:88%;background:var(--green);box-shadow:0 0 4px var(--green)"></div></div><div class="sb-val">88</div></div>
        <div class="sb-row"><div class="sb-label">Specificity</div><div class="sb-bar"><div class="sb-fill" style="width:85%;background:var(--teal);box-shadow:0 0 4px var(--teal)"></div></div><div class="sb-val">85</div></div>
        <div class="sb-row"><div class="sb-label">Impact</div><div class="sb-bar"><div class="sb-fill" style="width:80%;background:var(--gold);box-shadow:0 0 4px var(--gold)"></div></div><div class="sb-val">80</div></div>
      </div>
    </div>

    <!-- Question bank -->
    <div>
      <div style="font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Question Bank</div>
      <div class="qbank">
        <div class="qb-item done" onclick="selectQ(this,0)"><div class="qb-dot" style="background:var(--green)"></div>Tell me about yourself</div>
        <div class="qb-item done" onclick="selectQ(this,1)"><div class="qb-dot" style="background:var(--green)"></div>ML model optimization</div>
        <div class="qb-item" style="border-color:var(--cb);background:var(--cdim)" onclick="selectQ(this,2)"><div class="qb-dot" style="background:var(--cyan);box-shadow:0 0 4px var(--cyan)"></div>System design at scale</div>
        <div class="qb-item" onclick="selectQ(this,3)"><div class="qb-dot" style="background:var(--text3)"></div>Handling ambiguity</div>
        <div class="qb-item" onclick="selectQ(this,4)"><div class="qb-dot" style="background:var(--text3)"></div>Leadership + conflict</div>
        <div class="qb-item" onclick="selectQ(this,5)"><div class="qb-dot" style="background:var(--text3)"></div>Salary expectations</div>
      </div>
    </div>
  </div>
</div>

<!-- ── COL 2: HM SIMULATOR ── -->
<div class="col">
  <div class="col-head">
    <div class="ch-eyebrow">Module 2</div>
    <div class="ch-title">HM Simulator</div>
    <div class="ch-sub">Pressure-test · Follow-up probes · Real-time</div>
  </div>
  <div class="col-body">

    <div class="hm-context">
      <strong>Hiring Manager context:</strong> Senior AI Engineer role at a Series B fintech. Team of 8. Your resume and target role are loaded into AI memory.
    </div>

    <div class="pressure-meter">
      <div class="pm-label">Pressure Level</div>
      <div class="pm-bar"><div class="pm-fill" id="pressureBar"></div></div>
      <div class="pm-row"><span>Warm-up</span><span>Moderate</span><span>Pressure</span></div>
    </div>

    <div class="chat-window">
      <div class="msg-wrap" id="hmChat">
        <div class="msg">
          <div class="msg-hm">
            <div class="msg-label">HM Simulator</div>
            I reviewed your experience with RAG pipelines. You mentioned cutting review time by 60%. How exactly did you measure that, and who validated those numbers?
            <div><div class="pressure-tag">🔥 Probing claim</div></div>
          </div>
        </div>
        <div class="msg" style="margin-left:auto">
          <div class="msg-user">
            <div class="msg-label">You</div>
            We tracked ticket resolution time in Jira before and after deployment across 3 product teams over a 6-week period. The PM and engineering lead both signed off on the metric.
          </div>
        </div>
        <div class="msg">
          <div class="msg-hm">
            <div class="msg-label">HM Simulator</div>
            Good specificity. But if you had to do it again — what would you measure differently to make the case even stronger?
            <div><div class="pressure-tag">🔥 Follow-up probe</div></div>
          </div>
        </div>
      </div>
      <div class="hm-input-row">
        <input class="hm-input" id="hmInput" type="text" placeholder="Type your response…" onkeydown="if(event.key==='Enter')sendHM()"/>
        <button class="hm-send" onclick="sendHM()">Send</button>
      </div>
    </div>

    <!-- AI feedback -->
    <div style="background:var(--s2);border:1px solid var(--bdr);border-radius:8px;padding:10px 12px;">
      <div style="font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px">Live Coaching</div>
      <div style="font-size:11px;color:var(--text2);line-height:1.6">
        ✓ <span style="color:var(--green)">Strong:</span> You gave evidence with a timeframe and named validators.<br>
        ⚠ <span style="color:var(--gold)">Improve:</span> Add a control group or baseline comparison for stronger statistical credibility.
      </div>
    </div>

  </div>
</div>

<!-- ── COL 3: SALARY COACH ── -->
<div class="col">
  <div class="col-head">
    <div class="ch-eyebrow">Module 3</div>
    <div class="ch-title">Salary Coach</div>
    <div class="ch-sub">Live SG benchmarks · Offer roleplay</div>
  </div>
  <div class="col-body">

    <div style="display:flex;gap:6px;">
      <select class="sal-select" onchange="updateBench()">
        <option>Senior AI Engineer</option>
        <option>ML Scientist</option>
        <option>Data Eng Lead</option>
      </select>
      <select class="sal-select" style="width:80px" onchange="updateBench()">
        <option>5 yrs</option>
        <option>3 yrs</option>
        <option>8 yrs</option>
      </select>
    </div>

    <!-- Benchmark chart -->
    <div class="bench-chart">
      <div class="bc-title">Singapore Market Benchmarks — Senior AI Engineer</div>
      <div class="bc-bars">
        <div class="bc-row">
          <div class="bc-label">Your ask</div>
          <div class="bc-bar-track">
            <div class="bc-bar-fill bc-user" style="width:78%">14k</div>
          </div>
          <div class="bc-val" style="color:var(--cyan)">SGD 14k</div>
        </div>
        <div class="bc-row">
          <div class="bc-label">P75 Market</div>
          <div class="bc-bar-track">
            <div class="bc-bar-fill" style="width:88%;background:rgba(0,229,160,0.2);color:var(--green)">16k</div>
            <div class="bc-marker" style="left:88%"></div>
          </div>
          <div class="bc-val" style="color:var(--green)">SGD 16k</div>
        </div>
        <div class="bc-row">
          <div class="bc-label">P50 Median</div>
          <div class="bc-bar-track">
            <div class="bc-bar-fill" style="width:68%;background:rgba(255,255,255,0.08);color:var(--text2)">12k</div>
          </div>
          <div class="bc-val">SGD 12k</div>
        </div>
        <div class="bc-row">
          <div class="bc-label">P25 Base</div>
          <div class="bc-bar-track">
            <div class="bc-bar-fill" style="width:50%;background:rgba(255,255,255,0.05);color:var(--text3)">9k</div>
          </div>
          <div class="bc-val" style="color:var(--text3)">SGD 9k</div>
        </div>
      </div>
      <div style="margin-top:10px;font-size:10px;font-family:var(--mono);color:var(--text2);padding:6px 8px;background:var(--gdim);border-radius:5px;border:1px solid var(--gb)">
        💡 You're positioned at <span style="color:var(--cyan)">P62</span>. P75 target = <span style="color:var(--green)">SGD 16,000</span>. Counter-offer recommended.
      </div>
    </div>

    <!-- Offer roleplay -->
    <div class="offer-card">
      <div class="oc-title">Offer Received</div>
      <div class="oc-amount">SGD 13,500 <span style="font-size:12px;font-family:var(--mono);color:var(--text3)">/mo</span></div>
      <div class="oc-sub">TechCorp · Senior AI Engineer · 5 yrs experience</div>
      <div style="font-size:9px;font-family:var(--mono);color:var(--text3);margin-bottom:5px">Counter-offer amount (SGD)</div>
      <input class="counter-input" type="text" value="15,500" id="counterVal"/>
      <button class="counter-btn" onclick="runCounter()">🎯 Practise Counter-offer</button>
    </div>

    <!-- Tips -->
    <div class="tip-card">
      <div class="tip-title">Negotiation Tips · AI-calibrated</div>
      <div class="tip-item"><span class="tip-icon">⚡</span><span>Lead with market data, not personal need. "P75 for this role in Singapore is SGD 16k."</span></div>
      <div class="tip-item"><span class="tip-icon">⚡</span><span>Anchor 10–15% above your target. You gave SGD 14k, anchor at SGD 15.5k.</span></div>
      <div class="tip-item"><span class="tip-icon">⚡</span><span>Use silence strategically. After stating your counter, stop talking.</span></div>
    </div>

  </div>
</div>

</div><!-- /workspace -->

<!-- LOG BAR -->
<div class="log-bar">
  <div class="log-head">
    <div class="log-live-dot"></div>
    <div class="log-ht">AI MEMORY — LAYER 02 CORE WRITE LOG</div>
  </div>
  <div class="log-entries" id="logEntries">
    <div class="log-row"><span class="log-ts">[2026-04-26 14:40]</span><span class="tc-int">INTERVIEW</span><span class="log-msg">Session started: Senior AI Engineer. Q1 completed. Score 82/100 stored.</span></div>
    <div class="log-row"><span class="log-ts">[2026-04-26 14:41]</span><span class="tc-score">SCORE</span><span class="log-msg">Answer trend: +6 improvement vs last session. Weak spot: specificity (78 → 85).</span></div>
    <div class="log-row"><span class="log-ts">[2026-04-26 14:42]</span><span class="tc-sal">SALARY</span><span class="log-msg">Market calibrated: Senior AI Engineer SGD 14k ask vs P75 SGD 16k. Delta: +2k.</span></div>
    <div class="log-row" id="liveLog"><span class="log-ts">[2026-04-26 14:43]</span><span class="tc-hm">HM SIM</span><span class="log-msg">Pressure session active. Claim probe: RAG pipeline ROI metrics. <span class="log-cur"></span></span></div>
  </div>
</div>

<script>
// Tab switching (visual only for now)
function setTab(i){
  document.querySelectorAll('.mod-tab').forEach((t,j)=>t.classList.toggle('active',j===i));
}

// Role change
const questions=[
  '"Describe a time you optimised a production ML model for latency without sacrificing accuracy."',
  '"Walk me through how you would design a scalable feature store for a real-time ML system."',
  '"Tell me about the most complex data pipeline you\\'ve built. What were the failure modes?"',
  '"How do you handle model drift in production? Give a concrete example."',
  '"Describe a situation where you disagreed with technical leadership. How did you handle it?"',
  '"What salary range are you targeting and how did you arrive at it?"',
];
let qIdx=2;
function changeRole(){
  const r=document.getElementById('roleSelect').value;
  document.getElementById('roleLabel').textContent=r;
  addLog('int',\`Role changed to "\${r}". Question bank refreshed. AI memory context updated.\`);
}
function nextQ(){
  qIdx=(qIdx+1)%questions.length;
  document.getElementById('qText').textContent=questions[qIdx];
  document.getElementById('answerBox').value='';
}
function selectQ(el,i){
  document.querySelectorAll('.qb-item').forEach(q=>q.style.borderColor='');
  el.style.borderColor='var(--cb)';
  qIdx=i;
  document.getElementById('qText').textContent=questions[i];
}
function submitAnswer(){
  const a=document.getElementById('answerBox').value;
  if(!a.trim()){document.getElementById('answerBox').placeholder='Please type an answer first…';return;}
  // Example only: this demo does not read the answer, so it never produces a score or feedback for it.
  addLog('score','Example only: this demo does not score your answer. The 88 shown is a sample. Sign up to practise with real AI feedback.');
}

// HM chat
const hmResponses=[
  {text:'Interesting. Can you quantify the business impact of that decision in dollars or time saved?', tag:'💰 Quantify impact'},
  {text:'You keep mentioning your team. What specifically did YOU contribute vs the team?', tag:'🔥 Ownership probe'},
  {text:'That sounds rehearsed. Give me the messy version — what actually went wrong?', tag:'🔥 Authenticity check'},
  {text:'If I called your manager right now, what would they say is your biggest weakness?', tag:'🔥 Reference probe'},
];
let hmIdx=0;
function sendHM(){
  const input=document.getElementById('hmInput');
  const val=input.value.trim();
  if(!val)return;
  const chat=document.getElementById('hmChat');
  const userMsg=document.createElement('div');userMsg.className='msg';userMsg.style.marginLeft='auto';
  userMsg.innerHTML=\`<div class="msg-user"><div class="msg-label">You</div>\${val}</div>\`;
  chat.appendChild(userMsg);
  input.value='';
  // pressure increases
  const p=Math.min(90,parseInt(document.getElementById('pressureBar').style.width||'65')+8);
  document.getElementById('pressureBar').style.width=p+'%';
  setTimeout(()=>{
    const r=hmResponses[hmIdx%hmResponses.length];hmIdx++;
    const hmMsg=document.createElement('div');hmMsg.className='msg';
    hmMsg.innerHTML=\`<div class="msg-hm"><div class="msg-label">HM Simulator</div>\${r.text}<div><div class="pressure-tag">\${r.tag}</div></div></div>\`;
    chat.appendChild(hmMsg);
    chat.scrollTop=chat.scrollHeight;
    addLog('hm',\`HM probe: "\${r.tag.replace(/[🔥💰]/g,'').trim()}". Pressure level \${p}%.\`);
  },900);
  chat.scrollTop=chat.scrollHeight;
}

// Counter offer
function runCounter(){
  const val=document.getElementById('counterVal').value;
  addLog('sal',\`Counter-offer practice: SGD \${val} vs offer SGD 13,500. Negotiation coaching queued.\`);
  document.getElementById('counterVal').style.borderColor='var(--goldb)';
}

function updateBench(){
  addLog('sal','Example only: role and level context saved to core memory.');
}

// Log
const autoLogs=[
  ['int','Mock interview Q3 answered. Weak spot flagged: quantified impact. Improvement plan updated.'],
  ['score','Answer trend stored. Session 4 score avg: 85.3 (+3.1 vs Session 3).'],
  ['hm','HM Simulator session saved. Pressure peak: 82%. Recovery score: strong.'],
  ['sal','Example only: salary context refreshed from the numbers you entered.'],
];
let li=0;
const tc={'int':'tc-int','sal':'tc-sal','hm':'tc-hm','score':'tc-score'};
function addLog(type,msg){
  const entries=document.getElementById('logEntries');
  const live=document.getElementById('liveLog');
  const now=new Date();
  const ts=\`[2026-04-26 \${String(now.getHours()).padStart(2,'0')}:\${String(now.getMinutes()).padStart(2,'0')}]\`;
  const row=document.createElement('div');row.className='log-row';
  row.innerHTML=\`<span class="log-ts">\${ts}</span><span class="\${tc[type]||'tc-int'}">\${type.toUpperCase()}</span><span class="log-msg">\${msg}</span>\`;
  entries.insertBefore(row,live);entries.scrollTop=entries.scrollHeight;
}
setInterval(()=>{const l=autoLogs[li%autoLogs.length];addLog(l[0],l[1]);li++;},9000);
</script>
</body>
</html>
`;

export const l3HtmlHeight = 680;
export const l3Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CareerAiHub — Layer 03: Verified Credentials</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0a0b0d;
    --surface: #111318;
    --surface-2: #181c23;
    --surface-3: #1e2330;
    --border: rgba(255,255,255,0.07);
    --border-bright: rgba(255,255,255,0.14);
    --text: #e8eaf0;
    --text-muted: #6b7280;
    --text-dim: #3d4555;
    --green: #00e5a0;
    --green-dim: rgba(0,229,160,0.12);
    --green-glow: rgba(0,229,160,0.3);
    --cyan: #00c8ff;
    --cyan-dim: rgba(0,200,255,0.1);
    --gold: #f5c842;
    --gold-dim: rgba(245,200,66,0.1);
    --purple: #7c5cfc;
    --red: #ff5f6e;
    --font-mono: 'JetBrains Mono', monospace;
    --font-display: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.6;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* ── NAV ── */
  nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 32px; height: 60px;
    background: rgba(10,11,13,0.9);
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 100;
    backdrop-filter: blur(12px);
  }
  .nav-logo {
    display: flex; align-items: center; gap: 10px;
    font-family: var(--font-display); font-size: 17px; font-weight: 700;
    color: var(--text);
  }
  .nav-logo-icon { display: none; }
  .nav-tabs {
    display: flex; gap: 2px;
    background: var(--surface); border-radius: 40px; padding: 4px;
    border: 1px solid var(--border);
  }
  .nav-tab {
    padding: 6px 16px; border-radius: 40px; font-size: 12px;
    font-family: var(--font-body); font-weight: 500;
    cursor: pointer; border: none; background: transparent;
    color: var(--text-muted); transition: all 0.2s;
    display: flex; align-items: center; gap: 6px;
  }
  .nav-tab.active { background: var(--surface-3); color: var(--text); }
  .nav-tab .dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--green); box-shadow: 0 0 6px var(--green);
  }
  .nav-tab .dot-gold { background: var(--gold); box-shadow: 0 0 6px var(--gold); }
  .nav-actions { display: flex; gap: 10px; align-items: center; }
  .btn-outline {
    padding: 7px 16px; border-radius: 8px; font-size: 12px;
    border: 1px solid var(--border-bright); background: transparent;
    color: var(--text-muted); cursor: pointer; font-family: var(--font-body);
    transition: all 0.2s;
  }
  .btn-outline:hover { border-color: var(--green); color: var(--green); }
  .btn-primary {
    padding: 7px 18px; border-radius: 8px; font-size: 12px; font-weight: 600;
    border: none; background: var(--green); color: #000;
    cursor: pointer; font-family: var(--font-body); transition: all 0.2s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-primary:hover { background: #00ffb3; box-shadow: 0 0 20px var(--green-glow); }

  /* ── LAYER STRIP ── */
  .layer-strip {
    display: flex; gap: 0; overflow-x: auto;
    border-bottom: 1px solid var(--border);
    padding: 0 32px;
  }
  .layer-chip {
    padding: 12px 24px; font-size: 11px; font-family: var(--font-mono);
    border-right: 1px solid var(--border); cursor: pointer;
    color: var(--text-muted); white-space: nowrap;
    transition: all 0.2s; border-bottom: 2px solid transparent;
    display: flex; align-items: center; gap: 8px;
  }
  .layer-chip .lnum { color: var(--text-dim); font-size: 9px; }
  .layer-chip.active { color: var(--text); border-bottom-color: var(--green); background: rgba(0,229,160,0.04); }
  .layer-chip.done { color: var(--green); }
  .layer-chip.planned { color: var(--text-dim); }

  /* ── MAIN LAYOUT ── */
  .main { display: flex; min-height: calc(100vh - 120px); }

  /* ── SIDEBAR ── */
  .sidebar {
    width: 240px; flex-shrink: 0;
    border-right: 1px solid var(--border);
    padding: 24px 0;
    display: flex; flex-direction: column; gap: 4px;
  }
  .sidebar-section { padding: 0 16px 8px; margin-top: 16px; }
  .sidebar-label {
    font-size: 9px; font-family: var(--font-mono); font-weight: 500;
    color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.1em;
    padding: 0 16px 4px;
  }
  .sidebar-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 20px; cursor: pointer; border-radius: 0;
    color: var(--text-muted); font-size: 13px; transition: all 0.15s;
    border-left: 2px solid transparent;
  }
  .sidebar-item:hover { color: var(--text); background: rgba(255,255,255,0.03); }
  .sidebar-item.active { color: var(--text); background: rgba(0,229,160,0.06); border-left-color: var(--green); }
  .sidebar-item svg { opacity: 0.6; flex-shrink: 0; }
  .sidebar-item.active svg { opacity: 1; }

  /* Trust Score */
  .trust-panel {
    margin: 20px 16px; padding: 16px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; text-align: center;
  }
  .trust-ring-wrap { position: relative; width: 80px; height: 80px; margin: 0 auto 12px; }
  .trust-ring { width: 80px; height: 80px; transform: rotate(-90deg); }
  .trust-ring-bg { fill: none; stroke: var(--surface-3); stroke-width: 6; }
  .trust-ring-fill {
    fill: none; stroke: var(--green); stroke-width: 6;
    stroke-linecap: round;
    stroke-dasharray: 220; stroke-dashoffset: 44;
    filter: drop-shadow(0 0 6px var(--green));
    transition: stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1);
  }
  .trust-score-num {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    font-family: var(--font-display); font-size: 20px; font-weight: 700;
    color: var(--text);
  }
  .trust-label { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }
  .trust-delta {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; color: var(--green); margin-top: 4px;
    font-family: var(--font-mono);
  }

  /* ── CONTENT ── */
  .content { flex: 1; padding: 28px 32px; overflow-y: auto; }

  /* Page header */
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; }
  .page-title-block {}
  .page-eyebrow {
    font-size: 10px; font-family: var(--font-mono); color: var(--green);
    text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;
    display: flex; align-items: center; gap: 6px;
  }
  .page-eyebrow::before {
    content: ''; width: 20px; height: 1px; background: var(--green);
  }
  .page-title {
    font-family: var(--font-display); font-size: 26px; font-weight: 700;
    color: var(--text); margin-bottom: 4px;
  }
  .page-sub { font-size: 13px; color: var(--text-muted); }
  .page-actions { display: flex; gap: 10px; align-items: center; }

  /* recruiter toggle */
  .recruiter-toggle {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 14px; border-radius: 8px;
    border: 1px solid var(--border-bright); background: var(--surface);
    cursor: pointer; font-size: 12px; color: var(--text-muted);
    transition: all 0.2s;
  }
  .recruiter-toggle.active {
    border-color: var(--cyan); color: var(--cyan);
    background: var(--cyan-dim); box-shadow: 0 0 16px rgba(0,200,255,0.15);
  }
  .toggle-switch {
    width: 30px; height: 16px; border-radius: 20px; background: var(--surface-3);
    position: relative; transition: background 0.2s;
  }
  .toggle-switch::after {
    content: ''; position: absolute; top: 2px; left: 2px;
    width: 12px; height: 12px; border-radius: 50%; background: var(--text-dim);
    transition: all 0.2s;
  }
  .recruiter-toggle.active .toggle-switch { background: var(--cyan); }
  .recruiter-toggle.active .toggle-switch::after { left: 16px; background: #fff; }

  /* ── GRID SECTIONS ── */
  .section-label {
    font-size: 10px; font-family: var(--font-mono); color: var(--text-dim);
    text-transform: uppercase; letter-spacing: 0.12em;
    margin-bottom: 14px; display: flex; align-items: center; gap: 10px;
  }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  .cred-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 16px; margin-bottom: 32px;
  }

  /* ── CREDENTIAL CARD ── */
  .cred-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px; overflow: hidden;
    transition: all 0.25s; position: relative;
  }
  .cred-card:hover { border-color: var(--border-bright); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
  .cred-card.verified { border-color: rgba(0,229,160,0.2); }
  .cred-card.verified:hover { border-color: rgba(0,229,160,0.4); box-shadow: 0 8px 32px rgba(0,229,160,0.08); }

  .cred-card-top {
    padding: 18px 18px 14px;
    display: flex; align-items: flex-start; justify-content: space-between;
  }
  .cred-inst { display: flex; align-items: center; gap: 12px; }
  .inst-logo {
    width: 40px; height: 40px; border-radius: 10px;
    background: var(--surface-2); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display); font-size: 14px; font-weight: 800;
    flex-shrink: 0;
  }
  .inst-info {}
  .inst-name { font-size: 11px; color: var(--text-muted); margin-bottom: 2px; font-family: var(--font-mono); }
  .degree-name { font-family: var(--font-display); font-size: 14px; font-weight: 700; color: var(--text); }

  /* green badge */
  .verified-badge {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 10px; border-radius: 20px;
    background: var(--green-dim); border: 1px solid rgba(0,229,160,0.3);
    font-size: 10px; font-family: var(--font-mono); color: var(--green);
    flex-shrink: 0;
    animation: badgePulse 3s ease-in-out infinite;
  }
  .verified-badge .vdot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--green);
    box-shadow: 0 0 8px var(--green);
  }
  @keyframes badgePulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--green-glow); }
    50% { box-shadow: 0 0 12px 2px var(--green-glow); }
  }

  .cred-fields { padding: 0 18px 14px; display: flex; flex-direction: column; gap: 8px; }
  .cred-field {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; border-radius: 8px;
    background: var(--surface-2); border: 1px solid var(--border);
  }
  .field-label { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }
  .field-value { font-size: 12px; color: var(--text); font-weight: 500; display: flex; align-items: center; gap: 8px; }
  .field-hidden { filter: blur(5px); user-select: none; transition: filter 0.2s; }
  .eye-btn {
    background: none; border: none; cursor: pointer; padding: 0;
    color: var(--text-dim); transition: color 0.15s; display: flex;
  }
  .eye-btn:hover { color: var(--green); }

  .cred-card-footer {
    padding: 12px 18px; border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .proof-btn {
    font-size: 10px; font-family: var(--font-mono); color: var(--text-dim);
    background: none; border: none; cursor: pointer;
    display: flex; align-items: center; gap: 5px; transition: color 0.15s;
  }
  .proof-btn:hover { color: var(--green); }
  .chain-hash { font-size: 9px; font-family: var(--font-mono); color: var(--text-dim); }

  /* proof drawer */
  .proof-drawer {
    padding: 0 18px; max-height: 0; overflow: hidden;
    transition: max-height 0.3s ease, padding 0.3s ease;
  }
  .proof-drawer.open { max-height: 200px; padding: 14px 18px; }
  .proof-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  .proof-key { font-size: 9px; font-family: var(--font-mono); color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
  .proof-val { font-size: 10px; font-family: var(--font-mono); color: var(--cyan); word-break: break-all; }
  .proof-val.hash { color: var(--green); }

  /* add card */
  .cred-card-add {
    background: transparent; border: 1px dashed var(--border);
    border-radius: 14px; min-height: 180px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; cursor: pointer; transition: all 0.2s;
  }
  .cred-card-add:hover { border-color: var(--green); background: var(--green-dim); }
  .add-icon {
    width: 40px; height: 40px; border-radius: 10px;
    border: 1px dashed var(--text-dim);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; color: var(--text-dim); transition: all 0.2s;
  }
  .cred-card-add:hover .add-icon { border-color: var(--green); color: var(--green); }
  .add-label { font-size: 12px; color: var(--text-dim); font-family: var(--font-mono); transition: color 0.2s; }
  .cred-card-add:hover .add-label { color: var(--green); }

  /* ── VERIFICATION MODAL ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8);
    backdrop-filter: blur(8px); z-index: 200;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none; transition: opacity 0.3s;
  }
  .modal-overlay.open { opacity: 1; pointer-events: all; }
  .modal {
    background: var(--surface); border: 1px solid var(--border-bright);
    border-radius: 18px; width: 420px; padding: 32px;
    transform: translateY(20px); transition: transform 0.3s;
  }
  .modal-overlay.open .modal { transform: translateY(0); }
  .modal-title {
    font-family: var(--font-display); font-size: 18px; font-weight: 700;
    margin-bottom: 8px;
  }
  .modal-sub { font-size: 12px; color: var(--text-muted); margin-bottom: 24px; }

  /* verification steps */
  .ver-steps { display: flex; flex-direction: column; gap: 0; }
  .ver-step {
    display: flex; gap: 14px; align-items: flex-start;
    padding: 14px 0; border-bottom: 1px solid var(--border);
    opacity: 0.3; transition: opacity 0.4s;
  }
  .ver-step:last-child { border-bottom: none; }
  .ver-step.active { opacity: 1; }
  .ver-step.done { opacity: 0.7; }
  .step-icon {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
    background: var(--surface-2); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; transition: all 0.4s;
  }
  .ver-step.active .step-icon { border-color: var(--cyan); background: var(--cyan-dim); }
  .ver-step.done .step-icon { border-color: var(--green); background: var(--green-dim); }
  .step-info {}
  .step-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
  .step-detail { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }
  .step-spinner {
    display: inline-block; width: 10px; height: 10px;
    border: 2px solid var(--cyan); border-top-color: transparent;
    border-radius: 50%; animation: spin 0.7s linear infinite;
    margin-left: 6px; vertical-align: middle;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── SKILLS MATRIX ── */
  .skills-section { margin-bottom: 32px; }
  .skills-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .skills-chart-box {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 20px;
  }
  .box-title { font-family: var(--font-display); font-size: 13px; font-weight: 700; margin-bottom: 4px; }
  .box-sub { font-size: 11px; color: var(--text-muted); margin-bottom: 16px; }
  .radar-wrap { display: flex; justify-content: center; }
  svg.radar { overflow: visible; }

  /* skills list */
  .skills-list { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
  .skill-row { display: flex; flex-direction: column; gap: 4px; }
  .skill-row-top { display: flex; justify-content: space-between; align-items: center; }
  .skill-name { font-size: 12px; color: var(--text); }
  .skill-stat { font-size: 11px; font-family: var(--font-mono); }
  .skill-stat.verified { color: var(--cyan); }
  .skill-stat.pending { color: var(--text-dim); }
  .skill-bar-bg { height: 4px; background: var(--surface-3); border-radius: 4px; overflow: hidden; }
  .skill-bar-fill {
    height: 100%; border-radius: 4px;
    transition: width 1.2s cubic-bezier(0.4,0,0.2,1);
  }
  .skill-bar-fill.verified { background: var(--cyan); box-shadow: 0 0 8px rgba(0,200,255,0.5); }
  .skill-bar-fill.pending { background: var(--surface-3); }

  /* ── SYSTEM LOG ── */
  .log-section { margin-bottom: 32px; }
  .log-box {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; overflow: hidden;
  }
  .log-header {
    padding: 12px 18px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .log-title-row { display: flex; align-items: center; gap: 8px; }
  .log-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green); animation: logBlink 2s ease-in-out infinite; }
  @keyframes logBlink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
  .log-title { font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); }
  .log-badge { font-size: 9px; font-family: var(--font-mono); padding: 2px 8px; border-radius: 4px; background: var(--green-dim); color: var(--green); border: 1px solid rgba(0,229,160,0.2); }
  .log-body { padding: 14px 18px; max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; font-family: var(--font-mono); font-size: 11px; }
  .log-entry { display: flex; gap: 12px; color: var(--text-muted); }
  .log-ts { color: var(--text-dim); flex-shrink: 0; }
  .log-type-success { color: var(--green); }
  .log-type-info { color: var(--cyan); }
  .log-type-update { color: var(--gold); }
  .log-msg { color: var(--text); }
  .log-cursor { display: inline-block; width: 7px; height: 12px; background: var(--green); animation: blink 1s step-end infinite; vertical-align: middle; }
  @keyframes blink { 50%{opacity:0;} }

  /* ── RECRUITER PREVIEW OVERLAY ── */
  .recruiter-overlay {
    position: fixed; inset: 0; background: rgba(0,200,255,0.04);
    pointer-events: none; z-index: 50;
    opacity: 0; transition: opacity 0.4s;
    border: 2px solid transparent;
  }
  .recruiter-overlay.active { opacity: 1; border-color: rgba(0,200,255,0.2); }
  .recruiter-banner {
    position: fixed; top: 60px; left: 0; right: 0;
    background: rgba(0,200,255,0.1); border-bottom: 1px solid rgba(0,200,255,0.3);
    padding: 8px 32px; font-size: 11px; font-family: var(--font-mono);
    color: var(--cyan); z-index: 51; display: flex; align-items: center; gap: 10px;
    transform: translateY(-100%); transition: transform 0.4s;
  }
  .recruiter-banner.active { transform: translateY(0); }

  /* misc */
  .gap-20 { height: 20px; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
</style>
</head>
<body>

<!-- NAV -->
<nav>
  <div class="nav-logo"><svg width="28" height="28" viewBox="0 0 100 100" fill="none" style="flex-shrink:0"><defs><linearGradient id="orb-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#EC4899"/><stop offset="55%" stop-color="#F59E0B"/><stop offset="100%" stop-color="#F59E0B"/></linearGradient></defs><ellipse cx="50" cy="50" rx="42" ry="18" transform="rotate(-28 50 50)" stroke="url(#orb-g)" stroke-width="2" opacity="0.32"/><ellipse cx="50" cy="50" rx="42" ry="18" transform="rotate(28 50 50)" stroke="url(#orb-g)" stroke-width="2" opacity="0.32"/><circle cx="50" cy="50" r="11" fill="url(#orb-g)"/><circle cx="81.94" cy="26.03" r="4.5" fill="url(#orb-g)"/><circle cx="70.42" cy="75.19" r="4" fill="url(#orb-g)"/><circle cx="18.06" cy="73.97" r="3.5" fill="url(#orb-g)"/></svg>career<span style="background:linear-gradient(110deg,#EC4899 0%,#F59E0B 55%,#F59E0B 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent">ai</span>hub</div>
  <div class="nav-tabs">
    <button class="nav-tab"><span>Job Search</span><span style="font-size:9px;color:var(--text-dim)">Always free</span></button>
    <button class="nav-tab"><span class="dot"></span>Get Seen</button>
    <button class="nav-tab"><span class="dot"></span>Get Ready <span style="font-size:9px;background:var(--purple);color:#fff;padding:1px 5px;border-radius:3px;">Pro</span></button>
    <button class="nav-tab"><span class="dot-gold dot"></span>Get the Offer</button>
    <button class="nav-tab active"><span class="dot"></span>Get Paid</button>
  </div>
  <div class="nav-actions">
    <button class="btn-outline">Sign In</button>
    <button class="btn-primary">+ Join Free</button>
  </div>
</nav>

<!-- RECRUITER BANNER -->
<div class="recruiter-banner" id="recruiterBanner">
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5.5" stroke="currentColor"/><path d="M1 6c1-2.5 2.5-4 5-4s4 1.5 5 4c-1 2.5-2.5 4-5 4S2 8.5 1 6Z" stroke="currentColor"/><circle cx="6" cy="6" r="1.5" fill="currentColor"/></svg>
  RECRUITER VIEW MODE — GPA and sensitive fields are hidden. Only verified status is visible to employers.
</div>

<!-- LAYER STRIP -->
<div class="layer-strip">
  <div class="layer-chip done"><span class="lnum">01</span> Resume Creation <span style="font-size:9px;background:var(--green-dim);color:var(--green);padding:1px 6px;border-radius:3px;border:1px solid rgba(0,229,160,0.2)">Live</span></div>
  <div class="layer-chip done"><span class="lnum">02</span> Interview + Salary Prep <span style="font-size:9px;background:var(--green-dim);color:var(--green);padding:1px 6px;border-radius:3px;border:1px solid rgba(0,229,160,0.2)">Live</span></div>
  <div class="layer-chip active"><span class="lnum">03</span> Verified Credentials <span style="font-size:9px;background:var(--gold-dim);color:var(--gold);padding:1px 6px;border-radius:3px;border:1px solid rgba(245,200,66,0.3)">Building</span></div>
  <div class="layer-chip planned"><span class="lnum">04</span> AI Marketplace <span style="font-size:9px;color:var(--text-dim)">Planned</span></div>
</div>

<!-- MAIN -->
<div class="main">

  <!-- SIDEBAR -->
  <div class="sidebar">
    <div class="sidebar-label">Layer 03</div>
    <div class="sidebar-item active" onclick="setNav(this)">
      <svg width="14" height="14" fill="none" viewBox="0 0 14 14"><rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="1" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="8" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="8" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.3"/></svg>
      Credential Manager
    </div>
    <div class="sidebar-item" onclick="setNav(this)">
      <svg width="14" height="14" fill="none" viewBox="0 0 14 14"><polygon points="7,1 9,5 13,5.5 10,8.5 10.5,13 7,11 3.5,13 4,8.5 1,5.5 5,5" stroke="currentColor" stroke-width="1.3"/></svg>
      Skills Matrix
    </div>
    <div class="sidebar-item" onclick="setNav(this)">
      <svg width="14" height="14" fill="none" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      School Partners
    </div>
    <div class="sidebar-item" onclick="setNav(this)">
      <svg width="14" height="14" fill="none" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M7 4v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      Verification Logs
    </div>

    <div style="flex:1"></div>

    <!-- Trust Score Panel -->
    <div class="trust-panel">
      <div class="trust-ring-wrap">
        <svg class="trust-ring" viewBox="0 0 80 80">
          <circle class="trust-ring-bg" cx="40" cy="40" r="34"/>
          <circle class="trust-ring-fill" id="trustRingFill" cx="40" cy="40" r="34"/>
        </svg>
        <div class="trust-score-num">80</div>
      </div>
      <div class="trust-label">GLOBAL TRUST SCORE</div>
      <div class="trust-delta">▲ +15% this session</div>
    </div>
  </div>

  <!-- CONTENT -->
  <div class="content">

    <!-- Page Header -->
    <div class="page-header">
      <div class="page-title-block">
        <div class="page-eyebrow">Layer 03 — Verified Identity</div>
        <div class="page-title">Credential Manager</div>
        <div class="page-sub">Blockchain-anchored credentials with selective disclosure for Layer 04 matching</div>
      </div>
      <div class="page-actions">
        <div class="recruiter-toggle" id="recruiterToggle" onclick="toggleRecruiter()">
          <svg width="12" height="12" fill="none" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5.5" stroke="currentColor"/><path d="M1 6c1-2.5 2.5-4 5-4s4 1.5 5 4c-1 2.5-2.5 4-5 4S2 8.5 1 6Z" stroke="currentColor"/><circle cx="6" cy="6" r="1.5" fill="currentColor"/></svg>
          Recruiter Preview
          <div class="toggle-switch" id="recruiterSwitch"></div>
        </div>
        <button class="btn-primary" onclick="openModal()">+ Add Credential</button>
      </div>
    </div>

    <!-- Credential Manager -->
    <div class="section-label">Verified Credentials</div>
    <div class="cred-grid" id="credGrid">

      <!-- Card 1 -->
      <div class="cred-card verified">
        <div class="cred-card-top">
          <div class="cred-inst">
            <div class="inst-logo" style="color:#4f8ef7">NUS</div>
            <div class="inst-info">
              <div class="inst-name">National University of Singapore</div>
              <div class="degree-name">MSc Computer Science</div>
            </div>
          </div>
          <div class="verified-badge"><div class="vdot"></div>Verified</div>
        </div>
        <div class="cred-fields">
          <div class="cred-field">
            <span class="field-label">GPA</span>
            <span class="field-value">
              <span class="field-hidden recruiter-hide" id="gpa1">4.0 / 4.0</span>
              <button class="eye-btn" onclick="toggleField('gpa1', this)" title="Toggle visibility">
                <svg width="13" height="13" fill="none" viewBox="0 0 13 13"><path d="M1 6.5c1.5-3 2.5-4 5.5-4s4 1 5.5 4c-1.5 3-2.5 4-5.5 4s-4-1-5.5-4Z" stroke="currentColor" stroke-width="1.2"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" stroke-width="1.2"/></svg>
              </button>
            </span>
          </div>
          <div class="cred-field">
            <span class="field-label">Graduation Year</span>
            <span class="field-value">
              <span class="recruiter-hide" id="grad1">2024</span>
              <button class="eye-btn" onclick="toggleField('grad1', this)">
                <svg width="13" height="13" fill="none" viewBox="0 0 13 13"><path d="M1 6.5c1.5-3 2.5-4 5.5-4s4 1 5.5 4c-1.5 3-2.5 4-5.5 4s-4-1-5.5-4Z" stroke="currentColor" stroke-width="1.2"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" stroke-width="1.2"/></svg>
              </button>
            </span>
          </div>
          <div class="cred-field">
            <span class="field-label">Field</span>
            <span class="field-value">AI &amp; Systems</span>
          </div>
        </div>
        <div class="proof-drawer" id="proof1">
          <div class="proof-row">
            <div class="proof-key">Issuer DID</div>
            <div class="proof-val">did:web:nus.edu.sg</div>
          </div>
          <div class="proof-row">
            <div class="proof-key">Blockchain Hash</div>
            <div class="proof-val hash">0x7f2a...9e4b (ECDSA-SD-2023)</div>
          </div>
          <div class="proof-row">
            <div class="proof-key">Last Verified</div>
            <div class="proof-val">26 Apr 2026</div>
          </div>
        </div>
        <div class="cred-card-footer">
          <button class="proof-btn" onclick="toggleProof('proof1', this)">
            <svg width="10" height="10" fill="none" viewBox="0 0 10 10"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            View Proof
          </button>
          <span class="chain-hash">0x7f2a...9e4b</span>
        </div>
      </div>

      <!-- Card 2 -->
      <div class="cred-card verified">
        <div class="cred-card-top">
          <div class="cred-inst">
            <div class="inst-logo" style="color:#e84393">AWS</div>
            <div class="inst-info">
              <div class="inst-name">Amazon Web Services</div>
              <div class="degree-name">Solutions Architect Pro</div>
            </div>
          </div>
          <div class="verified-badge"><div class="vdot"></div>Verified</div>
        </div>
        <div class="cred-fields">
          <div class="cred-field">
            <span class="field-label">Score</span>
            <span class="field-value">
              <span class="field-hidden recruiter-hide" id="score2">879 / 1000</span>
              <button class="eye-btn" onclick="toggleField('score2', this)">
                <svg width="13" height="13" fill="none" viewBox="0 0 13 13"><path d="M1 6.5c1.5-3 2.5-4 5.5-4s4 1 5.5 4c-1.5 3-2.5 4-5.5 4s-4-1-5.5-4Z" stroke="currentColor" stroke-width="1.2"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" stroke-width="1.2"/></svg>
              </button>
            </span>
          </div>
          <div class="cred-field">
            <span class="field-label">Issued</span>
            <span class="field-value">
              <span class="recruiter-hide" id="issued2">March 2025</span>
              <button class="eye-btn" onclick="toggleField('issued2', this)">
                <svg width="13" height="13" fill="none" viewBox="0 0 13 13"><path d="M1 6.5c1.5-3 2.5-4 5.5-4s4 1 5.5 4c-1.5 3-2.5 4-5.5 4s-4-1-5.5-4Z" stroke="currentColor" stroke-width="1.2"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" stroke-width="1.2"/></svg>
              </button>
            </span>
          </div>
          <div class="cred-field">
            <span class="field-label">Expiry</span>
            <span class="field-value">March 2028</span>
          </div>
        </div>
        <div class="proof-drawer" id="proof2">
          <div class="proof-row">
            <div class="proof-key">Issuer DID</div>
            <div class="proof-val">did:web:aws.amazon.com</div>
          </div>
          <div class="proof-row">
            <div class="proof-key">Blockchain Hash</div>
            <div class="proof-val hash">0x3c8d...1f72 (ECDSA-SD-2023)</div>
          </div>
          <div class="proof-row">
            <div class="proof-key">Last Verified</div>
            <div class="proof-val">22 Apr 2026</div>
          </div>
        </div>
        <div class="cred-card-footer">
          <button class="proof-btn" onclick="toggleProof('proof2', this)">
            <svg width="10" height="10" fill="none" viewBox="0 0 10 10"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            View Proof
          </button>
          <span class="chain-hash">0x3c8d...1f72</span>
        </div>
      </div>

      <!-- Card 3 — pending -->
      <div class="cred-card">
        <div class="cred-card-top">
          <div class="cred-inst">
            <div class="inst-logo" style="color:var(--text-dim)">MIT</div>
            <div class="inst-info">
              <div class="inst-name">MIT OpenCourseWare</div>
              <div class="degree-name">Machine Learning 6.867</div>
            </div>
          </div>
          <div style="padding:5px 10px;border-radius:20px;background:var(--gold-dim);border:1px solid rgba(245,200,66,0.3);font-size:10px;font-family:var(--font-mono);color:var(--gold)">Pending</div>
        </div>
        <div class="cred-fields">
          <div class="cred-field">
            <span class="field-label">Score</span>
            <span class="field-value" style="color:var(--text-dim)">Awaiting issuer…</span>
          </div>
          <div class="cred-field">
            <span class="field-label">Status</span>
            <span class="field-value" style="color:var(--gold)">
              <span class="step-spinner" style="border-color:var(--gold);border-top-color:transparent"></span>
              DID Handshake
            </span>
          </div>
        </div>
        <div class="cred-card-footer">
          <span class="chain-hash">Verification in progress…</span>
          <span style="font-size:9px;color:var(--text-dim);font-family:var(--font-mono)">~2 min</span>
        </div>
      </div>

      <!-- Add new -->
      <div class="cred-card-add" onclick="openModal()">
        <div class="add-icon">+</div>
        <div class="add-label">add credential</div>
        <div style="font-size:10px;color:var(--text-dim);font-family:var(--font-mono)">W3C Verifiable Credential</div>
      </div>

    </div>

    <!-- Skills Matrix -->
    <div class="skills-section">
      <div class="section-label">Skills Matrix</div>
      <div class="skills-row">
        <!-- Radar -->
        <div class="skills-chart-box">
          <div class="box-title">Competency Radar</div>
          <div class="box-sub">Nodes turn cyan when skill test is cryptographically verified</div>
          <div class="radar-wrap">
            <svg class="radar" width="220" height="200" viewBox="-110 -100 220 200">
              <!-- grid rings -->
              <polygon points="0,-70 60.6,-35 60.6,35 0,70 -60.6,35 -60.6,-35" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
              <polygon points="0,-49 42.4,-24.5 42.4,24.5 0,49 -42.4,24.5 -42.4,-24.5" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
              <polygon points="0,-28 24.2,-14 24.2,14 0,28 -24.2,14 -24.2,-14" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
              <!-- axes -->
              <line x1="0" y1="0" x2="0" y2="-70" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
              <line x1="0" y1="0" x2="60.6" y2="-35" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
              <line x1="0" y1="0" x2="60.6" y2="35" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
              <line x1="0" y1="0" x2="0" y2="70" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
              <line x1="0" y1="0" x2="-60.6" y2="35" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
              <line x1="0" y1="0" x2="-60.6" y2="-35" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
              <!-- data fill -->
              <polygon points="0,-62 51,-30 48,30 0,55 -42,28 -40,-32"
                fill="rgba(0,200,255,0.12)" stroke="var(--cyan)" stroke-width="1.5"
                style="filter:drop-shadow(0 0 6px rgba(0,200,255,0.4))"/>
              <!-- dots -->
              <circle cx="0" cy="-62" r="4" fill="var(--cyan)" style="filter:drop-shadow(0 0 5px var(--cyan))"/>
              <circle cx="51" cy="-30" r="4" fill="var(--cyan)" style="filter:drop-shadow(0 0 5px var(--cyan))"/>
              <circle cx="48" cy="30" r="4" fill="var(--cyan)" style="filter:drop-shadow(0 0 5px var(--cyan))"/>
              <circle cx="0" cy="55" r="4" fill="var(--cyan)" style="filter:drop-shadow(0 0 5px var(--cyan))"/>
              <circle cx="-42" cy="28" r="4" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
              <circle cx="-40" cy="-32" r="4" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
              <!-- labels -->
              <text x="0" y="-78" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8" font-family="JetBrains Mono">ML/AI</text>
              <text x="68" y="-38" text-anchor="start" fill="rgba(255,255,255,0.5)" font-size="8" font-family="JetBrains Mono">Cloud</text>
              <text x="68" y="42" text-anchor="start" fill="rgba(255,255,255,0.5)" font-size="8" font-family="JetBrains Mono">Systems</text>
              <text x="0" y="82" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8" font-family="JetBrains Mono">Data</text>
              <text x="-68" y="42" text-anchor="end" fill="rgba(255,255,255,0.3)" font-size="8" font-family="JetBrains Mono">Security</text>
              <text x="-68" y="-38" text-anchor="end" fill="rgba(255,255,255,0.3)" font-size="8" font-family="JetBrains Mono">Networks</text>
            </svg>
          </div>
        </div>

        <!-- Skills List -->
        <div class="skills-chart-box">
          <div class="box-title">Verified Skills</div>
          <div class="box-sub">Linked to on-chain credential. Recruiter-searchable.</div>
          <div class="skills-list">
            <div class="skill-row">
              <div class="skill-row-top">
                <span class="skill-name">Machine Learning / AI</span>
                <span class="skill-stat verified">✓ Verified</span>
              </div>
              <div class="skill-bar-bg"><div class="skill-bar-fill verified" style="width:89%"></div></div>
            </div>
            <div class="skill-row">
              <div class="skill-row-top">
                <span class="skill-name">AWS Cloud Architecture</span>
                <span class="skill-stat verified">✓ Verified</span>
              </div>
              <div class="skill-bar-bg"><div class="skill-bar-fill verified" style="width:82%"></div></div>
            </div>
            <div class="skill-row">
              <div class="skill-row-top">
                <span class="skill-name">Distributed Systems</span>
                <span class="skill-stat verified">✓ Verified</span>
              </div>
              <div class="skill-bar-bg"><div class="skill-bar-fill verified" style="width:76%"></div></div>
            </div>
            <div class="skill-row">
              <div class="skill-row-top">
                <span class="skill-name">Data Engineering</span>
                <span class="skill-stat verified">✓ Verified</span>
              </div>
              <div class="skill-bar-bg"><div class="skill-bar-fill verified" style="width:70%"></div></div>
            </div>
            <div class="skill-row">
              <div class="skill-row-top">
                <span class="skill-name">Network Security</span>
                <span class="skill-stat pending">○ Not tested</span>
              </div>
              <div class="skill-bar-bg"><div class="skill-bar-fill pending" style="width:0%"></div></div>
            </div>
            <div class="skill-row">
              <div class="skill-row-top">
                <span class="skill-name">Cryptography</span>
                <span class="skill-stat pending">○ Not tested</span>
              </div>
              <div class="skill-bar-bg"><div class="skill-bar-fill pending" style="width:0%"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- System Log -->
    <div class="log-section">
      <div class="section-label">AI Memory — System Log</div>
      <div class="log-box">
        <div class="log-header">
          <div class="log-title-row">
            <div class="log-live-dot"></div>
            <span class="log-title">CORE MEMORY STREAM — Writing to Layer 04 Match Engine</span>
          </div>
          <div class="log-badge">LIVE</div>
        </div>
        <div class="log-body" id="logBody">
          <div class="log-entry"><span class="log-ts">[2026-04-26 13:50]</span><span class="log-type-success">SUCCESS</span><span class="log-msg">MSc Computer Science hash written to Core.</span></div>
          <div class="log-entry"><span class="log-ts">[2026-04-26 13:51]</span><span class="log-type-update">UPDATED</span><span class="log-msg">Match Engine weighting increased (+18% Trust).</span></div>
          <div class="log-entry"><span class="log-ts">[2026-04-26 13:52]</span><span class="log-type-info">INDEX</span><span class="log-msg">GPA confirmed. Institution verified: NUS.</span></div>
          <div class="log-entry"><span class="log-ts">[2026-04-26 13:54]</span><span class="log-type-success">SUCCESS</span><span class="log-msg">AWS Solutions Architect Pro anchored. Chain: 0x3c8d.</span></div>
          <div class="log-entry"><span class="log-ts">[2026-04-26 13:55]</span><span class="log-type-update">UPDATED</span><span class="log-msg">Skills vector refreshed — 4 nodes verified, 2 pending.</span></div>
          <div class="log-entry"><span class="log-ts">[2026-04-26 13:56]</span><span class="log-type-info">PENDING</span><span class="log-msg">MIT 6.867 credential — DID handshake in progress…</span></div>
          <div class="log-entry" id="liveLogEntry"><span class="log-ts">[2026-04-26 13:57]</span><span class="log-type-update">WRITING</span><span class="log-msg">Trust Score updated: 80 (+15%). <span class="log-cursor"></span></span></div>
        </div>
      </div>
    </div>

  </div><!-- /content -->
</div><!-- /main -->

<!-- RECRUITER OVERLAY -->
<div class="recruiter-overlay" id="recruiterOverlay"></div>

<!-- VERIFICATION MODAL -->
<div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <div class="modal-title">Add Credential</div>
    <div class="modal-sub">Initiating W3C Verifiable Credential presentation request…</div>
    <div class="ver-steps" id="verSteps">
      <div class="ver-step active" id="step1">
        <div class="step-icon">🔗</div>
        <div class="step-info">
          <div class="step-title">Requesting Presentation <span class="step-spinner" id="spin1"></span></div>
          <div class="step-detail">Connecting to Institution DID:web endpoint…</div>
        </div>
      </div>
      <div class="ver-step" id="step2">
        <div class="step-icon">🔐</div>
        <div class="step-info">
          <div class="step-title">Cryptographic Handshake</div>
          <div class="step-detail">ECDSA-SD-2023 signature verification</div>
        </div>
      </div>
      <div class="ver-step" id="step3">
        <div class="step-icon">⛓</div>
        <div class="step-info">
          <div class="step-title">Writing to Core</div>
          <div class="step-detail">Anchoring hash to blockchain registry</div>
        </div>
      </div>
      <div class="ver-step" id="step4">
        <div class="step-icon">✓</div>
        <div class="step-info">
          <div class="step-title">Badge Issued</div>
          <div class="step-detail">Green Verified Badge active on profile</div>
        </div>
      </div>
    </div>
    <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:10px">
      <button class="btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="modalStartBtn" onclick="runVerificationFlow()">Begin Verification</button>
    </div>
  </div>
</div>

<script>
  // Sidebar nav
  function setNav(el) {
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
  }

  // Toggle field blur
  function toggleField(id, btn) {
    const el = document.getElementById(id);
    el.classList.toggle('field-hidden');
  }

  // Toggle proof drawer
  function toggleProof(id, btn) {
    const drawer = document.getElementById(id);
    const isOpen = drawer.classList.contains('open');
    document.querySelectorAll('.proof-drawer').forEach(d => d.classList.remove('open'));
    if (!isOpen) drawer.classList.add('open');
  }

  // Recruiter toggle
  let recruiterMode = false;
  function toggleRecruiter() {
    recruiterMode = !recruiterMode;
    document.getElementById('recruiterToggle').classList.toggle('active', recruiterMode);
    document.getElementById('recruiterOverlay').classList.toggle('active', recruiterMode);
    document.getElementById('recruiterBanner').classList.toggle('active', recruiterMode);
    document.querySelectorAll('.recruiter-hide').forEach(el => {
      if (recruiterMode) { el.dataset.orig = el.textContent; el.textContent = '●●●●●'; el.style.filter = 'none'; }
      else { el.textContent = el.dataset.orig || el.textContent; }
    });
  }

  // Modal
  function openModal() {
    document.getElementById('modalOverlay').classList.add('open');
    resetSteps();
  }
  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    resetSteps();
  }
  function resetSteps() {
    ['step1','step2','step3','step4'].forEach(id => {
      const s = document.getElementById(id);
      s.classList.remove('active','done');
    });
    document.getElementById('step1').classList.add('active');
    const sp = document.getElementById('spin1');
    if (sp) sp.style.display = '';
    document.getElementById('modalStartBtn').style.display = '';
  }

  function runVerificationFlow() {
    document.getElementById('modalStartBtn').style.display = 'none';
    const steps = ['step1','step2','step3','step4'];
    let i = 0;
    function nextStep() {
      if (i > 0) {
        document.getElementById(steps[i-1]).classList.remove('active');
        document.getElementById(steps[i-1]).classList.add('done');
        document.getElementById(steps[i-1]).querySelector('.step-icon').textContent = '✓';
      }
      if (i < steps.length) {
        document.getElementById(steps[i]).classList.add('active');
        i++;
        setTimeout(nextStep, i === 4 ? 1800 : 1400);
      } else {
        setTimeout(() => {
          closeModal();
          addLogEntry('SUCCESS','New credential anchored. Trust Score +5%.');
        }, 800);
      }
    }
    nextStep();
  }

  // Live log
  const logMessages = [
    ['info','Scheduler: next re-verification cycle in 30 days.'],
    ['update','Match Engine: candidate pool index refreshed.'],
    ['success','Recruiter match probability increased: +8%.'],
    ['info','SD-JWT selective disclosure policy applied to GPA field.'],
    ['update','Layer 04 AI Marketplace: profile queued for review.'],
  ];
  let logIdx = 0;
  function addLogEntry(type, msg) {
    const body = document.getElementById('logBody');
    const now = new Date();
    const ts = \`[\${now.getFullYear()}-\${String(now.getMonth()+1).padStart(2,'0')}-\${String(now.getDate()).padStart(2,'0')} \${String(now.getHours()).padStart(2,'0')}:\${String(now.getMinutes()).padStart(2,'0')}]\`;
    const typeMap = { success:'log-type-success', info:'log-type-info', update:'log-type-update' };
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = \`<span class="log-ts">\${ts}</span><span class="\${typeMap[type]||'log-type-info'}">\${type.toUpperCase()}</span><span class="log-msg">\${msg}</span>\`;
    body.insertBefore(entry, document.getElementById('liveLogEntry'));
    body.scrollTop = body.scrollHeight;
  }
  setInterval(() => {
    const [type, msg] = logMessages[logIdx % logMessages.length];
    addLogEntry(type, msg);
    logIdx++;
  }, 7000);

  // Animate trust ring on load
  window.addEventListener('load', () => {
    setTimeout(() => {
      document.getElementById('trustRingFill').style.strokeDashoffset = '44';
    }, 300);
  });
</script>
</body>
</html>
`;

export const l4HtmlHeight = 640;
export const l4Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CareerAiHub — Layer 04: AI Marketplace</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --bg:#09090d;--surface:#111218;--surface2:#161820;--surface3:#1c1f2c;
  --bdr:rgba(255,255,255,0.06);--bdr2:rgba(255,255,255,0.12);
  --text:#e8eaf0;--text2:#8b92a8;--text3:#3d4560;
  --green:#00e5a0;--gdim:rgba(0,229,160,0.1);--gb:rgba(0,229,160,0.25);
  --cyan:#00c8ff;--cdim:rgba(0,200,255,0.1);--cb:rgba(0,200,255,0.25);
  --purple:#F59E0B;--pdim:rgba(245,158,11,0.1);--pb:rgba(245,158,11,0.3);
  --gold:#f5c842;--gdold:rgba(245,200,66,0.1);
  --red:#ff5f6e;
  --mono:'JetBrains Mono',monospace;
  --disp:'Syne',sans-serif;
  --body:'DM Sans',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:var(--body);font-size:13px;line-height:1.6;height:100vh;display:flex;flex-direction:column;overflow:hidden;}

/* ── TOP BAR ── */
.topbar{height:48px;background:rgba(9,9,13,0.95);border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;padding:0 20px;flex-shrink:0;backdrop-filter:blur(12px);}
.topbar-left{display:flex;align-items:center;gap:12px;}
.logo{font-family:var(--disp);font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;}
.logo-icon{display:none}
.layer-badge{font-size:9px;font-family:var(--mono);padding:3px 10px;border-radius:20px;background:var(--pdim);color:var(--purple);border:1px solid var(--pb);display:flex;align-items:center;gap:5px;}
.layer-badge .dot{width:5px;height:5px;border-radius:50%;background:var(--purple);box-shadow:0 0 6px var(--purple);animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
.topbar-right{display:flex;align-items:center;gap:8px;}
.plan-chip{font-size:10px;font-family:var(--mono);padding:4px 12px;border-radius:6px;background:var(--surface2);border:1px solid var(--bdr2);color:var(--text2);}
.plan-chip span{color:var(--purple);}
.btn-sm{padding:5px 14px;border-radius:6px;font-size:11px;font-weight:600;border:none;cursor:pointer;font-family:var(--body);}
.btn-purple{background:var(--purple);color:#fff;}
.btn-outline{background:transparent;border:1px solid var(--bdr2);color:var(--text2);}

/* ── 3-COLUMN LAYOUT ── */
.workspace{display:grid;grid-template-columns:260px 1fr 240px;flex:1;overflow:hidden;}

/* ── LEFT: MATCH CRITERIA ── */
.panel-left{border-right:1px solid var(--bdr);display:flex;flex-direction:column;overflow:hidden;}
.panel-head{padding:14px 16px;border-bottom:1px solid var(--bdr);flex-shrink:0;}
.panel-title{font-family:var(--disp);font-size:12px;font-weight:700;margin-bottom:2px;}
.panel-sub{font-size:10px;color:var(--text2);font-family:var(--mono);}
.criteria-body{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px;}
.field-group{}
.field-label{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;}
.field-input{width:100%;padding:8px 11px;background:var(--surface2);border:1px solid var(--bdr);border-radius:8px;color:var(--text);font-size:12px;font-family:var(--body);outline:none;transition:border .2s;}
.field-input:focus{border-color:var(--cb);}
.field-input option{background:var(--surface2);}
.tag-row{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;}
.tag{padding:4px 10px;border-radius:20px;font-size:10px;font-family:var(--mono);cursor:pointer;transition:all .15s;}
.tag.skill{background:var(--cdim);color:var(--cyan);border:1px solid var(--cb);}
.tag.skill.off{background:var(--surface2);color:var(--text3);border-color:var(--bdr);}
.tag.add{background:transparent;color:var(--text3);border:1px dashed var(--bdr2);}
.salary-row{display:flex;gap:6px;}
.salary-row .field-input{width:50%;}
.match-btn{margin:4px 0 0;padding:10px;border-radius:8px;background:linear-gradient(135deg,var(--purple),var(--cyan));color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer;font-family:var(--disp);width:100%;transition:all .2s;box-shadow:0 0 20px rgba(245,158,11,0.25);}
.match-btn:hover{box-shadow:0 0 30px rgba(245,158,11,0.45);transform:translateY(-1px);}

/* criteria summary */
.criteria-summary{padding:10px 16px;border-top:1px solid var(--bdr);flex-shrink:0;}
.summary-row{display:flex;justify-content:space-between;font-size:10px;font-family:var(--mono);color:var(--text2);margin-bottom:4px;}
.summary-val{color:var(--cyan);}

/* ── CENTER: CANDIDATE PIPELINE ── */
.panel-center{display:flex;flex-direction:column;overflow:hidden;}
.center-head{padding:14px 18px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.match-count{font-family:var(--mono);font-size:11px;color:var(--text2);}
.match-count span{color:var(--cyan);font-weight:600;}
.sort-chips{display:flex;gap:4px;}
.sort-chip{padding:3px 10px;border-radius:20px;font-size:10px;font-family:var(--mono);border:1px solid var(--bdr);background:transparent;color:var(--text3);cursor:pointer;}
.sort-chip.active{background:var(--cdim);color:var(--cyan);border-color:var(--cb);}

/* pipeline split */
.pipeline-area{display:flex;flex-direction:column;flex:1;overflow:hidden;}
.candidate-list{flex:1;overflow-y:auto;padding:12px 18px;display:flex;flex-direction:column;gap:10px;}

/* candidate card */
.cand-card{background:var(--surface);border:1px solid var(--bdr);border-radius:12px;padding:14px;cursor:pointer;transition:all .2s;position:relative;}
.cand-card:hover{border-color:var(--bdr2);transform:translateY(-1px);}
.cand-card.active{border-color:var(--cb);background:var(--cdim);box-shadow:0 0 20px rgba(0,200,255,0.08);}
.cand-top{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;}
.cand-avatar{width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:var(--disp);font-size:13px;font-weight:800;position:relative;}
.vbadge{position:absolute;bottom:-2px;right:-2px;width:14px;height:14px;border-radius:50%;background:var(--green);border:2px solid var(--bg);display:flex;align-items:center;justify-content:center;font-size:7px;box-shadow:0 0 8px var(--green);}
.cand-info{flex:1;min-width:0;}
.cand-name{font-family:var(--disp);font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cand-role{font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.match-score{font-family:var(--mono);font-size:18px;font-weight:700;color:var(--cyan);flex-shrink:0;text-align:right;line-height:1;}
.match-score-label{font-size:8px;color:var(--text3);text-align:right;font-family:var(--mono);}
.cand-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;}
.ctag{padding:2px 8px;border-radius:4px;font-size:9px;font-family:var(--mono);}
.ctag-green{background:var(--gdim);color:var(--green);border:1px solid var(--gb);}
.ctag-cyan{background:var(--cdim);color:var(--cyan);border:1px solid var(--cb);}
.ctag-purple{background:var(--pdim);color:var(--purple);border:1px solid var(--pb);}
.ctag-gold{background:var(--gdold);color:var(--gold);border:1px solid rgba(245,200,66,0.3);}
.cand-layers{display:flex;gap:6px;align-items:center;}
.layer-icon{font-size:11px;padding:2px 7px;border-radius:4px;background:var(--surface2);border:1px solid var(--bdr);font-family:var(--mono);font-size:9px;color:var(--text3);}
.chat-btn{margin-left:auto;padding:5px 12px;border-radius:6px;background:var(--purple);color:#fff;font-size:10px;font-weight:700;border:none;cursor:pointer;font-family:var(--body);transition:all .15s;}
.chat-btn:hover{background:#c840ff;}

/* TrustChat panel */
.trust-chat{display:none;flex-direction:column;border-top:1px solid var(--bdr);flex-shrink:0;max-height:300px;}
.trust-chat.open{display:flex;}
.chat-head{padding:10px 18px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;background:var(--pdim);flex-shrink:0;}
.chat-title{font-size:11px;font-family:var(--mono);color:var(--purple);display:flex;align-items:center;gap:6px;}
.chat-close{background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;}
.chat-body-row{display:flex;flex:1;overflow:hidden;}
.chat-messages{flex:1;padding:10px 16px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;}
.msg{max-width:80%;}
.msg-r{background:var(--pdim);border:1px solid var(--pb);border-radius:10px 10px 2px 10px;padding:8px 12px;font-size:11px;margin-left:auto;}
.msg-l{background:var(--surface2);border:1px solid var(--bdr);border-radius:10px 10px 10px 2px;padding:8px 12px;font-size:11px;}
.msg-label{font-size:9px;font-family:var(--mono);color:var(--text3);margin-bottom:3px;}
.msg-r .msg-label{text-align:right;color:var(--purple);}
.msg-l .msg-label{color:var(--cyan);}
.chat-context-bar{font-size:9px;font-family:var(--mono);color:var(--text3);padding:6px 16px;border-bottom:1px solid var(--bdr);background:var(--surface2);flex-shrink:0;}
.chat-context-bar span{color:var(--green);}
.chat-sidebar{width:160px;border-left:1px solid var(--bdr);padding:10px 12px;overflow-y:auto;flex-shrink:0;}
.cs-title{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;}
.cs-item{padding:6px 8px;border-radius:6px;background:var(--surface2);border:1px solid var(--bdr);margin-bottom:5px;}
.cs-item-title{font-size:10px;font-weight:600;margin-bottom:1px;}
.cs-item-sub{font-size:9px;color:var(--text2);font-family:var(--mono);}
.cs-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;background:var(--gdim);color:var(--green);border:1px solid var(--gb);font-size:9px;font-family:var(--mono);margin-top:3px;}
.cs-badge-dot{width:4px;height:4px;border-radius:50%;background:var(--green);box-shadow:0 0 4px var(--green);}
.hidden-field{filter:blur(4px);font-size:9px;color:var(--text3);}

/* ── RIGHT: INSIGHTS ── */
.panel-right{border-left:1px solid var(--bdr);display:flex;flex-direction:column;overflow:hidden;}
.insights-body{flex:1;overflow-y:auto;padding:14px 14px;display:flex;flex-direction:column;gap:12px;}

/* donut chart */
.donut-wrap{display:flex;justify-content:center;margin-bottom:4px;}
svg.donut{overflow:visible;}
.donut-ring-bg{fill:none;stroke:var(--surface3);stroke-width:10;}
.donut-seg{fill:none;stroke-width:10;stroke-linecap:butt;}

/* stat cards */
.stat-card{background:var(--surface2);border:1px solid var(--bdr);border-radius:8px;padding:10px 12px;}
.stat-card-label{font-size:9px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;}
.stat-card-val{font-family:var(--disp);font-size:20px;font-weight:700;}
.stat-card-delta{font-size:9px;font-family:var(--mono);margin-top:2px;}
.delta-up{color:var(--green);}
.delta-down{color:var(--red);}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}

/* b2b panel */
.b2b-card{background:var(--pdim);border:1px solid var(--pb);border-radius:8px;padding:10px 12px;}
.b2b-title{font-size:10px;font-family:var(--disp);font-weight:700;color:var(--purple);margin-bottom:6px;}
.b2b-row{display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px;}
.b2b-key{color:var(--text2);}
.b2b-val{font-family:var(--mono);color:var(--text);}

/* ── BOTTOM LOG ── */
.log-bar{height:90px;border-top:1px solid var(--bdr);flex-shrink:0;display:flex;flex-direction:column;}
.log-bar-head{padding:5px 16px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px;flex-shrink:0;}
.log-live{width:5px;height:5px;border-radius:50%;background:var(--purple);box-shadow:0 0 6px var(--purple);animation:pulse 1.5s infinite;}
.log-title-txt{font-size:9px;font-family:var(--mono);color:var(--text3);}
.log-entries{flex:1;overflow-y:auto;padding:6px 16px;display:flex;flex-direction:column;gap:3px;}
.log-row{display:flex;gap:10px;font-size:10px;font-family:var(--mono);}
.log-ts{color:var(--text3);flex-shrink:0;}
.log-type-match{color:var(--cyan);}
.log-type-chat{color:var(--purple);}
.log-type-update{color:var(--gold);}
.log-type-success{color:var(--green);}
.log-msg-txt{color:var(--text2);}
.log-cursor{display:inline-block;width:6px;height:10px;background:var(--purple);animation:blink 1s step-end infinite;vertical-align:middle;}
@keyframes blink{50%{opacity:0;}}

::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:3px;}
</style>
</head>
<body>

<!-- TOP BAR -->
<div class="topbar">
  <div class="topbar-left">
    <div class="logo">
<svg width="28" height="28" viewBox="0 0 100 100" fill="none" style="flex-shrink:0"><defs><linearGradient id="orb-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#EC4899"/><stop offset="55%" stop-color="#F59E0B"/><stop offset="100%" stop-color="#F59E0B"/></linearGradient></defs><ellipse cx="50" cy="50" rx="42" ry="18" transform="rotate(-28 50 50)" stroke="url(#orb-g)" stroke-width="2" opacity="0.32"/><ellipse cx="50" cy="50" rx="42" ry="18" transform="rotate(28 50 50)" stroke="url(#orb-g)" stroke-width="2" opacity="0.32"/><circle cx="50" cy="50" r="11" fill="url(#orb-g)"/><circle cx="81.94" cy="26.03" r="4.5" fill="url(#orb-g)"/><circle cx="70.42" cy="75.19" r="4" fill="url(#orb-g)"/><circle cx="18.06" cy="73.97" r="3.5" fill="url(#orb-g)"/></svg>career<span style="background:linear-gradient(110deg,#EC4899 0%,#F59E0B 55%,#F59E0B 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent">ai</span>hub
    </div>
    <div class="layer-badge"><div class="dot"></div>LAYER 04 — AI MARKETPLACE</div>
  </div>
  <div class="topbar-right">
    <div class="plan-chip">Recruiter Pro — <span>SGD 299/mo</span></div>
    <button class="btn-sm btn-outline">Dashboard</button>
    <button class="btn-sm btn-purple">+ Post Role</button>
  </div>
</div>

<!-- WORKSPACE -->
<div class="workspace">

  <!-- LEFT: MATCH CRITERIA -->
  <div class="panel-left">
    <div class="panel-head">
      <div class="panel-title">Set Match Criteria</div>
      <div class="panel-sub">AI Match Engine · Layer 04</div>
    </div>
    <div class="criteria-body">
      <div class="field-group">
        <div class="field-label">Target Role</div>
        <select class="field-input" id="roleSelect" onchange="runMatch()">
          <option>Senior AI Engineer</option>
          <option>ML Research Scientist</option>
          <option>Cloud Architect</option>
          <option>Data Engineering Lead</option>
        </select>
      </div>
      <div class="field-group">
        <div class="field-label">Experience Level</div>
        <select class="field-input" onchange="runMatch()">
          <option>Mid (3–5 yrs)</option>
          <option>Senior (5–8 yrs)</option>
          <option>Lead (8+ yrs)</option>
        </select>
      </div>
      <div class="field-group">
        <div class="field-label">Verified Skills Required <span style="color:var(--cyan);font-size:8px">· Layer 03 ledger</span></div>
        <div class="tag-row" id="skillTags">
          <div class="tag skill" onclick="toggleSkill(this)">Python</div>
          <div class="tag skill" onclick="toggleSkill(this)">AWS</div>
          <div class="tag skill" onclick="toggleSkill(this)">ML/AI</div>
          <div class="tag skill off" onclick="toggleSkill(this)">Docker</div>
          <div class="tag skill off" onclick="toggleSkill(this)">Kubernetes</div>
          <div class="tag skill off" onclick="toggleSkill(this)">TensorFlow</div>
          <div class="tag add">+ Add</div>
        </div>
      </div>
      <div class="field-group">
        <div class="field-label">Salary Range (SGD/mo) <span style="color:var(--gold);font-size:8px">· Layer 02</span></div>
        <div class="salary-row">
          <input class="field-input" type="text" value="8,000" onchange="runMatch()"/>
          <input class="field-input" type="text" value="18,000" onchange="runMatch()"/>
        </div>
      </div>
      <div class="field-group">
        <div class="field-label">Credential Requirement</div>
        <select class="field-input" onchange="runMatch()">
          <option>Degree Verified (any)</option>
          <option>Master's or above</option>
          <option>PhD required</option>
          <option>Cert acceptable</option>
        </select>
      </div>
      <div class="field-group">
        <div class="field-label">Interview Readiness Score <span style="color:var(--gold);font-size:8px">· Layer 02</span></div>
        <select class="field-input" onchange="runMatch()">
          <option>≥ 70 / 100</option>
          <option>≥ 80 / 100</option>
          <option>≥ 90 / 100</option>
          <option>Any</option>
        </select>
      </div>
      <button class="match-btn" onclick="runMatch()">⚡ Run AI Match</button>
    </div>
    <div class="criteria-summary">
      <div class="summary-row"><span>Candidates scanned</span><span class="summary-val" id="scanned">2,847</span></div>
      <div class="summary-row"><span>Verified profiles</span><span class="summary-val" id="verified-ct">1,203</span></div>
      <div class="summary-row"><span>Top matches</span><span class="summary-val" id="match-ct">4</span></div>
    </div>
  </div>

  <!-- CENTER: PIPELINE + CHAT -->
  <div class="panel-center">
    <div class="center-head">
      <div class="match-count">Showing <span id="matchLabel">4</span> top verified matches</div>
      <div class="sort-chips">
        <div class="sort-chip active">Match Score</div>
        <div class="sort-chip">Trust Level</div>
        <div class="sort-chip">Availability</div>
      </div>
    </div>
    <div class="pipeline-area">
      <div class="candidate-list" id="candList">
        <!-- Candidate 1 -->
        <div class="cand-card active" onclick="selectCand(this,0)">
          <div class="cand-top">
            <div class="cand-avatar" style="background:linear-gradient(135deg,#00c8ff22,#00c8ff44);color:var(--cyan)">
              IV
              <div class="vbadge">✓</div>
            </div>
            <div class="cand-info">
              <div class="cand-name">Ivy Nguyen</div>
              <div class="cand-role">NUS MSc AI · 5 yrs exp</div>
            </div>
            <div>
              <div class="match-score">95%</div>
              <div class="match-score-label">MATCH</div>
            </div>
          </div>
          <div class="cand-tags">
            <div class="ctag ctag-green">✓ Degree Verified</div>
            <div class="ctag ctag-cyan">Python</div>
            <div class="ctag ctag-cyan">AWS</div>
            <div class="ctag ctag-cyan">ML/AI</div>
            <div class="ctag ctag-purple">Score 88/100</div>
          </div>
          <div class="cand-layers">
            <div class="layer-icon">📄 L01</div>
            <div class="layer-icon">🎧 L02</div>
            <div class="layer-icon">🔒 L03</div>
            <button class="chat-btn" onclick="event.stopPropagation();openChat(0)">TrustChat →</button>
          </div>
        </div>
        <!-- Candidate 2 -->
        <div class="cand-card" onclick="selectCand(this,1)">
          <div class="cand-top">
            <div class="cand-avatar" style="background:linear-gradient(135deg,#F59E0B22,#F59E0B44);color:var(--purple)">
              BT
              <div class="vbadge">✓</div>
            </div>
            <div class="cand-info">
              <div class="cand-name">Ben Tan</div>
              <div class="cand-role">NTU MSc CS · 6 yrs exp</div>
            </div>
            <div>
              <div class="match-score">91%</div>
              <div class="match-score-label">MATCH</div>
            </div>
          </div>
          <div class="cand-tags">
            <div class="ctag ctag-green">✓ Degree Verified</div>
            <div class="ctag ctag-cyan">Python</div>
            <div class="ctag ctag-cyan">ML/AI</div>
            <div class="ctag ctag-gold">TensorFlow</div>
          </div>
          <div class="cand-layers">
            <div class="layer-icon">📄 L01</div>
            <div class="layer-icon">🎧 L02</div>
            <div class="layer-icon">🔒 L03</div>
            <button class="chat-btn" onclick="event.stopPropagation();openChat(1)">TrustChat →</button>
          </div>
        </div>
        <!-- Candidate 3 -->
        <div class="cand-card" onclick="selectCand(this,2)">
          <div class="cand-top">
            <div class="cand-avatar" style="background:linear-gradient(135deg,#00e5a022,#00e5a044);color:var(--green)">
              SL
              <div class="vbadge">✓</div>
            </div>
            <div class="cand-info">
              <div class="cand-name">Sarah Lim</div>
              <div class="cand-role">SMU BSc CS · AWS Certified</div>
            </div>
            <div>
              <div class="match-score">87%</div>
              <div class="match-score-label">MATCH</div>
            </div>
          </div>
          <div class="cand-tags">
            <div class="ctag ctag-green">✓ Cert Verified</div>
            <div class="ctag ctag-cyan">AWS</div>
            <div class="ctag ctag-cyan">Python</div>
            <div class="ctag ctag-purple">Score 82/100</div>
          </div>
          <div class="cand-layers">
            <div class="layer-icon">📄 L01</div>
            <div class="layer-icon">🎧 L02</div>
            <div class="layer-icon">🔒 L03</div>
            <button class="chat-btn" onclick="event.stopPropagation();openChat(2)">TrustChat →</button>
          </div>
        </div>
        <!-- Candidate 4 -->
        <div class="cand-card" onclick="selectCand(this,3)">
          <div class="cand-top">
            <div class="cand-avatar" style="background:linear-gradient(135deg,#f5c84222,#f5c84244);color:var(--gold)">
              RK
              <div class="vbadge">✓</div>
            </div>
            <div class="cand-info">
              <div class="cand-name">Raj Kumar</div>
              <div class="cand-role">IIT Delhi MTech · 7 yrs</div>
            </div>
            <div>
              <div class="match-score">84%</div>
              <div class="match-score-label">MATCH</div>
            </div>
          </div>
          <div class="cand-tags">
            <div class="ctag ctag-green">✓ Degree Verified</div>
            <div class="ctag ctag-cyan">Python</div>
            <div class="ctag ctag-cyan">ML/AI</div>
            <div class="ctag ctag-gold">Docker</div>
          </div>
          <div class="cand-layers">
            <div class="layer-icon">📄 L01</div>
            <div class="layer-icon">🎧 L02</div>
            <div class="layer-icon">🔒 L03</div>
            <button class="chat-btn" onclick="event.stopPropagation();openChat(3)">TrustChat →</button>
          </div>
        </div>
      </div>

      <!-- TRUSTCHAT -->
      <div class="trust-chat" id="trustChat">
        <div class="chat-head">
          <div class="chat-title">
            <span style="width:6px;height:6px;border-radius:50%;background:var(--purple);box-shadow:0 0 6px var(--purple);display:inline-block"></span>
            TrustChat — <span id="chatName">Ivy Nguyen</span>
          </div>
          <button class="chat-close" onclick="closeChat()">✕</button>
        </div>
        <div class="chat-context-bar">
          Chat started. Candidate resume and <span>verified credentials</span> are visible in sidebar.
        </div>
        <div class="chat-body-row">
          <div class="chat-messages" id="chatMessages">
            <div class="msg msg-r"><div class="msg-label">Recruiter</div>Hi <span id="chatNameMsg">Ivy</span>, I reviewed your verified profile — impressive NUS credentials. Are you open to a Senior AI Engineer role at SGD 14k/mo?</div>
            <div class="msg msg-l"><div class="msg-label" id="chatCandLabel">Ivy Nguyen</div>Thank you! Yes, I'm actively looking. My experience in distributed ML systems aligns well. Happy to discuss further.</div>
            <div class="msg msg-r"><div class="msg-label">Recruiter</div>Your interview readiness score of 88/100 is impressive. Can we schedule a technical deep-dive next week?</div>
          </div>
          <div class="chat-sidebar">
            <div class="cs-title">Verified Proof</div>
            <div class="cs-item">
              <div class="cs-item-title" id="cs-degree">NUS Master's</div>
              <div class="cs-item-sub" id="cs-field">Computer Science · AI</div>
              <div class="cs-badge"><div class="cs-badge-dot"></div>Verified</div>
            </div>
            <div class="cs-item">
              <div class="cs-item-title">ATS Score</div>
              <div class="cs-item-sub" id="cs-ats">92 / 100 · L01</div>
            </div>
            <div class="cs-item">
              <div class="cs-item-title">Interview</div>
              <div class="cs-item-sub" id="cs-interview">88/100 · L02</div>
            </div>
            <div class="cs-item">
              <div class="cs-item-title">GPA</div>
              <div class="cs-item-sub hidden-field">4.0 / 4.0</div>
              <div style="font-size:8px;color:var(--text3);font-family:var(--mono);margin-top:2px">🔒 Hidden by candidate</div>
            </div>
            <div class="cs-item">
              <div class="cs-item-title">Trust Score</div>
              <div class="cs-item-sub" id="cs-trust" style="color:var(--cyan);font-family:var(--mono)">95 / 100</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- RIGHT: INSIGHTS -->
  <div class="panel-right">
    <div class="panel-head">
      <div class="panel-title">Recruiter Insights</div>
      <div class="panel-sub">Pipeline analytics</div>
    </div>
    <div class="insights-body">

      <!-- Donut: Trust Distribution -->
      <div style="background:var(--surface2);border:1px solid var(--bdr);border-radius:8px;padding:10px 12px;">
        <div class="stat-card-label" style="margin-bottom:8px">Trust Score Distribution</div>
        <div class="donut-wrap">
          <svg class="donut" width="100" height="100" viewBox="0 0 100 100">
            <circle class="donut-ring-bg" cx="50" cy="50" r="36"/>
            <!-- segments: high trust (cyan) 60%, mid (gold) 27%, low (red) 13% -->
            <circle class="donut-seg" cx="50" cy="50" r="36"
              stroke="var(--cyan)" stroke-dasharray="135.7 90.5" stroke-dashoffset="0"
              transform="rotate(-90 50 50)" style="filter:drop-shadow(0 0 4px var(--cyan))"/>
            <circle class="donut-seg" cx="50" cy="50" r="36"
              stroke="var(--gold)" stroke-dasharray="61 165.2" stroke-dashoffset="-135.7"
              transform="rotate(-90 50 50)"/>
            <circle class="donut-seg" cx="50" cy="50" r="36"
              stroke="var(--red)" stroke-dasharray="29.3 196.9" stroke-dashoffset="-196.7"
              transform="rotate(-90 50 50)"/>
            <text x="50" y="46" text-anchor="middle" font-family="Syne" font-size="14" font-weight="700" fill="var(--text)">60%</text>
            <text x="50" y="57" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="var(--text2)">HIGH TRUST</text>
          </svg>
        </div>
        <div style="display:flex;justify-content:center;gap:12px;margin-top:4px">
          <div style="display:flex;align-items:center;gap:4px;font-size:9px;font-family:var(--mono);color:var(--text2)"><span style="width:6px;height:6px;border-radius:50%;background:var(--cyan);display:inline-block"></span>High 60%</div>
          <div style="display:flex;align-items:center;gap:4px;font-size:9px;font-family:var(--mono);color:var(--text2)"><span style="width:6px;height:6px;border-radius:50%;background:var(--gold);display:inline-block"></span>Mid 27%</div>
          <div style="display:flex;align-items:center;gap:4px;font-size:9px;font-family:var(--mono);color:var(--text2)"><span style="width:6px;height:6px;border-radius:50%;background:var(--red);display:inline-block"></span>Low 13%</div>
        </div>
      </div>

      <!-- Stat grid -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-card-label">Shortlisted</div>
          <div class="stat-card-val" id="shortlistVal" style="color:var(--cyan)">1</div>
          <div class="stat-card-delta delta-up">▲ +1 today</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Avg Match</div>
          <div class="stat-card-val" style="color:var(--purple)">89%</div>
          <div class="stat-card-delta delta-up">▲ +4% this wk</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Time-to-Match</div>
          <div class="stat-card-val" style="color:var(--green)">4m</div>
          <div class="stat-card-delta delta-down">▼ 2.1hr saved</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Active Chats</div>
          <div class="stat-card-val" id="chatCountVal" style="color:var(--gold)">0</div>
          <div class="stat-card-delta" style="color:var(--text3)">TrustChat sessions</div>
        </div>
      </div>

      <!-- Pipeline funnel -->
      <div style="background:var(--surface2);border:1px solid var(--bdr);border-radius:8px;padding:10px 12px;">
        <div class="stat-card-label" style="margin-bottom:8px">Pipeline Funnel</div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:10px;font-family:var(--mono);color:var(--text2);margin-bottom:3px"><span>Scanned</span><span style="color:var(--text)">2,847</span></div>
            <div style="height:3px;background:var(--surface3);border-radius:3px"><div style="height:3px;width:100%;background:var(--text3);border-radius:3px"></div></div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:10px;font-family:var(--mono);color:var(--text2);margin-bottom:3px"><span>Verified</span><span style="color:var(--cyan)">1,203</span></div>
            <div style="height:3px;background:var(--surface3);border-radius:3px"><div style="height:3px;width:42%;background:var(--cyan);border-radius:3px;box-shadow:0 0 6px var(--cyan)"></div></div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:10px;font-family:var(--mono);color:var(--text2);margin-bottom:3px"><span>Matched</span><span style="color:var(--purple)">4</span></div>
            <div style="height:3px;background:var(--surface3);border-radius:3px"><div style="height:3px;width:2%;background:var(--purple);border-radius:3px;box-shadow:0 0 6px var(--purple)"></div></div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:10px;font-family:var(--mono);color:var(--text2);margin-bottom:3px"><span>Shortlisted</span><span id="funnelShortlist" style="color:var(--green)">1</span></div>
            <div style="height:3px;background:var(--surface3);border-radius:3px"><div id="shortlistBar" style="height:3px;width:0.03%;background:var(--green);border-radius:3px;box-shadow:0 0 6px var(--green);transition:width .5s"></div></div>
          </div>
        </div>
      </div>

      <!-- B2B Plan -->
      <div class="b2b-card">
        <div class="b2b-title">Monthly Plan — Recruiter Pro</div>
        <div class="b2b-row"><span class="b2b-key">Plan</span><span class="b2b-val">SGD 299/mo</span></div>
        <div class="b2b-row"><span class="b2b-key">TrustChat slots</span><span class="b2b-val">Unlimited</span></div>
        <div class="b2b-row"><span class="b2b-key">Verified pipeline</span><span class="b2b-val">1,203 active</span></div>
        <div class="b2b-row"><span class="b2b-key">Match credits</span><span class="b2b-val">∞ AI runs</span></div>
      </div>

    </div>
  </div>

</div><!-- /workspace -->

<!-- BOTTOM LOG -->
<div class="log-bar">
  <div class="log-bar-head">
    <div class="log-live"></div>
    <div class="log-title-txt">AI MEMORY — MARKETPLACE EVENT LOG</div>
  </div>
  <div class="log-entries" id="logEntries">
    <div class="log-row"><span class="log-ts">[2026-04-26 14:00]</span><span class="log-type-match">MATCH</span><span class="log-msg-txt">Ivy Nguyen matched to Senior AI Engineer (NUS MS AI). Match Score 95%.</span></div>
    <div class="log-row"><span class="log-ts">[2026-04-26 14:01]</span><span class="log-type-match">MATCH</span><span class="log-msg-txt">Ben Tan matched. Score 91% · NTU MSc CS verified.</span></div>
    <div class="log-row"><span class="log-ts">[2026-04-26 14:02]</span><span class="log-type-match">MATCH</span><span class="log-msg-txt">Sarah Lim matched. Score 87% · AWS cert verified on-chain.</span></div>
    <div class="log-row" id="liveLog"><span class="log-ts">[2026-04-26 14:03]</span><span class="log-type-success">READY</span><span class="log-msg-txt">Match engine idle. Awaiting recruiter action. <span class="log-cursor"></span></span></div>
  </div>
</div>

<script>
// ── STATE ──
const CANDS = [
  {name:'Ivy Nguyen', first:'Ivy', degree:'NUS Master\\'s', field:'Computer Science · AI', ats:'92 / 100 · L01', interview:'88/100 · L02', trust:'95'},
  {name:'Ben Tan',    first:'Ben', degree:'NTU Master\\'s', field:'Computer Science',     ats:'89 / 100 · L01', interview:'84/100 · L02', trust:'91'},
  {name:'Sarah Lim',  first:'Sarah',degree:'SMU Bachelor\\'s',field:'Computer Science',   ats:'85 / 100 · L01', interview:'82/100 · L02', trust:'87'},
  {name:'Raj Kumar',  first:'Raj', degree:'IIT Delhi MTech',field:'Computer Engineering',ats:'88 / 100 · L01', interview:'80/100 · L02', trust:'84'},
];
let activeCand=0, chatOpen=false, chatCount=0, shortlisted=1;

function selectCand(el,i){
  document.querySelectorAll('.cand-card').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  activeCand=i;
  if(chatOpen) updateChatSidebar(i);
}

function openChat(i){
  activeCand=i;
  document.querySelectorAll('.cand-card').forEach((c,j)=>c.classList.toggle('active',j===i));
  const c=CANDS[i];
  document.getElementById('chatName').textContent=c.name;
  document.getElementById('chatNameMsg').textContent=c.first;
  document.getElementById('chatCandLabel').textContent=c.name;
  updateChatSidebar(i);
  document.getElementById('trustChat').classList.add('open');
  chatOpen=true;
  chatCount++;
  document.getElementById('chatCountVal').textContent=chatCount;
  addLog('chat',\`Recruiter initiated TrustChat with \${c.name}. Verified credentials visible.\`);
}

function updateChatSidebar(i){
  const c=CANDS[i];
  document.getElementById('cs-degree').textContent=c.degree;
  document.getElementById('cs-field').textContent=c.field;
  document.getElementById('cs-ats').textContent=c.ats;
  document.getElementById('cs-interview').textContent=c.interview;
  document.getElementById('cs-trust').textContent=c.trust+' / 100';
}

function closeChat(){
  document.getElementById('trustChat').classList.remove('open');
  chatOpen=false;
}

function toggleSkill(el){
  el.classList.toggle('off');
  runMatch();
}

function runMatch(){
  // Example only: the figures in this demo are sample data and do not change.
  addLog('match','Example only: this demo uses sample candidates and does not re-score anything.');
}

let shortlisted2=1;
function shortlistCand(){
  shortlisted2++;
  document.getElementById('shortlistVal').textContent=shortlisted2;
  document.getElementById('funnelShortlist').textContent=shortlisted2;
  const pct=(shortlisted2/2847*100).toFixed(2)+'%';
  document.getElementById('shortlistBar').style.width=pct;
  addLog('update',\`Recruiter shortlisted \${CANDS[activeCand].name}. Core memory updated.\`);
}

function addLog(type,msg){
  const entries=document.getElementById('logEntries');
  const live=document.getElementById('liveLog');
  const now=new Date();
  const ts=\`[2026-04-26 \${String(now.getHours()).padStart(2,'0')}:\${String(now.getMinutes()).padStart(2,'0')}]\`;
  const typeMap={match:'log-type-match',chat:'log-type-chat',update:'log-type-update',success:'log-type-success'};
  const row=document.createElement('div');
  row.className='log-row';
  row.innerHTML=\`<span class="log-ts">\${ts}</span><span class="\${typeMap[type]||'log-type-success'}">\${type.toUpperCase()}</span><span class="log-msg-txt">\${msg}</span>\`;
  entries.insertBefore(row,live);
  entries.scrollTop=entries.scrollHeight;
}

// auto-add shortlist after 8s to demo the flow
setTimeout(()=>shortlistCand(),8000);

// periodic log
const autoLogs=[
  ['match','Match Engine: weighting recalculated. Verified skills boosted +12%.'],
  ['update','Core memory: Recruiter viewed Ivy Nguyen profile (3x this session).'],
  ['success','Trust layer: 0 unverified candidates in top-4 pipeline.'],
  ['update','Example only: analytics view opened.'],
];
let li=0;
setInterval(()=>{const l=autoLogs[li%autoLogs.length];addLog(l[0],l[1]);li++;},9000);
</script>
</body>
</html>
`;

