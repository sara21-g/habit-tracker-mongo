import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Health", "Learning", "Productivity", "Mindfulness", "Other"];
const CATEGORY_COLORS  = { Health: "#e86a3a", Learning: "#4f8ef7", Productivity: "#f0a500", Mindfulness: "#9b6dff", Other: "#6b7280" };
const CATEGORY_LIGHT   = { Health: "#fde8df", Learning: "#ddeaff", Productivity: "#fff1cc", Mindfulness: "#ece6ff", Other: "#f3f4f6" };
const PRIORITY_META    = {
  high:   { label: "High",   color: "#e84545", bg: "#ffe8e8", icon: "↑" },
  medium: { label: "Medium", color: "#e07b00", bg: "#fff3e0", icon: "→" },
  low:    { label: "Low",    color: "#2da44e", bg: "#e6f5ec", icon: "↓" },
};
const QUOTES = [
  { text: "We are what we repeatedly do. Excellence is a habit.", author: "Aristotle" },
  { text: "Motivation gets you going, habit keeps you growing.", author: "John Maxwell" },
  { text: "The secret of your future is hidden in your daily routine.", author: "Mike Murdock" },
  { text: "Consistency is the key to achieving and maintaining momentum.", author: "Darren Hardy" },
  { text: "Your habits will determine your future.", author: "Jack Canfield" },
  { text: "First forget inspiration. Habit is more dependable.", author: "Octavia Butler" },
  { text: "Small steps every day lead to big results.", author: "Anonymous" },
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const genId    = () => Math.random().toString(36).substr(2, 9);
const todayKey = () => new Date().toISOString().split("T")[0];
const getQuote = () => { const d = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0))/86400000); return QUOTES[d % QUOTES.length]; };
const load     = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const save     = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const getLast7 = () => Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return {key:d.toISOString().split("T")[0],label:DAYS[d.getDay()]}; });

