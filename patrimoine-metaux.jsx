import { useState, useEffect } from "react";

const LINGOT_WEIGHTS = [
  { label: "1g",           grams: 1 },
  { label: "5g",           grams: 5 },
  { label: "10g",          grams: 10 },
  { label: "20g",          grams: 20 },
  { label: "1 Oz",         grams: 31.1035 },
  { label: "Personnalisé", grams: null },
];

const GOLD_COINS = [
  { label: "Napoléon 20F",         fg: 5.2258 },
  { label: "Souverain anglais",    fg: 7.3225 },
  { label: "Krugerrand 1 Oz",      fg: 31.1035 },
  { label: "Maple Leaf 1 Oz",      fg: 31.1035 },
  { label: "Philharmonique 1 Oz",  fg: 31.1035 },
  { label: "American Eagle 1 Oz",  fg: 31.1035 },
  { label: "Panda Chinois 1 Oz",   fg: 31.1035 },
  { label: "Vreneli 20F",          fg: 5.8064 },
  { label: "Personnalisée",        fg: null },
];

const SILVER_COINS = [
  { label: "Philharmonique 1 Oz",  fg: 31.1035 },
  { label: "Maple Leaf 1 Oz",      fg: 31.1035 },
  { label: "American Eagle 1 Oz",  fg: 31.1035 },
  { label: "Britannia 1 Oz",       fg: 31.1035 },
  { label: "50F Hercule",          fg: 27 },
  { label: "100F Cochet",          fg: 3.225 },
  { label: "Krugerrand Ag 1 Oz",   fg: 31.1035 },
  { label: "Personnalisée",        fg: null },
];

async function sha256(msg) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const f2   = n  => n?.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—";
const f3   = n  => n?.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) ?? "—";
const eur  = n  => n?.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) ?? "—";
const blank = () => ({ type: "lingot", wt: "1g", cwt: "", coin: "", cfg: "", qty: 1, name: "", desc: "", img: "", buy: "" });