const API = {
  getState: () => fetch('/api/state').then(r => r.json()),
  updateState: (state) => fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }),
  addHabit: (habit) => fetch('/api/habits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(habit) }).then(r => r.json()),
  updateHabit: (id, updates) => fetch(`/api/habits/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }).then(r => r.json()),
  deleteHabit: (id) => fetch(`/api/habits/${id}`, { method: 'DELETE' }),
  reorderHabits: (habitIds) => fetch('/api/habits/reorder', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ habitIds }) })
};

function useDragReorder(setItems, onReorder) {
  const dragIdx = useRef(null);
  return {
    onDragStart: (i) => { dragIdx.current = i; },
    onDragOver: (e, i) => {
      e.preventDefault();
      if (dragIdx.current === null || dragIdx.current === i) return;
      setItems(prev => { const n=[...prev],[m]=n.splice(dragIdx.current,1); n.splice(i,0,m); dragIdx.current=i; return n; });
    },
    onDragEnd: () => { 
        if (dragIdx.current !== null) {
            onReorder();
        }
        dragIdx.current = null; 
    },
  };
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function RingProgress({ pct, size = 110 }) {
  const r = 42, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#ede8df" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e86a3a" strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)" }} />
      <text x="50" y="45" textAnchor="middle" fill="#1a1208" fontSize="16" fontWeight="700" fontFamily="Fraunces, serif">{pct}%</text>
      <text x="50" y="60" textAnchor="middle" fill="#9a8f7e" fontSize="8" fontFamily="'DM Sans', sans-serif">done</text>
    </svg>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ background: "#fff", border: "1.5px solid #ede8df", borderRadius: 16, padding: "14px 18px", flex:1, minWidth: 80, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "Fraunces, serif", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#9a8f7e", marginTop: 3, letterSpacing:"0.06em", textTransform:"uppercase" }}>{label}</div>
    </div>
  );
}

function StreakPanel({ current, best }) {
  return (
    <div style={{ display:"flex", gap:10, width:"100%", maxWidth:640, marginBottom:20 }}>
      <div style={{ ...cardBase, flex:1, display:"flex", alignItems:"center", gap:12, padding:"14px 18px" }}>
        <div style={{ fontSize:28, lineHeight:1 }}>🔥</div>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:"#e86a3a", fontFamily:"Fraunces, serif", lineHeight:1 }}>{current} <span style={{fontSize:13,color:"#c87a5a",fontFamily:"'DM Sans',sans-serif",fontWeight:400}}>day streak</span></div>
          <div style={{ fontSize:11, color:"#9a8f7e", marginTop:2, letterSpacing:"0.05em" }}>CURRENT</div>
        </div>
      </div>
      <div style={{ ...cardBase, flex:1, display:"flex", alignItems:"center", gap:12, padding:"14px 18px" }}>
        <div style={{ fontSize:28, lineHeight:1 }}>🏆</div>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:"#f0a500", fontFamily:"Fraunces, serif", lineHeight:1 }}>{best} <span style={{fontSize:13,color:"#b8862a",fontFamily:"'DM Sans',sans-serif",fontWeight:400}}>day best</span></div>
          <div style={{ fontSize:11, color:"#9a8f7e", marginTop:2, letterSpacing:"0.05em" }}>ALL-TIME</div>
        </div>
      </div>
    </div>
  );
}

function HabitForm({ onAdd }) {
  const [name, setName]         = useState("");
  const [category, setCategory] = useState("Health");
  const [priority, setPriority] = useState("medium");
  const [shake, setShake]       = useState(false);
  const [focused, setFocused]   = useState(false);

  const submit = () => {
    if (!name.trim()) { setShake(true); setTimeout(()=>setShake(false),500); return; }
    onAdd({ name: name.trim(), category, priority });
    setName("");
  };

  return (
    <div style={{ width:"100%", maxWidth:640, marginBottom:20 }} className={shake ? "shake" : ""}>
      <div style={{ background:"#fff", border:`2px solid ${focused?"#e86a3a":"#ede8df"}`, borderRadius:20, padding:"16px 18px", boxShadow: focused?"0 0 0 4px rgba(232,106,58,0.1)":"0 1px 4px rgba(0,0,0,0.06)", transition:"all 0.2s" }}>
        <div style={{ display:"flex", gap:10, marginBottom:12 }}>
          <input
            style={{ flex:1, border:"none", outline:"none", fontSize:15, color:"#1a1208", fontFamily:"'DM Sans',sans-serif", background:"transparent", placeholder:"#bbb" }}
            placeholder="What habit will you build today?"
            value={name}
            onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            onFocus={()=>setFocused(true)}
            onBlur={()=>setFocused(false)}
          />
          <button onClick={submit} className="add-btn" style={{ background:"#1a1208", border:"none", borderRadius:12, color:"#fdf8f0", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:13, padding:"9px 18px", cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.2s", letterSpacing:"0.02em" }}>
            + Add Habit
          </button>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:11, color:"#9a8f7e", letterSpacing:"0.06em", textTransform:"uppercase", marginRight:2 }}>Category</span>
          {CATEGORIES.filter(c=>c!=="All").map(c=>(
            <button key={c} onClick={()=>setCategory(c)} style={{
              background: category===c ? CATEGORY_LIGHT[c] : "transparent",
              border: `1.5px solid ${category===c ? CATEGORY_COLORS[c]+"66" : "#ede8df"}`,
              borderRadius:8, color: category===c ? CATEGORY_COLORS[c] : "#9a8f7e",
              fontFamily:"'DM Sans',sans-serif", fontSize:12, padding:"4px 10px", cursor:"pointer", transition:"all 0.15s", fontWeight: category===c?600:400
            }}>{c}</button>
          ))}
          <div style={{width:1, height:16, background:"#ede8df", margin:"0 4px"}}/>
          {Object.entries(PRIORITY_META).map(([k,v])=>(
            <button key={k} onClick={()=>setPriority(k)} style={{
              background: priority===k ? v.bg : "transparent",
              border: `1.5px solid ${priority===k ? v.color+"55" : "#ede8df"}`,
              borderRadius:8, color: priority===k ? v.color : "#9a8f7e",
              fontFamily:"'DM Sans',sans-serif", fontSize:12, padding:"4px 10px", cursor:"pointer", transition:"all 0.15s", fontWeight: priority===k?600:400
            }}>{v.icon} {v.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HabitItem({ habit, index, onToggle, onDelete, onDragStart, onDragOver, onDragEnd }) {
  const catColor  = CATEGORY_COLORS[habit.category] || "#6b7280";
  const catLight  = CATEGORY_LIGHT[habit.category]  || "#f3f4f6";
  const priMeta   = PRIORITY_META[habit.priority];
  const allTime   = habit.history?.length ?? 0;
  const daysSince = Math.max(1, Math.floor((Date.now()-new Date(habit.createdAt))/86400000)+1);
  const pct       = Math.round((allTime/daysSince)*100);

  return (
    <div
      draggable
      onDragStart={()=>onDragStart(index)}
      onDragOver={e=>onDragOver(e,index)}
      onDragEnd={onDragEnd}
      className="habit-card"
      style={{
        background: habit.completed ? "#fafaf8" : "#fff",
        border: `1.5px solid ${habit.completed ? "#e8e3d8" : "#ede8df"}`,
        borderRadius: 18, padding:"14px 16px",
        display:"flex", alignItems:"center", gap:12,
        transition:"all 0.22s", cursor:"grab",
        animationDelay:`${index*0.05}s`,
        position:"relative", overflow:"hidden",
        boxShadow: habit.completed ? "none" : "0 1px 6px rgba(0,0,0,0.05)",
        opacity: habit.completed ? 0.7 : 1,
      }}
    >
      {/* Left accent bar */}
      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:4, background: habit.completed ? "#d4cfc5" : catColor, borderRadius:"18px 0 0 18px" }} />

      {/* Drag handle */}
      <span style={{ color:"#d4cfc5", fontSize:16, cursor:"grab", userSelect:"none", flexShrink:0, marginLeft:6 }}>⠿</span>

      {/* Checkbox */}
      <button
        onClick={()=>onToggle(habit.id)}
        className="checkbox-btn"
        style={{
          width:26, height:26, borderRadius:"50%",
          border: `2px solid ${habit.completed ? catColor : "#d4cfc5"}`,
          background: habit.completed ? catColor : "transparent",
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          flexShrink:0, transition:"all 0.2s", padding:0,
        }}
      >
        {habit.completed && <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </button>

      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:600, color: habit.completed ? "#b0a898" : "#1a1208", fontFamily:"'DM Sans',sans-serif", textDecoration: habit.completed?"line-through":"none", marginBottom:6, transition:"all 0.2s" }}>
          {habit.name}
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:11, fontFamily:"'DM Sans',sans-serif", fontWeight:600, color:catColor, background:catLight, borderRadius:6, padding:"2px 8px" }}>{habit.category}</span>
          <span style={{ fontSize:11, fontFamily:"'DM Sans',sans-serif", fontWeight:600, color:priMeta.color, background:priMeta.bg, borderRadius:6, padding:"2px 8px" }}>{priMeta.icon} {priMeta.label}</span>
          <span style={{ fontSize:11, fontFamily:"'DM Sans',sans-serif", color:"#9a8f7e", background:"#f5f2ec", borderRadius:6, padding:"2px 8px" }}>✓ {allTime}d · {pct}%</span>
        </div>
      </div>

      {/* Delete */}
      <button onClick={()=>onDelete(habit.id)} className="delete-btn" style={{ background:"transparent", border:"none", color:"#d4cfc5", cursor:"pointer", fontSize:16, padding:"4px 6px", borderRadius:8, transition:"all 0.2s", lineHeight:1, flexShrink:0 }}>✕</button>
    </div>
  );
}

function WeeklyChart({ habits, last7 }) {
  const data = last7.map(({key,label})=>({
    label,
    pct: habits.length===0 ? 0 : Math.round((habits.filter(h=>h.history?.includes(key)).length/habits.length)*100),
    isToday: key===todayKey(),
  }));
  return (
    <div style={{ ...cardBase, width:"100%", maxWidth:640, padding:"22px 20px 12px" }}>
      <div style={sectionTitle}>Weekly Overview</div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} barCategoryGap="32%">
          <XAxis dataKey="label" tick={{fill:"#9a8f7e",fontSize:11,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
          <YAxis domain={[0,100]} tick={{fill:"#9a8f7e",fontSize:10,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} width={30}/>
          <Tooltip formatter={v=>[`${v}%`,"Completed"]} contentStyle={{background:"#fff",border:"1.5px solid #ede8df",borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontSize:12,boxShadow:"0 4px 12px rgba(0,0,0,0.08)"}} labelStyle={{color:"#1a1208",fontWeight:600}} itemStyle={{color:"#6b7280"}}/>
          <Bar dataKey="pct" radius={[6,6,0,0]}>
            {data.map((d,i)=><Cell key={i} fill={d.isToday?"#e86a3a":"#ede8df"}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HistoryLog({ habits }) {
  const last7 = getLast7();
  return (
    <div style={{ ...cardBase, width:"100%", maxWidth:640, padding:"22px 20px", overflowX:"auto" }}>
      <div style={sectionTitle}>Completion History</div>
      <div style={{ minWidth:360 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, paddingBottom:10, borderBottom:"1.5px solid #ede8df", marginBottom:8 }}>
          <div style={{width:130,fontSize:10,color:"#9a8f7e",textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"'DM Sans',sans-serif"}}>Habit</div>
          {last7.map(d=><div key={d.key} style={{flex:1,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em",color:d.key===todayKey()?"#e86a3a":"#9a8f7e",textAlign:"center",fontFamily:"'DM Sans',sans-serif",fontWeight:d.key===todayKey()?700:400}}>{d.label}</div>)}
        </div>
        {habits.map(h=>(
          <div key={h.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{width:130,fontSize:12,color:"#1a1208",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flexShrink:0,fontFamily:"'DM Sans',sans-serif"}}>{h.name}</div>
            {last7.map(d=>(
              <div key={d.key} style={{flex:1,display:"flex",justifyContent:"center"}}>
                <div style={{
                  width:20,height:20,borderRadius:6,
                  background:h.history?.includes(d.key) ? (CATEGORY_COLORS[h.category]||"#e86a3a") : "#f5f2ec",
                  border:`1.5px solid ${d.key===todayKey()?"#e86a3a33":"#ede8df"}`,
                  transition:"all 0.2s",
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>{h.history?.includes(d.key)&&<svg width="9" height="9" viewBox="0 0 9 9"><polyline points="1.5,4.5 3.8,6.8 7.5,2" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function HabitTracker() {
  const [habits,     setHabits]     = useState([]);
  const [streakData, setStreakData] = useState({current:0, best:0});
  const [loading,    setLoading]    = useState(true);
  const [filterCat,  setFilterCat]  = useState("All");
  const [filterStat, setFilterStat] = useState("All");
  const [activeTab,  setActiveTab]  = useState("today");
  const [justReset,  setJustReset]  = useState(false);
  const quote  = getQuote();
  const today  = todayKey();
  const last7  = getLast7();

  useEffect(() => {
    API.getState().then(data => {
      setHabits(data.habits);
      setStreakData({ current: data.state.currentStreak, best: data.state.bestStreak });
      
      const last = data.state.lastDay;
      if (last && last !== today) {
        setHabits(prev => {
          const allDone = prev.every(h => h.completed);
          const newCurrent = allDone ? data.state.currentStreak + 1 : 0;
          const newBest = Math.max(data.state.bestStreak, newCurrent);
          
          setStreakData({ current: newCurrent, best: newBest });
          API.updateState({ currentStreak: newCurrent, bestStreak: newBest, lastDay: today });
          
          const resetHabits = prev.map(h => ({ ...h, completed: false }));
          resetHabits.forEach(h => API.updateHabit(h.id, { completed: false }));
          return resetHabits;
        });
      } else if (!last) {
          API.updateState({ lastDay: today });
      }
      setLoading(false);
    });
  }, [today]);

  const total     = habits.length;
  const completed = habits.filter(h=>h.completed).length;
  const remaining = total - completed;
  const pct       = total===0 ? 0 : Math.round((completed/total)*100);

  const displayed = habits.filter(h=>{
    const catOk = filterCat==="All" || h.category===filterCat;
    const stOk  = filterStat==="All" || (filterStat==="Done" ? h.completed : !h.completed);
    return catOk && stOk;
  });

  const { onDragStart, onDragOver, onDragEnd } = useDragReorder(setHabits, () => {
    setHabits(currentHabits => {
        API.reorderHabits(currentHabits.map(h => h.id));
        return currentHabits;
    });
  });

  const addHabit = useCallback(({name,category,priority})=>{
    const newHabit = {id:genId(),name,completed:false,category,priority,createdAt:today,history:[],order:habits.length};
    setHabits(prev=>[...prev, newHabit]);
    API.addHabit(newHabit);
  },[today, habits.length]);

  const toggleHabit = useCallback((id)=>{
    setHabits(prev=>prev.map(h=>{
      if(h.id!==id) return h;
      const nowDone = !h.completed;
      const history = h.history||[];
      const newHistory = nowDone ? [...new Set([...history,today])] : history.filter(d=>d!==today);
      const updates = { completed:nowDone, history: newHistory };
      API.updateHabit(id, updates);
      return {...h, ...updates};
    }));
  },[today]);

  const deleteHabit = useCallback((id)=>{ 
    setHabits(prev=>prev.filter(h=>h.id!==id)); 
    API.deleteHabit(id);
  },[]);

  const resetDay = ()=>{
    setHabits(prev=>prev.map(h=>{
      const updates = {completed:false,history:(h.history||[]).filter(d=>d!==today)};
      API.updateHabit(h.id, updates);
      return {...h, ...updates};
    }));
    setJustReset(true); setTimeout(()=>setJustReset(false),1500);
  };

  const todayFmt = new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});

  if (loading) return <div style={{ minHeight:"100vh", background:"#fdf8f0", display:"flex", alignItems:"center", justifyContent:"center", color:"#1a1208", fontFamily:"'DM Sans',sans-serif" }}>Loading your habits...</div>;

  return (
    <div style={{ minHeight:"100vh", background:"#fdf8f0", color:"#1a1208", fontFamily:"'DM Sans',sans-serif", paddingBottom:80 }}>
      <style>{CSS}</style>

      {/* ── HERO HEADER ── */}
      <div style={{ background:"linear-gradient(160deg,#1a1208 0%,#2d1f10 100%)", padding:"36px 20px 0", display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ width:"100%", maxWidth:640 }}>
          {/* Top bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
            <div>
              <div style={{ fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", color:"#8a7a60", marginBottom:6 }}>{todayFmt}</div>
              <h1 style={{ fontSize:36, fontWeight:700, margin:0, fontFamily:"Fraunces, serif", color:"#fdf8f0", letterSpacing:"-0.02em", lineHeight:1.1 }}>Daily Habits</h1>
            </div>
            <button onClick={resetDay} className="reset-btn" style={{ background:"transparent", border:"1.5px solid #3d3020", color:"#8a7a60", padding:"9px 16px", borderRadius:12, cursor:"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.04em", transition:"all 0.2s", marginTop:4 }}>
              {justReset ? "✓ Reset!" : "↺ Reset Day"}
            </button>
          </div>

          {/* Ring + Stats */}
          <div style={{ display:"flex", gap:16, alignItems:"center", marginBottom:0 }}>
            <div style={{ flexShrink:0 }}>
              <RingProgress pct={pct} />
            </div>
            <div style={{ flex:1, display:"flex", gap:10 }}>
              <StatPill label="Total"     value={total}     color="#1a1208" />
              <StatPill label="Completed" value={completed} color="#2da44e" />
              <StatPill label="Remaining" value={remaining} color="#e84545" />
            </div>
          </div>

          {/* Quote ribbon */}
          <div style={{ background:"#251a0e", border:"1px solid #3d3020", borderRadius:"0 0 20px 20px", padding:"14px 18px", marginTop:-2 }}>
            <div style={{ fontSize:12, color:"#c8b89a", fontStyle:"italic", lineHeight:1.6 }}>"{quote.text}"</div>
            <div style={{ fontSize:11, color:"#6b5a42", marginTop:4, letterSpacing:"0.05em" }}>— {quote.author}</div>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"24px 16px 0" }}>

        <StreakPanel current={streakData.current} best={streakData.best} />

        {/* Add habit form */}
        <HabitForm onAdd={addHabit} />

        {/* Filters */}
        <div style={{ width:"100%", maxWidth:640, marginBottom:16, display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {CATEGORIES.map(c=>(
              <button key={c} onClick={()=>setFilterCat(c)} className="filter-pill" style={{
                background: filterCat===c ? "#1a1208" : "#fff",
                border: `1.5px solid ${filterCat===c?"#1a1208":"#ede8df"}`,
                borderRadius:99, color: filterCat===c?"#fdf8f0":"#6b7280",
                fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight: filterCat===c?600:400,
                padding:"5px 14px", cursor:"pointer", transition:"all 0.18s",
              }}>{c}</button>
            ))}
            <div style={{width:1,background:"#ede8df",margin:"0 2px"}}/>
            {["All","Done","Remaining"].map(s=>(
              <button key={s} onClick={()=>setFilterStat(s)} className="filter-pill" style={{
                background: filterStat===s ? "#e86a3a" : "#fff",
                border: `1.5px solid ${filterStat===s?"#e86a3a":"#ede8df"}`,
                borderRadius:99, color: filterStat===s?"#fff":"#6b7280",
                fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight: filterStat===s?600:400,
                padding:"5px 14px", cursor:"pointer", transition:"all 0.18s",
              }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:0, width:"100%", maxWidth:640, marginBottom:16, background:"#fff", border:"1.5px solid #ede8df", borderRadius:14, padding:4, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          {[["today","📋  Habits"],["chart","📊  Weekly"],["history","📅  History"]].map(([k,label])=>(
            <button key={k} onClick={()=>setActiveTab(k)} style={{
              flex:1, background: activeTab===k ? "#1a1208" : "transparent",
              border:"none", borderRadius:11, color: activeTab===k?"#fdf8f0":"#9a8f7e",
              fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight: activeTab===k?600:400,
              padding:"9px 0", cursor:"pointer", transition:"all 0.2s", letterSpacing:"0.01em",
            }}>{label}</button>
          ))}
        </div>

        {/* Tab panels */}
        {activeTab==="today" && (
          <div style={{ width:"100%", maxWidth:640, display:"flex", flexDirection:"column", gap:8 }}>
            {displayed.length===0 && (
              <div style={{ textAlign:"center", color:"#b0a898", padding:"48px 0", fontSize:14 }}>No habits match your filters.</div>
            )}
            {displayed.map((habit,i)=>(
              <HabitItem key={habit.id} habit={habit} index={habits.indexOf(habit)}
                onToggle={toggleHabit} onDelete={deleteHabit}
                onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} />
            ))}
          </div>
        )}
        {activeTab==="chart"   && <WeeklyChart habits={habits} last7={last7} />}
        {activeTab==="history" && <HistoryLog  habits={habits} />}

        {/* Celebration */}
        {pct===100 && total>0 && (
          <div style={{ marginTop:20, background:"linear-gradient(135deg,#1a4d2e,#2a6b3f)", border:"1.5px solid #4ade80", borderRadius:16, padding:"16px 24px", fontSize:14, color:"#4ade80", textAlign:"center", maxWidth:640, width:"100%", fontFamily:"'DM Sans',sans-serif", fontWeight:600, animation:"fadeIn 0.4s ease both", boxShadow:"0 4px 20px rgba(74,222,128,0.15)" }}>
            🎉 All habits completed! Your streak is safe — incredible work today!
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SHARED STYLE ATOMS ───────────────────────────────────────────────────────

const cardBase = { background:"#fff", border:"1.5px solid #ede8df", borderRadius:18, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" };
const sectionTitle = { fontSize:11, textTransform:"uppercase", letterSpacing:"0.14em", color:"#9a8f7e", marginBottom:14, fontFamily:"'DM Sans',sans-serif", fontWeight:600 };

// ─── CSS ─────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;1,400&family=DM+Sans:wght@400;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }

  @keyframes fadeIn {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes shake {
    0%,100% { transform:translateX(0); }
    20% { transform:translateX(-6px); }
    40% { transform:translateX(5px); }
    60% { transform:translateX(-4px); }
    80% { transform:translateX(3px); }
  }

  .shake { animation: shake 0.4s ease; }

  .habit-card { animation: fadeIn 0.3s ease both; }
  .habit-card:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 20px rgba(0,0,0,0.09) !important; border-color: #d4cfc5 !important; }
  .habit-card:active { transform: scale(0.99) !important; }

  .checkbox-btn { transition: all 0.18s; }
  .checkbox-btn:hover { transform: scale(1.15); }

  .delete-btn:hover { color: #e84545 !important; background: #fff0f0 !important; }

  .add-btn:hover { background: #3d2e1a !important; transform: scale(1.02); }
  .add-btn:active { transform: scale(0.98) !important; }

  .reset-btn:hover { border-color: #6b5a42 !important; color: #c8b89a !important; }

  .filter-pill:hover { opacity: 0.85; transform: scale(1.02); }

  input::placeholder { color: #c8b89a; }
  input:focus { outline: none; }

  select { appearance: none; }
  select option { background: #fff; }
`;