export default function App() {
  const [page,    setPage]    = useState("gold");
  const [items,   setItems]   = useState({ gold: [], silver: [] });
  const [prices,  setPrices]  = useState({ gold: 80.0, silver: 1.02 });
  const [live,    setLive]    = useState(false);
  const [pLoad,   setPLoad]   = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasTok,  setHasTok]  = useState(false);
  const [filt,    setFilt]    = useState({ type: "all", wt: "all" });
  const [showAuth,setShowAuth]= useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [delId,   setDelId]   = useState(null);
  const [tok,     setTok]     = useState("");
  const [tokErr,  setTokErr]  = useState("");
  const [form,    setForm]    = useState(blank());
  const [editPrice, setEditPrice] = useState(false);
  const [pEdit,   setPEdit]   = useState({ gold: "", silver: "" });

  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get("pm_v2"); if (r) setItems(JSON.parse(r.value)); } catch {}
      try { setHasTok(!!(await window.storage.get("pm_tok"))); } catch {}
      try { const p = await window.storage.get("pm_prices"); if (p) { const pp = JSON.parse(p.value); setPrices(pp); setLive(false); } } catch {}
    })();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Cormorant+Garamond:wght@300;400;500;600&display=swap";
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  useEffect(() => { window.storage.set("pm_v2", JSON.stringify(items)).catch(() => {}); }, [items]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("https://api.metals.live/v1/spot");
        const d = await r.json();
        const s = Array.isArray(d) ? d[0] : d;
        if (s?.gold) {
          const R = 0.924, OZ = 31.1035;
          const pp = { gold: (s.gold * R) / OZ, silver: s.silver ? (s.silver * R) / OZ : prices.silver };
          setPrices(pp); setLive(true);
          window.storage.set("pm_prices", JSON.stringify(pp)).catch(() => {});
        }
      } catch {} finally { setPLoad(false); }
    })();
  }, []);

  const G     = page === "gold";
  const coins = G ? GOLD_COINS : SILVER_COINS;

  const getGrams = it => {
    if (it.type === "lingot") {
      const w = LINGOT_WEIGHTS.find(x => x.label === it.wt);
      return w?.grams ?? parseFloat(it.cwt) ?? 0;
    }
    return it.fg ?? parseFloat(it.cfg) ?? 0;
  };
  const getTotal = it => getGrams(it) * it.qty;
  const getVal   = it => getTotal(it) * (prices[page] || 0);

  const cur    = items[page] || [];
  const totG   = cur.reduce((s, i) => s + getTotal(i), 0);
  const totV   = cur.reduce((s, i) => s + getVal(i), 0);
  const shown  = cur.filter(i => {
    if (filt.type !== "all" && i.type !== filt.type) return false;
    if (filt.wt   !== "all" && i.type === "lingot" && i.wt !== filt.wt) return false;
    return true;
  });
  const shownV = shown.reduce((s, i) => s + getVal(i), 0);

  const handleAuth = async () => {
    if (!tok.trim()) return;
    const h = await sha256(tok);
    if (!hasTok) {
      await window.storage.set("pm_tok", h);
      setHasTok(true); setIsAdmin(true); closeAuth();
    } else {
      try {
        const r = await window.storage.get("pm_tok");
        if (r?.value === h) { setIsAdmin(true); closeAuth(); }
        else setTokErr("Token invalide — accès refusé.");
      } catch { setTokErr("Erreur d'authentification."); }
    }
  };
  const closeAuth = () => { setShowAuth(false); setTok(""); setTokErr(""); };

  const handleAdd = () => {
    const coin = coins.find(c => c.label === form.coin);
    const w    = LINGOT_WEIGHTS.find(x => x.label === form.wt);
    const item = {
      id: uid(), type: form.type,
      qty:  parseInt(form.qty) || 1,
      name: form.name || (form.type === "lingot" ? `Lingot ${form.wt}` : form.coin) || "—",
      desc: form.desc, img: form.img,
      buy:  form.buy ? parseFloat(form.buy) : null,
      date: new Date().toISOString(),
      wt: form.wt, cwt: parseFloat(form.cwt) || 0,
      coin: form.coin, fg: coin?.fg ?? parseFloat(form.cfg) ?? 0, cfg: parseFloat(form.cfg) || 0,
    };
    setItems(p => ({ ...p, [page]: [...(p[page] || []), item] }));
    setShowAdd(false); setForm(blank());
  };

  const handleDel    = id => { setItems(p => ({ ...p, [page]: p[page].filter(i => i.id !== id) })); setDelId(null); };
  const savePrice    = () => {
    const pp = { gold: parseFloat(pEdit.gold) || prices.gold, silver: parseFloat(pEdit.silver) || prices.silver };
    setPrices(pp); setLive(false); setEditPrice(false);
    window.storage.set("pm_prices", JSON.stringify(pp)).catch(() => {});
  };

  const previewG = (() => {
    if (form.type === "lingot") {
      const w = LINGOT_WEIGHTS.find(x => x.label === form.wt);
      return (w?.grams ?? parseFloat(form.cwt) ?? 0) * (parseInt(form.qty) || 1);
    }
    const coin = coins.find(c => c.label === form.coin);
    return (coin?.fg ?? parseFloat(form.cfg) ?? 0) * (parseInt(form.qty) || 1);
  })();
  const previewV = previewG * (prices[page] || 0);

  const T = {
    a: G ? "#C9A84C" : "#9BA5B4", b: G ? "#FFD700" : "#E2E8F0",
    d: G ? "#7A5C10" : "#4A5568", s: G ? "rgba(201,168,76,.08)" : "rgba(155,165,180,.08)",
    sh: G ? "rgba(201,168,76,.15)" : "rgba(155,165,180,.15)",
    br: G ? "rgba(201,168,76,.18)" : "rgba(155,165,180,.18)",
    bs: G ? "rgba(201,168,76,.45)" : "rgba(155,165,180,.45)",
    gl: G ? "rgba(201,168,76,.1)"  : "rgba(155,165,180,.1)",
    gr: G ? "linear-gradient(140deg,#C9A84C14,#FFD70008,#8B691414)" : "linear-gradient(140deg,#9BA5B414,#E2E8F008,#47556914)",
    tx: "#F0EDE8", td: "rgba(240,237,232,.5)", tm: "rgba(240,237,232,.28)", bg: "#060607",
  };

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:${T.bg};color:${T.tx};font-family:'Cormorant Garamond',Georgia,serif}
    input,select,textarea,button{font-family:inherit}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:${T.bg}}
    ::-webkit-scrollbar-thumb{background:${T.a}44;border-radius:2px}
    ::-webkit-scrollbar-thumb:hover{background:${T.a}88}
    .app{min-height:100vh;background:${T.bg};background-image:radial-gradient(ellipse at 15% 5%,${T.gl} 0%,transparent 45%),radial-gradient(ellipse at 85% 85%,${T.gl} 0%,transparent 45%);transition:background-image .6s ease}
    .nav{position:sticky;top:0;z-index:100;backdrop-filter:blur(24px);background:rgba(6,6,7,.9);border-bottom:1px solid ${T.br};height:66px;padding:0 2.5rem;display:flex;align-items:center;gap:2rem}
    .logo{font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:700;color:${T.a};letter-spacing:.18em;text-transform:uppercase;flex-shrink:0}
    .logo em{color:${T.b};font-style:normal}
    .tabs{display:flex;border:1px solid ${T.br};border-radius:5px;overflow:hidden}
    .tab{padding:.45rem 1.5rem;cursor:pointer;font-size:.88rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;border:none;background:transparent;color:${T.td};transition:all .3s}
    .tab+.tab{border-left:1px solid ${T.br}}
    .tab:hover{color:${T.tx};background:${T.s}}
    .tab.on{color:${T.b};background:${T.s}}
    .price-area{margin-left:auto;display:flex;align-items:center;gap:.75rem;font-size:.82rem;color:${T.td};cursor:pointer}
    .price-area:hover .price-txt{color:${T.tx}}
    .price-val{font-weight:600;color:${T.a};letter-spacing:.04em}
    .dot{width:7px;height:7px;border-radius:50%;background:${live?"#22c55e":"#f59e0b"};box-shadow:0 0 6px ${live?"#22c55e88":"#f59e0b88"};flex-shrink:0;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
    .lock{width:38px;height:38px;border-radius:50%;border:1px solid ${T.br};background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${T.td};font-size:1.1rem;transition:all .3s;flex-shrink:0}
    .lock:hover,.lock.on{border-color:${T.bs};color:${T.a};background:${T.s}}
    .stats{display:flex;gap:1px;background:${T.br};border-bottom:1px solid ${T.br}}
    .stat{flex:1;padding:1.1rem 2rem;background:${T.bg};display:flex;flex-direction:column;gap:.2rem}
    .sl{font-size:.62rem;text-transform:uppercase;letter-spacing:.15em;color:${T.tm}}
    .sv{font-family:'Playfair Display',serif;font-size:1.55rem;color:${T.a};letter-spacing:.01em}
    .ss{font-size:.72rem;color:${T.td}}
    .body{display:flex;min-height:calc(100vh - 130px)}
    .side{width:215px;flex-shrink:0;border-right:1px solid ${T.br};padding:1.5rem 1rem;display:flex;flex-direction:column;gap:1.5rem}
    .sh{font-size:.6rem;text-transform:uppercase;letter-spacing:.16em;color:${T.tm};margin-bottom:.6rem;padding-bottom:.4rem;border-bottom:1px solid ${T.br}}
    .fb{display:block;width:100%;text-align:left;padding:.45rem .7rem;margin-bottom:.2rem;background:transparent;border:1px solid transparent;color:${T.td};cursor:pointer;border-radius:3px;font-size:.9rem;letter-spacing:.04em;transition:all .2s}
    .fb:hover{background:${T.s};color:${T.tx};border-color:${T.br}}
    .fb.on{background:${T.s};color:${T.b};border-color:${T.br}}
    .add-btn{width:100%;padding:.8rem;background:linear-gradient(135deg,${T.d},${T.a});border:none;border-radius:4px;color:#000;font-weight:700;font-size:.88rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:all .3s}
    .add-btn:hover{background:linear-gradient(135deg,${T.a},${T.b});transform:translateY(-1px);box-shadow:0 6px 24px ${T.gl}}
    .cnt{flex:1;padding:2rem 2.5rem}
    .ttl{font-family:'Playfair Display',serif;font-size:2.8rem;font-weight:400;margin-bottom:.3rem}
    .ttl span{color:${T.a};font-style:italic}
    .sub{font-size:.88rem;color:${T.td};letter-spacing:.05em;margin-bottom:2rem}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:1.25rem}
    .card{border:1px solid ${T.br};border-radius:7px;background:${T.s};overflow:hidden;transition:all .3s;animation:up .35s ease both}
    @keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    .card:hover{border-color:${T.bs};background:${T.sh};transform:translateY(-3px);box-shadow:0 12px 50px ${T.gl}}
    .cimg{width:100%;height:155px;display:flex;align-items:center;justify-content:center;font-size:4rem;color:${T.a};background:${T.gr};overflow:hidden}
    .cimg img{width:100%;height:100%;object-fit:cover}
    .cbody{padding:1rem}
    .ctag{display:inline-block;font-size:.58rem;text-transform:uppercase;letter-spacing:.14em;padding:.12rem .45rem;border:1px solid ${T.br};border-radius:2px;color:${T.td};margin-bottom:.4rem}
    .cname{font-family:'Playfair Display',serif;font-size:1.05rem;color:${T.tx};margin-bottom:.2rem;font-weight:600}
    .cwt{font-size:.78rem;color:${T.a};letter-spacing:.04em;margin-bottom:.7rem}
    .cval{font-family:'Playfair Display',serif;font-size:1.25rem;color:${T.b};font-weight:600}
    .cvals{font-size:.72rem;color:${T.td};margin-top:.15rem}
    .cpnl{font-size:.72rem;margin-top:.25rem}
    .cfoot{display:flex;align-items:center;justify-content:space-between;margin-top:.75rem;padding-top:.7rem;border-top:1px solid ${T.br}}
    .cqty{font-size:.78rem;color:${T.td}}
    .del{width:28px;height:28px;border-radius:3px;border:1px solid rgba(239,68,68,.18);background:transparent;cursor:pointer;color:rgba(239,68,68,.45);font-size:.85rem;display:flex;align-items:center;justify-content:center;transition:all .2s}
    .del:hover{border-color:rgba(239,68,68,.7);color:#ef4444;background:rgba(239,68,68,.1)}
    .empty{grid-column:1/-1;text-align:center;padding:4rem 2rem}
    .eico{font-size:3.5rem;opacity:.12;margin-bottom:1rem}
    .empty h3{font-family:'Playfair Display',serif;font-size:1.2rem;color:${T.td};margin-bottom:.5rem}
    .empty p{font-size:.88rem;color:${T.tm}}
    .ov{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.84);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:1.5rem}
    .modal{background:#0A0A0C;border:1px solid ${T.bs};border-radius:9px;padding:2rem;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,.9),0 0 80px ${T.gl};animation:up .2s ease}
    .mt{font-family:'Playfair Display',serif;font-size:1.45rem;margin-bottom:.3rem;color:${T.tx}}
    .ms{font-size:.82rem;color:${T.td};margin-bottom:1.75rem;letter-spacing:.03em;line-height:1.6}
    .fg{margin-bottom:1rem}
    .fl{display:block;font-size:.63rem;text-transform:uppercase;letter-spacing:.12em;color:${T.td};margin-bottom:.35rem}
    .inp,.sel,.ta{width:100%;padding:.6rem .8rem;background:rgba(255,255,255,.04);border:1px solid ${T.br};border-radius:4px;color:${T.tx};font-size:1rem;transition:border-color .2s}
    .inp:focus,.sel:focus,.ta:focus{outline:none;border-color:${T.a}}
    .sel option{background:#0A0A0C;color:${T.tx}}
    .wgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem}
    .wb{padding:.5rem .3rem;border:1px solid ${T.br};background:transparent;border-radius:4px;color:${T.td};cursor:pointer;font-size:.9rem;text-align:center;transition:all .2s;font-family:'Cormorant Garamond',Georgia,serif}
    .wb:hover{border-color:${T.a};color:${T.tx}}
    .wb.on{background:${T.s};border-color:${T.bs};color:${T.b}}
    .tsw{display:flex;margin-bottom:1.25rem}
    .tb{flex:1;padding:.65rem;border:1px solid ${T.br};background:transparent;cursor:pointer;color:${T.td};font-size:.95rem;letter-spacing:.06em;transition:all .2s;font-family:'Cormorant Garamond',Georgia,serif}
    .tb:first-child{border-radius:4px 0 0 4px}.tb:last-child{border-radius:0 4px 4px 0}
    .tb.on{background:${T.s};color:${T.b};border-color:${T.bs}}
    .acts{display:flex;gap:.75rem;margin-top:1.5rem}
    .bp{flex:1;padding:.75rem;background:linear-gradient(135deg,${T.d},${T.a});border:none;border-radius:4px;color:#000;font-weight:700;font-size:.95rem;letter-spacing:.06em;cursor:pointer;transition:all .2s;font-family:'Cormorant Garamond',Georgia,serif}
    .bp:hover{background:linear-gradient(135deg,${T.a},${T.b})}
    .bp:disabled{opacity:.3;cursor:not-allowed}
    .bs2{padding:.75rem 1.25rem;background:transparent;border:1px solid ${T.br};border-radius:4px;color:${T.td};font-size:.95rem;cursor:pointer;transition:all .2s;font-family:'Cormorant Garamond',Georgia,serif}
    .bs2:hover{border-color:${T.bs};color:${T.tx}}
    .bd{flex:1;padding:.75rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:4px;color:#ef4444;font-size:.95rem;cursor:pointer;transition:all .2s;font-family:'Cormorant Garamond',Georgia,serif}
    .bd:hover{background:rgba(239,68,68,.2)}
    .err{color:#ef4444;font-size:.82rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);padding:.5rem .7rem;border-radius:4px;margin-bottom:1rem}
    .info{font-size:.78rem;color:${T.td};line-height:1.65;padding:.75rem;background:${T.s};border:1px solid ${T.br};border-radius:4px;margin-bottom:.5rem}
    .info strong{color:${T.a}}
    .prev{display:flex;justify-content:space-between;align-items:center;padding:.7rem;background:${T.s};border:1px solid ${T.br};border-radius:4px;margin-bottom:.5rem}
    .prevl{font-size:.78rem;color:${T.td}}
    .prevv{font-family:'Playfair Display',serif;color:${T.b};font-size:1.1rem}
    .div{border:none;border-top:1px solid ${T.br};margin:1rem 0}
    .hint{margin-top:auto;font-size:.72rem;color:${T.tm};line-height:1.65;padding-top:1rem;border-top:1px solid ${T.br}}
    @media(max-width:720px){.side{display:none}.nav{padding:0 1rem;gap:1rem}.cnt{padding:1rem}.ttl{font-size:2rem}.stats{flex-wrap:wrap}.stat{flex:calc(50% - 1px)}}
  `;

  return (
    <div className="app">
      <style>{css}</style>

      {/* ── Nav ── */}
      <nav className="nav">
        <div className="logo">{G ? "◆" : "◇"} <em>Patrimoine</em></div>

        <div className="tabs">
          <button className={`tab ${G ? "on" : ""}`}  onClick={() => setPage("gold")}>◆ Or</button>
          <button className={`tab ${!G ? "on" : ""}`} onClick={() => setPage("silver")}>◇ Argent</button>
        </div>

        <div className="price-area" onClick={() => { if (isAdmin) { setEditPrice(true); setPEdit({ gold: f2(prices.gold), silver: f2(prices.silver) }); } }}>
          <div className="dot" />
          <span className="price-txt">
            {pLoad ? "Chargement…" : (
              <span>
                {G ? "OR" : "AG"} · <span className="price-val">{f2(prices[page])} €/g</span>
                <span style={{ marginLeft: ".5rem", fontSize: ".75rem" }}>· {f2((prices[page] || 0) * 31.1035)} €/Oz</span>
                {isAdmin && <span style={{ marginLeft: ".4rem", fontSize: ".72rem", color: T.tm }}>[clic pour modifier]</span>}
              </span>
            )}
          </span>
        </div>

        <button className={`lock ${isAdmin ? "on" : ""}`} onClick={() => isAdmin ? setIsAdmin(false) : setShowAuth(true)} title={isAdmin ? "Verrouiller" : "Admin"}>
          {isAdmin ? "🔓" : "🔒"}
        </button>
      </nav>

      {/* ── Stats ── */}
      <div className="stats">
        <div className="stat">
          <div className="sl">Valeur estimée</div>
          <div className="sv">{eur(totV)}</div>
          <div className="ss">Prix {live ? "temps réel" : "manuel"}</div>
        </div>
        <div className="stat">
          <div className="sl">Poids fin total</div>
          <div className="sv">{f3(totG)} g</div>
          <div className="ss">{f3(totG / 31.1035)} Oz troy</div>
        </div>
        <div className="stat">
          <div className="sl">Possessions</div>
          <div className="sv">{cur.length}</div>
          <div className="ss">{cur.filter(i=>i.type==="lingot").length} lingots · {cur.filter(i=>i.type==="piece").length} pièces</div>
        </div>
        <div className="stat">
          <div className="sl">Prix à la gramme</div>
          <div className="sv">{f2(prices[page])} €</div>
          <div className="ss">{live ? "Cours en direct" : "Valeur estimée"}</div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="body">
        {/* Sidebar */}
        <aside className="side">
          {isAdmin && <button className="add-btn" onClick={() => setShowAdd(true)}>+ Ajouter</button>}

          <div>
            <div className="sh">Type</div>
            {[["all","Toutes possessions"],["lingot","◼ Lingots"],["piece","◉ Pièces"]].map(([v,l]) => (
              <button key={v} className={`fb ${filt.type===v?"on":""}`} onClick={() => setFilt(f=>({...f,type:v,wt:"all"}))}>{l}</button>
            ))}
          </div>

          {filt.type !== "piece" && (
            <div>
              <div className="sh">Poids (lingot)</div>
              <button className={`fb ${filt.wt==="all"?"on":""}`} onClick={() => setFilt(f=>({...f,wt:"all"}))}>Tous</button>
              {LINGOT_WEIGHTS.filter(w=>w.grams).map(w => (
                <button key={w.label} className={`fb ${filt.wt===w.label?"on":""}`} onClick={() => setFilt(f=>({...f,wt:w.label}))}>{w.label}</button>
              ))}
            </div>
          )}

          {!isAdmin && <div className="hint">🔒 Authentifiez-vous pour gérer votre portefeuille.</div>}
        </aside>

        {/* Content */}
        <div className="cnt">
          <h1 className="ttl">Patrimoine en <span>{G ? "Or" : "Argent"}</span></h1>
          <p className="sub">
            {shown.length} élément{shown.length>1?"s":""} affiché{shown.length>1?"s":""} · Valeur filtrée : <strong style={{color:T.a}}>{eur(shownV)}</strong>
          </p>

          <div className="grid">
            {shown.length === 0 ? (
              <div className="empty">
                <div className="eico">{G ? "◆" : "◇"}</div>
                <h3>Aucune possession</h3>
                <p>{isAdmin ? `Ajoutez votre premier ${G?"lingot ou pièce d'or":"lingot ou pièce d'argent"}.` : "Authentifiez-vous pour gérer votre portefeuille."}</p>
              </div>
            ) : shown.map((item, idx) => {
              const tg = getTotal(item);
              const vl = getVal(item);
              const pg = getGrams(item);
              const pnl = item.buy != null ? vl - item.buy : null;
              return (
                <div key={item.id} className="card" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className="cimg">
                    {item.img
                      ? <img src={item.img} alt={item.name} onError={e => { e.target.parentNode.removeChild(e.target); }} />
                      : <span style={{ opacity:.3 }}>{item.type === "lingot" ? "▬" : "◎"}</span>}
                  </div>
                  <div className="cbody">
                    <span className="ctag">{item.type === "lingot" ? "Lingot" : "Pièce"}</span>
                    <div className="cname">{item.name}</div>
                    <div className="cwt">
                      {item.type === "lingot"
                        ? `${item.wt === "Personnalisé" ? `${item.cwt}g` : item.wt} · ${f3(pg)}g/unité`
                        : `${f3(item.fg ?? item.cfg)}g d'${G?"or":"argent"} fin/unité`}
                    </div>
                    {item.desc && <div style={{fontSize:".78rem",color:T.td,marginBottom:".6rem",lineHeight:1.5}}>{item.desc}</div>}
                    <div className="cval">{eur(vl)}</div>
                    <div className="cvals">{f3(tg)}g · {f2(prices[page])} €/g</div>
                    {pnl != null && (
                      <div className="cpnl" style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                        {pnl >= 0 ? "▲" : "▼"} {eur(Math.abs(pnl))} {pnl >= 0 ? "plus-value" : "moins-value"}
                      </div>
                    )}
                    <div className="cfoot">
                      <span className="cqty">× {item.qty}</span>
                      {isAdmin && <button className="del" onClick={() => setDelId(item.id)} title="Supprimer">✕</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Auth Modal ── */}
      {showAuth && (
        <div className="ov" onClick={closeAuth}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mt">{hasTok ? "🔐 Authentification" : "🔑 Premier accès"}</div>
            <div className="ms">
              {hasTok
                ? "Entrez votre token pour accéder aux fonctions d'administration."
                : "Définissez votre token secret. Votre GitHub Personal Access Token (PAT) est idéal."}
            </div>
            {tokErr && <div className="err">{tokErr}</div>}
            {!hasTok && (
              <div className="info">
                <strong>Conseil sécurité :</strong> Votre token sera chiffré en SHA-256 et stocké localement. Même l'application n'y a jamais accès en clair. Utilisez un GitHub PAT ou tout secret de votre choix.
              </div>
            )}
            <div className="fg">
              <label className="fl">Token d'accès</label>
              <input type="password" className="inp" placeholder={hasTok ? "ghp_votre_token..." : "Définir un token secret..."} value={tok} onChange={e => { setTok(e.target.value); setTokErr(""); }} onKeyDown={e => e.key === "Enter" && handleAuth()} autoFocus />
            </div>
            <div className="acts">
              <button className="bs2" onClick={closeAuth}>Annuler</button>
              <button className="bp" onClick={handleAuth}>{hasTok ? "Se connecter" : "Définir le token"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Modal ── */}
      {showAdd && (
        <div className="ov" onClick={() => { setShowAdd(false); setForm(blank()); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mt">+ Nouvelle possession</div>
            <div className="ms">{G ? "Or" : "Argent"} · Renseignez les caractéristiques</div>

            <div className="tsw">
              <button className={`tb ${form.type==="lingot"?"on":""}`} onClick={() => setForm(f=>({...f,type:"lingot"}))}>▬ Lingot</button>
              <button className={`tb ${form.type==="piece"?"on":""}`}  onClick={() => setForm(f=>({...f,type:"piece"}))}>◎ Pièce</button>
            </div>

            {form.type === "lingot" ? (
              <>
                <div className="fg">
                  <label className="fl">Format du lingot</label>
                  <div className="wgrid">
                    {LINGOT_WEIGHTS.map(w => (
                      <button key={w.label} className={`wb ${form.wt===w.label?"on":""}`} onClick={() => setForm(f=>({...f,wt:w.label}))}>{w.label}</button>
                    ))}
                  </div>
                </div>
                {form.wt === "Personnalisé" && (
                  <div className="fg">
                    <label className="fl">Poids exact (grammes)</label>
                    <input type="number" className="inp" placeholder="ex : 250" value={form.cwt} onChange={e => setForm(f=>({...f,cwt:e.target.value}))} min="0" step="0.001" />
                  </div>
                )}
              </>
            ) : (
              <div className="fg">
                <label className="fl">Type de pièce</label>
                <select className="sel" value={form.coin} onChange={e => setForm(f=>({...f,coin:e.target.value}))}>
                  <option value="">Choisir…</option>
                  {coins.map(c => <option key={c.label} value={c.label}>{c.label}{c.fg?` — ${c.fg}g fin`:""}</option>)}
                </select>
                {form.coin === "Personnalisée" && (
                  <div style={{ marginTop: ".5rem" }}>
                    <input type="number" className="inp" placeholder={`Grammes d'${G?"or":"argent"} fin`} value={form.cfg} onChange={e => setForm(f=>({...f,cfg:e.target.value}))} min="0" step="0.001" />
                  </div>
                )}
              </div>
            )}

            <hr className="div" />

            <div className="fg">
              <label className="fl">Quantité</label>
              <input type="number" className="inp" value={form.qty} onChange={e => setForm(f=>({...f,qty:e.target.value}))} min="1" />
            </div>
            <div className="fg">
              <label className="fl">Nom personnalisé (optionnel)</label>
              <input type="text" className="inp" placeholder={form.type==="lingot"?`Lingot ${form.wt}`:form.coin||"Nom…"} value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} />
            </div>
            <div className="fg">
              <label className="fl">Description (optionnelle)</label>
              <textarea className="ta" rows={2} placeholder="Millésime, état, série, coffret…" value={form.desc} onChange={e => setForm(f=>({...f,desc:e.target.value}))} style={{ resize: "vertical" }} />
            </div>
            <div className="fg">
              <label className="fl">URL image (optionnelle)</label>
              <input type="url" className="inp" placeholder="https://…" value={form.img} onChange={e => setForm(f=>({...f,img:e.target.value}))} />
            </div>
            <div className="fg">
              <label className="fl">Prix d'achat total € (optionnel)</label>
              <input type="number" className="inp" placeholder="ex : 1 850,00" value={form.buy} onChange={e => setForm(f=>({...f,buy:e.target.value}))} min="0" step="0.01" />
            </div>

            {previewG > 0 && (
              <div className="prev">
                <span className="prevl">Valeur estimée</span>
                <span className="prevv">{eur(previewV)}</span>
              </div>
            )}

            <div className="acts">
              <button className="bs2" onClick={() => { setShowAdd(false); setForm(blank()); }}>Annuler</button>
              <button className="bp" onClick={handleAdd} disabled={form.type==="piece"&&!form.coin}>Ajouter au portefeuille</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Price Edit Modal ── */}
      {editPrice && (
        <div className="ov" onClick={() => setEditPrice(false)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="mt">Modifier les prix</div>
            <div className="ms">Saisir manuellement les cours en €/gramme.</div>
            <div className="fg">
              <label className="fl">◆ Or (€/g)</label>
              <input type="number" className="inp" value={pEdit.gold} onChange={e => setPEdit(p=>({...p,gold:e.target.value}))} step="0.01" min="0" />
            </div>
            <div className="fg">
              <label className="fl">◇ Argent (€/g)</label>
              <input type="number" className="inp" value={pEdit.silver} onChange={e => setPEdit(p=>({...p,silver:e.target.value}))} step="0.001" min="0" />
            </div>
            <div className="acts">
              <button className="bs2" onClick={() => setEditPrice(false)}>Annuler</button>
              <button className="bp" onClick={savePrice}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {delId && (
        <div className="ov" onClick={() => setDelId(null)}>
          <div className="modal" style={{ maxWidth: 360, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "2.2rem", marginBottom: "1rem", opacity: .6 }}>⚠️</div>
            <div className="mt">Supprimer ?</div>
            <div className="ms">Cette possession sera définitivement retirée de votre portefeuille. Irréversible.</div>
            <div className="acts">
              <button className="bs2" onClick={() => setDelId(null)}>Annuler</button>
              <button className="bd" onClick={() => handleDel(delId)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
