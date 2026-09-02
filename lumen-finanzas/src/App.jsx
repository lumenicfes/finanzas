import { useState, useEffect, useRef } from 'react';
import {
  TrendingDown, TrendingUp, Users, Bell, BarChart3, Settings,
  LogOut, Plus, AlertTriangle, Lock, Trash2, Phone, GraduationCap, CheckCircle2,
  Clock, MessageCircle, Upload, User, X, FileText, Tag, ArrowLeft, MoreHorizontal,
  Search, Copy, ChevronRight
} from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import _ from 'lodash';

// ─── Constants ────────────────────────────────────────────────────────────────
const SK = 'lumen-finance-data';
const PK = 'lumen-finance-pin';
const RP = 'lumen-rec-';
const PIN0 = '0000';
const METHODS = ['Bold', 'Bancolombia', 'Daviplata', 'Nequi', 'Otras'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DEF_INC = ['Simulacro','Material estudio','Matrícula','Otros'];
const DEF_EXP = ['Publicidad','Plataformas','Servicios','Pago profesores','Pago a personal','Suscripciones'];

const emptyData = {
  payments: [], expenses: [], students: [],
  groups: ['Intensivo', 'Mega Intensivo', 'Pre ICFES Intensivo', 'Pre ICFES'],
  incomeCategories: [...DEF_INC],
  expenseCategories: [...DEF_EXP]
};

// ─── Utils ────────────────────────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const cop = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const fDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const todayS = () => new Date().toISOString().slice(0, 10);
const nowT = () => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
const daysUntil = d => { if (!d) return null; const t = new Date(); t.setHours(0,0,0,0); return Math.round((new Date(d+'T00:00:00')-t)/86400000); };
const formatMonth = m => { const [y,mo] = m.split('-'); return `${MESES[parseInt(mo)-1]} ${y}`; };

async function compressImg(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const sc = Math.min(1,900/Math.max(img.width,img.height)); c.width=img.width*sc; c.height=img.height*sc; c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',0.72)); }; img.src=e.target.result; };
    r.readAsDataURL(file);
  });
}
async function fileToB64(file) { return new Promise(res => { const r=new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(file); }); }
function waMsg(phone, name, cuotaLabel, net, dueDate) {
  const num = phone.replace(/\D/g,'');
  const msg = encodeURIComponent(`Hola ${name} 👋\nTe recordamos que tienes pendiente *${cuotaLabel}* por *${cop(net)}*${dueDate?`, con vencimiento el *${fDate(dueDate)}*`:''}.\n¡Gracias! 💛 Equipo LUMEN`);
  return `https://wa.me/+57${num}?text=${msg}`;
}

// ─── Cuota helpers ────────────────────────────────────────────────────────────
const CUOTA_KEYS = [
  { key:'firstCuota',  label:'Primera', short:'C1', tag:'cuota1' },
  { key:'secondCuota', label:'Segunda', short:'C2', tag:'cuota2' },
  { key:'thirdCuota',  label:'Tercera', short:'C3', tag:'cuota3' },
];
function getCuotas(s) { return CUOTA_KEYS.slice(0, s.numCuotas??2).filter(({key})=>s[key]).map(({key,label,short,tag})=>({key,label,short,tag,c:s[key]})); }
function studentTotals(s) { const cs=getCuotas(s); return { paid:cs.reduce((sum,{c})=>c.paid?sum+(c.amount||0)-(c.discount||0):sum,0), balance:cs.reduce((sum,{c})=>!c.paid?sum+(c.amount||0)-(c.discount||0):sum,0) }; }
function urgentCuota(s) { return getCuotas(s).filter(({c})=>!c.paid&&c.dueDate).map(({label,c})=>({label,c,days:daysUntil(c.dueDate)})).sort((a,b)=>(a.days??999)-(b.days??999))[0]||null; }
function alertDays(s) { const u=urgentCuota(s); return u?u.days:null; }

// ─── Shared UI ────────────────────────────────────────────────────────────────
const Inp = ({ label, ...p }) => <div>{label && <label className="text-xs text-slate-500 block mb-1">{label}</label>}<input {...p} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400"/></div>;
const Sel = ({ label, options, ...p }) => <div>{label && <label className="text-xs text-slate-500 block mb-1">{label}</label>}<select {...p} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 bg-white"><option value="">Seleccionar…</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></div>;

function CuotaBadge({ paid, dueDate }) {
  if (paid) return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap"><CheckCircle2 size={11}/>Pagada</span>;
  const d = daysUntil(dueDate);
  if (d===null) return <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Sin fecha</span>;
  if (d<0) return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap"><AlertTriangle size={11}/>Vencida</span>;
  if (d<=5) return <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full whitespace-nowrap"><Clock size={11}/>Vence {d}d</span>;
  return <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Pendiente</span>;
}
function MiniCuotaStatus({ short, paid, dueDate }) {
  const d=daysUntil(dueDate), b="text-[11px] font-medium px-1.5 py-0.5 rounded";
  if (paid) return <span className={`${b} bg-emerald-100 text-emerald-700`}>{short}✓</span>;
  if (d===null) return <span className={`${b} bg-slate-100 text-slate-500`}>{short}</span>;
  if (d<0) return <span className={`${b} bg-red-100 text-red-700`}>{short}⚠</span>;
  if (d<=5) return <span className={`${b} bg-orange-100 text-orange-700`}>{short} {d}d</span>;
  return <span className={`${b} bg-slate-100 text-slate-500`}>{short}</span>;
}

// ─── Login & PIN ──────────────────────────────────────────────────────────────
function Login({ onAna, onColab }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-6">
      <div className="bg-amber-50 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-blue-900 flex items-center justify-center mb-4"><GraduationCap className="text-yellow-400" size={32}/></div>
        <h1 className="text-2xl font-bold text-blue-950">LUMEN Finanzas</h1>
        <p className="text-blue-900/60 text-sm mb-6">Educación con corazón</p>
        <div className="flex flex-col gap-3">
          <button onClick={onAna} className="flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white py-3 rounded-xl font-medium"><Lock size={18}/>Admin Ana</button>
          <button onClick={onColab} className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-medium"><Users size={18}/>Colaborador/a</button>
        </div>
      </div>
    </div>
  );
}
function PinScreen({ pin, onBack, onSuccess }) {
  const [val,setVal]=useState(''); const [err,setErr]=useState('');
  function submit() { if(val===pin) onSuccess(); else { setErr('PIN incorrecto'); setVal(''); } }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 to-slate-900 p-6">
      <div className="bg-amber-50 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-blue-900 flex items-center justify-center mb-4"><Lock className="text-yellow-400" size={26}/></div>
        <h2 className="text-lg font-bold text-blue-950 mb-4">PIN de Admin</h2>
        <input type="password" inputMode="numeric" value={val} onChange={e=>{setVal(e.target.value);setErr('');}} onKeyDown={e=>e.key==='Enter'&&submit()}
          className="w-full text-center text-2xl tracking-widest border-2 border-blue-200 focus:border-blue-500 outline-none rounded-lg py-2 mb-2" maxLength={6} autoFocus/>
        {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
        <div className="flex gap-2 mt-3">
          <button onClick={onBack} className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-600">Volver</button>
          <button onClick={submit} className="flex-1 py-2 rounded-lg bg-blue-900 text-white">Entrar</button>
        </div>
        <p className="text-xs text-slate-400 mt-4">PIN por defecto: 0000</p>
      </div>
    </div>
  );
}

// ─── Group Modal ──────────────────────────────────────────────────────────────
function GroupModal({ groups, onChange, onClose }) {
  const [list,setList]=useState([...groups]); const [newG,setNewG]=useState('');
  function addG() { if(!newG.trim()) return; setList([...list,newG.trim()]); setNewG(''); }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b"><h2 className="font-bold text-slate-800">Gestionar cursos</h2><button onClick={onClose}><X size={20} className="text-slate-400"/></button></div>
        <div className="p-4 space-y-2">
          {list.map((g,i)=>(<div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2"><Tag size={14} className="text-slate-400"/><span className="flex-1 text-sm">{g}</span><button onClick={()=>setList(list.filter((_,j)=>j!==i))} className="text-slate-300 hover:text-red-500"><X size={14}/></button></div>))}
          <div className="flex gap-2 mt-2"><input value={newG} onChange={e=>setNewG(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addG()} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" placeholder="Nuevo curso…"/><button onClick={addG} className="bg-blue-900 text-white px-3 py-1.5 rounded-lg">+</button></div>
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm">Cancelar</button>
          <button onClick={()=>{onChange(list);onClose();}} className="flex-1 py-2 bg-blue-900 text-white rounded-xl text-sm font-medium">Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Category Manager (inline) ────────────────────────────────────────────────
function CategoryManager({ title, color, categories, onChange }) {
  const [newCat,setNewCat]=useState('');
  function add() { const t=newCat.trim(); if(!t||categories.includes(t)) return; onChange([...categories,t]); setNewCat(''); }
  const pill = color==='green' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4">
      <p className="text-sm font-bold text-slate-700 mb-3">{title}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {categories.map(c=>(
          <span key={c} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${pill}`}>
            {c}<button onClick={()=>onChange(categories.filter(x=>x!==c))} className="opacity-60 hover:opacity-100 ml-0.5"><X size={11}/></button>
          </span>
        ))}
        {!categories.length&&<p className="text-xs text-slate-400">Sin categorías.</p>}
      </div>
      <div className="flex gap-2"><input value={newCat} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" placeholder="Nueva categoría…"/><button onClick={add} className="bg-blue-900 text-white px-3 py-1.5 rounded-lg text-sm">+</button></div>
    </div>
  );
}

// ─── Monthly Detail Modal ─────────────────────────────────────────────────────
function MonthlyDetailModal({ monthKey, payments, expenses, onClose }) {
  const mP = payments.filter(p=>(p.date||'').startsWith(monthKey));
  const mE = expenses.filter(e=>(e.date||'').startsWith(monthKey));
  const tI = _.sumBy(mP,'amount'), tG = _.sumBy(mE,'amount'), neto = tI-tG;
  const byInc = _(mP).groupBy(p=>p.category||'Sin categoría').map((items,cat)=>({cat,total:_.sumBy(items,'amount')})).orderBy(['total'],['desc']).value();
  const byExp = _(mE).groupBy(e=>e.category||'Sin categoría').map((items,cat)=>({cat,total:_.sumBy(items,'amount')})).orderBy(['total'],['desc']).value();

  function CatRow({ cat, total, base, color }) {
    const pct = base > 0 ? Math.round(total/base*100) : 0;
    const barColor = color==='green' ? 'bg-emerald-400' : 'bg-red-400';
    return (
      <div className="py-2 border-b border-slate-50 last:border-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-slate-700">{cat}</span>
          <div className="text-right"><p className="text-sm font-semibold text-slate-800">{cop(total)}</p><p className="text-xs text-slate-400">{pct}%</p></div>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full"><div className={`h-full ${barColor} rounded-full`} style={{width:`${pct}%`}}/></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800">{formatMonth(monthKey)}</h2>
          <button onClick={onClose}><X size={20} className="text-slate-400"/></button>
        </div>
        <div className="p-4 space-y-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-50 rounded-xl p-3"><p className="text-xs text-slate-400">Ingresos</p><p className="text-sm font-bold text-emerald-700">{cop(tI)}</p></div>
            <div className="bg-red-50 rounded-xl p-3"><p className="text-xs text-slate-400">Gastos</p><p className="text-sm font-bold text-red-600">{cop(tG)}</p></div>
            <div className={`${neto>=0?'bg-blue-50':'bg-red-50'} rounded-xl p-3`}><p className="text-xs text-slate-400">Neto</p><p className={`text-sm font-bold ${neto>=0?'text-blue-700':'text-red-600'}`}>{cop(neto)}</p></div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Ingresos por categoría</p>
            {!byInc.length && <p className="text-xs text-slate-400">Sin ingresos este mes.</p>}
            {byInc.map(({cat,total})=><CatRow key={cat} cat={cat} total={total} base={tI} color="green"/>)}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Gastos por categoría</p>
            {!byExp.length && <p className="text-xs text-slate-400">Sin gastos este mes.</p>}
            {byExp.map(({cat,total})=><CatRow key={cat} cat={cat} total={total} base={tG} color="red"/>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Student Form Modal ───────────────────────────────────────────────────────
function CuotaSection({ label, prefix, f, u, showPaid, showDue }) {
  return (
    <div className="border-t pt-3">
      <p className="text-xs font-semibold text-slate-600 mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-3">
        <Inp label="Monto (COP)" type="number" value={f[prefix+'a']} onChange={e=>u(prefix+'a',e.target.value)}/>
        <Inp label="Descuento/beca" type="number" value={f[prefix+'d']} onChange={e=>u(prefix+'d',e.target.value)}/>
        <Sel label="Método" options={METHODS} value={f[prefix+'m']} onChange={e=>u(prefix+'m',e.target.value)}/>
      </div>
      {showDue && <div className="mt-2"><Inp label="Fecha vencimiento" type="date" value={f[prefix+'due']} onChange={e=>u(prefix+'due',e.target.value)}/></div>}
      {showPaid && <label className="flex items-center gap-2 mt-2 text-sm text-slate-600"><input type="checkbox" checked={f[prefix+'p']} onChange={e=>u(prefix+'p',e.target.checked)}/>Ya está pagada</label>}
    </div>
  );
}
function StudentFormModal({ groups, onAdd, onClose }) {
  const [nc,setNc]=useState(2);
  const [f,setF]=useState({name:'',group:'',phone:'',waUsername:'',responsable:'',c1a:'',c1d:'0',c1p:false,c1m:'',c2a:'',c2d:'0',c2due:todayS(),c2m:'',c3a:'',c3d:'0',c3due:todayS(),c3m:'',notes:''});
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  function mkCuota(prefix,paid,hasDue){const a=parseFloat(f[prefix+'a'])||0,d=parseFloat(f[prefix+'d'])||0;return{amount:a,discount:d,paid,paidDate:paid?todayS():null,paidTime:paid?nowT():null,method:f[prefix+'m'],...(hasDue?{dueDate:f[prefix+'due']}:{})};}
  function submit(){if(!f.name)return;const c1=mkCuota('c1',f.c1p,false);const a1=(parseFloat(f.c1a)||0)-(parseFloat(f.c1d)||0);const s={id:uid(),name:f.name,group:f.group,phone:f.phone,waUsername:f.waUsername,responsable:f.responsable,numCuotas:nc,firstCuota:c1,notes:f.notes,receipts:[],paymentHistory:f.c1p?[{id:uid(),cuota:'Primera',amount:a1,method:f.c1m,date:todayS(),time:nowT()}]:[]};if(nc>=2)s.secondCuota=mkCuota('c2',false,true);if(nc>=3)s.thirdCuota=mkCuota('c3',false,true);onAdd(s);onClose();}
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10"><h2 className="font-bold text-slate-800">Nuevo estudiante</h2><button onClick={onClose}><X size={20} className="text-slate-400"/></button></div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Inp label="Nombre completo *" value={f.name} onChange={e=>u('name',e.target.value)} placeholder="Ej: Laura Gómez"/></div>
            <Sel label="Curso / nivel" options={groups} value={f.group} onChange={e=>u('group',e.target.value)}/>
            <Inp label="Responsable (papá/mamá)" value={f.responsable} onChange={e=>u('responsable',e.target.value)} placeholder="Si aplica"/>
            <Inp label="Teléfono WhatsApp" value={f.phone} onChange={e=>u('phone',e.target.value)} placeholder="3217297654"/>
            <Inp label="Usuario WhatsApp (@)" value={f.waUsername} onChange={e=>u('waUsername',e.target.value)} placeholder="@usuario"/>
          </div>
          <div className="border-t pt-3"><p className="text-xs font-semibold text-slate-600 mb-2">¿Cuántas cuotas?</p>
            <div className="flex gap-2">{[1,2,3].map(n=>(<button key={n} onClick={()=>setNc(n)} className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${nc===n?'bg-blue-900 text-white border-blue-900':'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{n} cuota{n>1?'s':''}</button>))}</div>
          </div>
          <CuotaSection label="Primera cuota" prefix="c1" f={f} u={u} showPaid showDue={false}/>
          {nc>=2&&<CuotaSection label="Segunda cuota" prefix="c2" f={f} u={u} showPaid={false} showDue/>}
          {nc>=3&&<CuotaSection label="Tercera cuota" prefix="c3" f={f} u={u} showPaid={false} showDue/>}
          <div className="border-t pt-3"><label className="text-xs text-slate-500 block mb-1">Notas iniciales</label><textarea value={f.notes} onChange={e=>u('notes',e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none resize-none" rows={2} placeholder="Acuerdos, situaciones especiales…"/></div>
        </div>
        <div className="p-4 border-t flex gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl">Cancelar</button>
          <button onClick={submit} className="flex-1 py-2 bg-blue-900 text-white rounded-xl font-medium">Agregar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Student Detail ───────────────────────────────────────────────────────────
function StudentDetailContent({ s, onToggleCuota, onUpdateNotes, onUpdateReceipts }) {
  const [tab,setTab]=useState('cuotas'); const [notes,setNotes]=useState(s.notes||''); const [receipts,setReceipts]=useState(null); const [uploading,setUploading]=useState(false); const fileRef=useRef();
  const cuotas=getCuotas(s);
  useEffect(()=>{if(tab==='comprobantes')loadRec();},[tab]);
  async function loadRec(){if(receipts!==null)return;try{const r=await window.storage.get(RP+s.id,true);setReceipts(r?JSON.parse(r.value):[]);}catch{setReceipts([]);}}
  function saveNotes(){onUpdateNotes(s.id,notes);}
  async function handleUpload(e){const files=Array.from(e.target.files);if(!files.length)return;setUploading(true);const cur=receipts||[],added=[];for(const file of files){const data=file.type.startsWith('image/')?await compressImg(file):await fileToB64(file);added.push({id:uid(),name:file.name,type:file.type,data,uploadedAt:todayS()+' '+nowT()});}const updated=[...cur,...added];setReceipts(updated);onUpdateReceipts(s.id,updated);setUploading(false);e.target.value='';}
  function delRec(id){const up=(receipts||[]).filter(r=>r.id!==id);setReceipts(up);onUpdateReceipts(s.id,up);}
  return (
    <div>
      <div className="flex border-b border-slate-100 px-4 overflow-x-auto">
        {[['cuotas','Cuotas'],['historial','Historial'],['notas','Notas'],['comprobantes','Comprobantes']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap mr-1 ${tab===id?'border-blue-600 text-blue-700':'border-transparent text-slate-500'}`}>{lbl}</button>
        ))}
      </div>
      <div className="p-4">
        {tab==='cuotas'&&(<div className="grid md:grid-cols-2 gap-3">{cuotas.map(({key,label,c})=>{const net=(c.amount||0)-(c.discount||0),hasDue=key!=='firstCuota';return(<div key={key} className="bg-slate-50 rounded-xl p-3"><p className="text-xs font-semibold text-slate-600 mb-1">{label} cuota</p><p className="text-xl font-bold text-slate-800">{cop(net)}{c.discount>0&&<span className="text-xs text-slate-400 ml-1 font-normal">(-{cop(c.discount)})</span>}</p>{c.method&&<p className="text-xs text-slate-400">{c.method}</p>}{hasDue&&c.dueDate&&<p className="text-xs text-slate-400">Vence: {fDate(c.dueDate)}</p>}{c.paid&&<p className="text-xs text-emerald-600 mt-1">✓ {fDate(c.paidDate)} {c.paidTime||''}</p>}<div className="mt-2"><CuotaBadge paid={c.paid} dueDate={hasDue?c.dueDate:null}/></div><button onClick={()=>onToggleCuota(s.id,key)} className={`mt-2 w-full py-1.5 text-xs rounded-lg font-medium ${c.paid?'bg-slate-200 text-slate-600':'bg-emerald-500 text-white hover:bg-emerald-600'}`}>{c.paid?'Desmarcar':'✓ Marcar como pagada'}</button></div>);})}</div>)}
        {tab==='historial'&&(<div>{!(s.paymentHistory||[]).length&&<p className="text-sm text-slate-400">Sin pagos.</p>}{(s.paymentHistory||[]).map(h=>(<div key={h.id} className="flex justify-between py-2 border-b border-slate-50 last:border-0 text-sm"><div><p className="font-medium text-slate-700">{h.cuota} cuota</p><p className="text-xs text-slate-400">{fDate(h.date)} {h.time||''} · {h.method||'—'}</p></div><span className="font-semibold text-emerald-700">{cop(h.amount)}</span></div>))}</div>)}
        {tab==='notas'&&(<div><textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={saveNotes} className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none resize-none" rows={5} placeholder="Acuerdos, retrasos, situaciones especiales…"/><button onClick={saveNotes} className="mt-2 text-xs bg-blue-900 text-white px-3 py-1.5 rounded-lg">Guardar</button></div>)}
        {tab==='comprobantes'&&(<div><div className="flex items-center gap-3 mb-3"><button onClick={()=>fileRef.current&&fileRef.current.click()} className="flex items-center gap-1 bg-blue-900 text-white text-xs px-3 py-2 rounded-lg"><Upload size={14}/>{uploading?'Subiendo…':'Subir comprobante'}</button><input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleUpload}/></div>{receipts===null&&<p className="text-sm text-slate-400">Cargando…</p>}{receipts!==null&&!receipts.length&&<p className="text-sm text-slate-400">Sin comprobantes.</p>}<div className="grid grid-cols-2 gap-2">{(receipts||[]).map(rc=>(<div key={rc.id} className="border rounded-lg overflow-hidden relative group">{rc.type&&rc.type.startsWith('image/')?(<a href={rc.data} target="_blank"><img src={rc.data} alt={rc.name} className="w-full h-28 object-cover"/></a>):(<a href={rc.data} download={rc.name} className="h-28 bg-slate-100 flex flex-col items-center justify-center gap-1 block"><FileText size={28} className="text-slate-400"/><p className="text-xs text-slate-500 px-2 truncate w-full text-center">{rc.name}</p></a>)}<div className="p-1.5"><p className="text-xs text-slate-400">{rc.uploadedAt}</p></div><button onClick={()=>delRec(rc.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100"><X size={11}/></button></div>))}</div></div>)}
      </div>
    </div>
  );
}
function StudentDetailModal({ student, allStudents, onClose, onToggleCuota, onUpdateNotes, onUpdateReceipts, onDelete }) {
  if(!student)return null;
  const s=allStudents.find(x=>x.id===student.id)||student;
  const uc=urgentCuota(s);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div><h2 className="font-bold text-slate-800">{s.name}</h2><p className="text-xs text-slate-400">{s.group||s.course||'—'}{s.responsable?` · ${s.responsable}`:''} · {s.numCuotas??2} cuota{(s.numCuotas??2)>1?'s':''}</p></div>
          <div className="flex items-center gap-2">
            {s.phone&&uc&&(<a href={waMsg(s.phone,s.name,uc.label,((uc.c.amount||0)-(uc.c.discount||0)),uc.c.dueDate)} target="_blank" className="flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-1.5 rounded-lg"><MessageCircle size={13}/>WA</a>)}
            {onDelete&&<button onClick={()=>{onDelete(s.id);onClose();}} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>}
            <button onClick={onClose}><X size={20} className="text-slate-400"/></button>
          </div>
        </div>
        <StudentDetailContent s={s} onToggleCuota={onToggleCuota} onUpdateNotes={onUpdateNotes} onUpdateReceipts={onUpdateReceipts}/>
      </div>
    </div>
  );
}

// ─── Admin: Dashboard ─────────────────────────────────────────────────────────
function AdminDashboard({ data }) {
  const [detailMonth, setDetailMonth] = useState(null);
  const byM={};
  data.payments.forEach(p=>{const m=(p.date||'').slice(0,7);if(!m)return;byM[m]=byM[m]||{month:m,Ingresos:0,Gastos:0};byM[m].Ingresos+=p.amount;});
  data.expenses.forEach(e=>{const m=(e.date||'').slice(0,7);if(!m)return;byM[m]=byM[m]||{month:m,Ingresos:0,Gastos:0};byM[m].Gastos+=e.amount;});
  const chart=_.orderBy(Object.values(byM),['month']).map(d=>({...d,Neto:d.Ingresos-d.Gastos}));
  const monthsDesc=_.orderBy(Object.values(byM),['month'],['desc']).map(d=>({...d,Neto:d.Ingresos-d.Gastos}));
  const tI=_.sumBy(data.payments,'amount'),tG=_.sumBy(data.expenses,'amount'),neto=tI-tG;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-500 rounded-2xl p-4 text-white shadow"><p className="text-xs opacity-80 mb-1">Ingresos</p><p className="text-xl font-bold">{cop(tI)}</p></div>
        <div className="bg-red-500 rounded-2xl p-4 text-white shadow"><p className="text-xs opacity-80 mb-1">Gastos</p><p className="text-xl font-bold">{cop(tG)}</p></div>
        <div className={`${neto>=0?'bg-blue-900':'bg-red-900'} rounded-2xl p-4 text-white shadow`}><p className="text-xs opacity-80 mb-1">Neto</p><p className="text-xl font-bold">{cop(neto)}</p></div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <p className="text-sm font-bold text-slate-700 mb-4">Ingresos · Gastos · Neto por mes</p>
        {chart.length===0?(
          <div className="py-12 text-center"><BarChart3 size={40} className="text-slate-200 mx-auto mb-2"/><p className="text-sm text-slate-400">Registra ingresos y gastos para ver el reporte</p></div>
        ):(
          <div style={{height:280}}><ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{top:5,right:10,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip formatter={(v,n)=>[cop(v),n]}/><Legend/>
              <Bar dataKey="Ingresos" fill="#10b981" radius={[4,4,0,0]}/><Bar dataKey="Gastos" fill="#ef4444" radius={[4,4,0,0]}/>
              <Line type="monotone" dataKey="Neto" stroke="#1e3a8a" strokeWidth={2.5} dot={{fill:'#1e3a8a',r:3}}/>
            </ComposedChart>
          </ResponsiveContainer></div>
        )}
      </div>

      {/* Reporte mensual */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <p className="text-sm font-bold text-slate-700 mb-3">Reporte mensual <span className="text-xs font-normal text-slate-400 ml-1">— toca un mes para ver el detalle</span></p>
        {monthsDesc.length===0 ? <p className="text-sm text-slate-400">Sin datos todavía.</p> : (
          <div className="space-y-2">
            {monthsDesc.map(m=>(
              <div key={m.month} onClick={()=>setDetailMonth(m.month)}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50/20 cursor-pointer transition-colors">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{formatMonth(m.month)}</p>
                  <p className="text-xs text-slate-400">↑ {cop(m.Ingresos)} · ↓ {cop(m.Gastos)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${m.Neto>=0?'text-emerald-600':'text-red-500'}`}>{cop(m.Neto)}</span>
                  <ChevronRight size={16} className="text-slate-300"/>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {detailMonth && <MonthlyDetailModal monthKey={detailMonth} payments={data.payments} expenses={data.expenses} onClose={()=>setDetailMonth(null)}/>}
    </div>
  );
}

// ─── MoneyForm & MoneyList ────────────────────────────────────────────────────
function MoneyForm({ fields, onAdd, submitLabel }) {
  const init={}; fields.forEach(f=>{init[f.name]=f.type==='date'?todayS():'';});
  const [form,setForm]=useState(init);
  function submit(){if(!form[fields[0].name]||!form.amount)return;onAdd({...form,amount:parseFloat(form.amount)||0,id:uid()});const r={};fields.forEach(f=>{r[f.name]=f.type==='date'?todayS():'';});setForm(r);}
  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(f=>(
          <div key={f.name} className={f.span?'col-span-2':''}>
            <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
            {f.options?(<select value={form[f.name]} onChange={e=>setForm({...form,[f.name]:e.target.value})} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 bg-white"><option value="">Seleccionar…</option>{f.options.map(o=><option key={o} value={o}>{o}</option>)}</select>)
            :(<input type={f.type||'text'} value={form[f.name]} onChange={e=>setForm({...form,[f.name]:e.target.value})} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" placeholder={f.placeholder||''}/>)}
          </div>
        ))}
      </div>
      <button onClick={submit} className="mt-3 flex items-center gap-1 bg-blue-900 hover:bg-blue-800 text-white text-sm px-4 py-2 rounded-lg"><Plus size={16}/>{submitLabel}</button>
    </div>
  );
}
function MoneyList({ items, onDelete, onDuplicate, labelKey }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {!items.length&&<p className="text-sm text-slate-400 p-4">Sin registros.</p>}
      {_.orderBy(items,['date'],['desc']).map(item=>{
        const mainLabel = item[labelKey]||item.category||'—';
        const showCatBadge = item.category && item[labelKey] && item[labelKey]!==item.category;
        return (
          <div key={item.id} className="flex justify-between items-center px-4 py-3 border-b border-slate-50 last:border-0 text-sm">
            <div className="min-w-0 flex-1 pr-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-slate-700 truncate">{mainLabel}</p>
                {showCatBadge && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full shrink-0">{item.category}</span>}
              </div>
              <p className="text-xs text-slate-400">{fDate(item.date)}{item.method?` · ${item.method}`:''}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-semibold text-slate-800">{cop(item.amount)}</span>
              <button onClick={()=>onDuplicate(item)} className="text-slate-300 hover:text-blue-500" title="Duplicar registro"><Copy size={14}/></button>
              <button onClick={()=>onDelete(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Admin: Estudiantes ───────────────────────────────────────────────────────
function CourseCards({ data, onSelect }) {
  const [search, setSearch] = useState('');
  const groups=[...(data.groups||[])];
  if(data.students.some(s=>!s.group&&!s.course)) groups.push('Sin curso');
  const q=search.trim().toLowerCase();
  const results=q?data.students.filter(s=>s.name.toLowerCase().includes(q)||(s.phone||'').includes(q)||(s.group||s.course||'').toLowerCase().includes(q)||(s.waUsername||'').toLowerCase().includes(q)||(s.responsable||'').toLowerCase().includes(q)):[];
  return (
    <div>
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 bg-white shadow-sm" placeholder="Buscar estudiante por nombre, teléfono, curso…"/>
        {search&&<button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14}/></button>}
      </div>
      {q?(
        <div>
          <p className="text-xs text-slate-400 mb-3">{results.length} resultado{results.length!==1?'s':''} para "{search}"</p>
          {!results.length&&<div className="py-10 text-center bg-white rounded-2xl border"><p className="text-sm text-slate-400">Sin resultados.</p></div>}
          <div className="space-y-2">{results.map(s=>{const {paid,balance}=studentTotals(s),cuotas=getCuotas(s);return(<div key={s.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3"><div><p className="font-semibold text-slate-800 text-sm">{s.name}</p><p className="text-xs text-slate-400">{s.group||s.course||'Sin curso'}{s.responsable?` · ${s.responsable}`:''}</p>{s.phone&&<p className="text-xs text-slate-400">{s.phone}</p>}<div className="flex gap-1 mt-1 flex-wrap">{cuotas.map(({key,short,c})=>(<MiniCuotaStatus key={key} short={short} paid={c.paid} dueDate={key!=='firstCuota'?c.dueDate:null}/>))}</div></div><div className="text-right shrink-0"><p className="text-sm font-bold text-emerald-600">{cop(paid)}</p>{balance>0&&<p className="text-xs text-red-500">{cop(balance)} pend.</p>}</div></div>);})}</div>
        </div>
      ):(
        <div>
          <p className="text-xs text-slate-400 mb-4">Selecciona un curso para ver su tabla</p>
          {!groups.length&&<div className="py-16 text-center bg-white rounded-2xl border"><Users size={40} className="text-slate-200 mx-auto mb-2"/><p className="text-sm text-slate-400">No hay cursos. Créalos en Ajustes.</p></div>}
          <div className="grid grid-cols-2 gap-3">{groups.map(g=>{const sts=data.students.filter(s=>(s.group||s.course||'Sin curso')===g);const alerts=sts.filter(s=>{const d=alertDays(s);return d!==null&&d<=5&&getCuotas(s).some(({c})=>!c.paid&&c.dueDate);}).length;const rec=sts.reduce((sum,s)=>sum+studentTotals(s).paid,0);const allPaid=sts.filter(s=>getCuotas(s).every(({c})=>c.paid)).length;return(<button key={g} onClick={()=>onSelect(g)} className="bg-white rounded-2xl border border-slate-200 p-4 text-left hover:border-blue-400 hover:shadow-md transition-all group"><div className="flex items-start justify-between mb-2"><span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 leading-snug">{g}</span>{alerts>0&&<span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full shrink-0 ml-1">{alerts}⚠</span>}</div><p className="text-3xl font-bold text-slate-800">{sts.length}</p><p className="text-xs text-slate-400 mb-3">estudiantes</p><div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-1"><div><p className="text-xs text-slate-400">Al día</p><p className="text-sm font-semibold text-emerald-600">{allPaid}/{sts.length}</p></div><div className="text-right"><p className="text-xs text-slate-400">Recaudado</p><p className="text-sm font-semibold text-slate-700">{cop(rec)}</p></div></div></button>);})}</div>
        </div>
      )}
    </div>
  );
}
function CourseTable({ group, allStudents, onBack, onToggleCuota, onUpdateNotes, onUpdateReceipts, onDelete }) {
  const [detail,setDetail]=useState(null);
  const [search,setSearch]=useState('');
  const allSts=_.orderBy(allStudents.filter(s=>(s.group||s.course||'Sin curso')===group),['name']);
  const q=search.trim().toLowerCase();
  const sts=q?allSts.filter(s=>s.name.toLowerCase().includes(q)||(s.phone||'').includes(q)||(s.responsable||'').toLowerCase().includes(q)||(s.waUsername||'').toLowerCase().includes(q)):allSts;
  const totPaid=allSts.reduce((sum,s)=>sum+studentTotals(s).paid,0);
  const totBal=allSts.reduce((sum,s)=>sum+studentTotals(s).balance,0);
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-700 font-medium"><ArrowLeft size={16}/>Cursos</button>
        <span className="text-slate-300">/</span><h2 className="font-bold text-slate-800">{group}</h2>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{allSts.length} est.</span>
      </div>
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 bg-white shadow-sm" placeholder={`Buscar en ${group}…`}/>
        {search&&<button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14}/></button>}
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-3 shadow-sm"><p className="text-xs text-slate-400">Estudiantes</p><p className="text-2xl font-bold text-slate-800">{allSts.length}</p></div>
        <div className="bg-white rounded-xl border p-3 shadow-sm"><p className="text-xs text-slate-400">Recaudado</p><p className="text-xl font-bold text-emerald-600">{cop(totPaid)}</p></div>
        <div className="bg-white rounded-xl border p-3 shadow-sm"><p className="text-xs text-slate-400">Saldo pendiente</p><p className="text-xl font-bold text-red-500">{cop(totBal)}</p></div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white text-xs">
              <tr><th className="px-3 py-3 text-left font-medium">#</th><th className="px-3 py-3 text-left font-medium">Estudiante</th><th className="px-3 py-3 text-center font-medium">Estado cuotas</th><th className="px-3 py-3 text-right font-medium">Pagado</th><th className="px-3 py-3 text-right font-medium">Saldo</th><th className="px-3 py-3 text-center font-medium"></th></tr>
            </thead>
            <tbody>
              {!sts.length&&<tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{search?'Sin resultados.':'No hay estudiantes en este curso.'}</td></tr>}
              {sts.map((s,i)=>{const {paid,balance}=studentTotals(s),cuotas=getCuotas(s),d=alertDays(s),urgent=d!==null&&d<=5&&cuotas.some(({c})=>!c.paid&&c.dueDate),allPd=cuotas.every(({c})=>c.paid),uc=urgentCuota(s);return(
                <tr key={s.id} className={`border-t border-slate-100 hover:bg-blue-50/30 transition-colors ${urgent?'bg-orange-50':allPd?'bg-emerald-50/20':''}`}>
                  <td className="px-3 py-3 text-slate-400 text-xs">{i+1}</td>
                  <td className="px-3 py-3"><p className="font-semibold text-slate-800">{s.name}</p>{s.responsable&&<p className="text-xs text-slate-400">{s.responsable}</p>}{s.phone&&<p className="text-xs text-slate-400">{s.phone}</p>}</td>
                  <td className="px-3 py-3"><div className="flex gap-1 flex-wrap justify-center">{cuotas.map(({key,short,c})=>(<MiniCuotaStatus key={key} short={short} paid={c.paid} dueDate={key!=='firstCuota'?c.dueDate:null}/>))}</div></td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-700">{cop(paid)}</td>
                  <td className="px-3 py-3 text-right"><span className={`font-semibold ${balance>0?'text-red-600':'text-slate-300'}`}>{cop(balance)}</span></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-1 justify-center">{s.phone&&uc&&(<a href={waMsg(s.phone,s.name,uc.label,((uc.c.amount||0)-(uc.c.discount||0)),uc.c.dueDate)} target="_blank" className="bg-green-500 text-white p-1.5 rounded-lg" title="WhatsApp"><MessageCircle size={13}/></a>)}<button onClick={()=>setDetail(s)} className="bg-blue-100 text-blue-700 p-1.5 rounded-lg" title="Ver detalle"><MoreHorizontal size={13}/></button></div></td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>
      {detail&&<StudentDetailModal student={detail} allStudents={allStudents} onClose={()=>setDetail(null)} onToggleCuota={onToggleCuota} onUpdateNotes={onUpdateNotes} onUpdateReceipts={onUpdateReceipts} onDelete={onDelete}/>}
    </div>
  );
}
function AdminEstudiantes({ data, onAddStudent, onToggleCuota, onUpdateNotes, onUpdateReceipts, onDeleteStudent }) {
  const [course,setCourse]=useState(null); const [showForm,setShowForm]=useState(false);
  return (<div>{course===null?<CourseCards data={data} onSelect={setCourse}/>:<CourseTable group={course} allStudents={data.students} onBack={()=>setCourse(null)} onToggleCuota={onToggleCuota} onUpdateNotes={onUpdateNotes} onUpdateReceipts={onUpdateReceipts} onDelete={onDeleteStudent}/>}<button onClick={()=>setShowForm(true)} className="fixed bottom-6 right-6 bg-blue-900 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:bg-blue-800 z-30"><Plus size={24}/></button>{showForm&&<StudentFormModal groups={data.groups||[]} onAdd={s=>{onAddStudent(s);setShowForm(false);}} onClose={()=>setShowForm(false)}/>}</div>);
}

// ─── Alertas ──────────────────────────────────────────────────────────────────
function AlertasPage({ data, onToggleCuota, onUpdateNotes, onUpdateReceipts }) {
  const [detail,setDetail]=useState(null);
  const pending=data.students.filter(s=>getCuotas(s).some(({c})=>!c.paid)).map(s=>({...s,d:alertDays(s)??9999})).sort((a,b)=>a.d-b.d);
  return (
    <div>
      <h2 className="font-bold text-slate-800 mb-3">Alertas de cuotas pendientes</h2>
      {!pending.length&&<div className="bg-white rounded-xl border p-10 text-center text-slate-400 text-sm">¡Sin cuotas pendientes! 🎉</div>}
      <div className="space-y-2">{pending.map(s=>{const uc=urgentCuota(s),d=uc?uc.days:null,col=d!==null&&d<0?'border-red-300 bg-red-50':d!==null&&d<=5?'border-orange-300 bg-orange-50':'border-slate-100 bg-white',cuotas=getCuotas(s);return(<div key={s.id} className={`rounded-xl border p-4 ${col}`}><div className="flex justify-between items-start gap-2"><div><p className="font-semibold text-slate-800">{s.name}</p>{(s.group||s.course)&&<p className="text-xs text-slate-500">{s.group||s.course}</p>}{s.responsable&&<p className="text-xs text-slate-400 flex items-center gap-1"><User size={10}/>{s.responsable}</p>}{s.phone&&<p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Phone size={10}/>{s.phone}</p>}<div className="flex gap-1 mt-2 flex-wrap">{cuotas.map(({key,short,c})=>(<MiniCuotaStatus key={key} short={short} paid={c.paid} dueDate={key!=='firstCuota'?c.dueDate:null}/>))}</div></div><div className="text-right shrink-0 space-y-1.5">{uc&&<><p className="text-sm font-bold text-slate-700">{cop((uc.c.amount||0)-(uc.c.discount||0))}</p><CuotaBadge paid={false} dueDate={uc.c.dueDate}/></>}<div className="flex gap-1 justify-end mt-1">{s.phone&&uc&&(<a href={waMsg(s.phone,s.name,uc.label,((uc.c.amount||0)-(uc.c.discount||0)),uc.c.dueDate)} target="_blank" className="flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-1.5 rounded-lg"><MessageCircle size={11}/>WA</a>)}{onToggleCuota&&<button onClick={()=>setDetail(s)} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-1.5 rounded-lg"><MoreHorizontal size={11}/>Ver</button>}</div></div></div></div>);})}</div>
      {detail&&onToggleCuota&&<StudentDetailModal student={detail} allStudents={data.students} onClose={()=>setDetail(null)} onToggleCuota={onToggleCuota} onUpdateNotes={onUpdateNotes} onUpdateReceipts={onUpdateReceipts}/>}
    </div>
  );
}

// ─── Admin: Ajustes ───────────────────────────────────────────────────────────
function AdminAjustes({ data, pin, onChangePin, onUpdateGroups, onUpdateIncCats, onUpdateExpCats }) {
  const [showG,setShowG]=useState(false);
  const [cur,setCur]=useState(''); const [nxt,setNxt]=useState(''); const [msg,setMsg]=useState('');
  function submitPin(){if(cur!==pin){setMsg('PIN actual incorrecto');return;}if(nxt.length<4){setMsg('Mínimo 4 dígitos');return;}onChangePin(nxt);setMsg('✅ PIN actualizado');setCur('');setNxt('');}
  return (
    <div className="space-y-4">
      <h2 className="font-bold text-slate-800">Ajustes</h2>
      {/* Cursos */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3"><p className="text-sm font-bold text-slate-700">Cursos / Grupos</p><button onClick={()=>setShowG(true)} className="flex items-center gap-1 bg-blue-900 text-white text-xs px-3 py-2 rounded-lg"><Tag size={13}/>Gestionar</button></div>
        <div className="flex flex-wrap gap-2">{(data.groups||[]).map(g=><span key={g} className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full">{g}</span>)}{!(data.groups||[]).length&&<p className="text-sm text-slate-400">Sin cursos.</p>}</div>
      </div>
      {/* Categorías */}
      <CategoryManager title="Categorías de ingresos" color="green" categories={data.incomeCategories||DEF_INC} onChange={onUpdateIncCats}/>
      <CategoryManager title="Categorías de gastos" color="red" categories={data.expenseCategories||DEF_EXP} onChange={onUpdateExpCats}/>
      {/* PIN */}
      <div className="bg-white rounded-2xl shadow-sm border p-4 max-w-sm">
        <p className="text-sm font-bold text-slate-700 mb-3">Cambiar PIN de admin</p>
        <div className="space-y-2"><Inp label="PIN actual" type="password" value={cur} onChange={e=>setCur(e.target.value)}/><Inp label="Nuevo PIN (mínimo 4 dígitos)" type="password" value={nxt} onChange={e=>setNxt(e.target.value)}/></div>
        {msg&&<p className="text-sm text-blue-700 mt-2">{msg}</p>}
        <button onClick={submitPin} className="mt-3 bg-blue-900 text-white px-4 py-2 rounded-lg text-sm">Guardar</button>
      </div>
      {showG&&<GroupModal groups={data.groups||[]} onChange={onUpdateGroups} onClose={()=>setShowG(false)}/>}
    </div>
  );
}

// ─── Colab ────────────────────────────────────────────────────────────────────
function ColabEstudiantes({ groups, onAddStudent }) {
  const [showForm,setShowForm]=useState(false); const [added,setAdded]=useState([]);
  function handleAdd(s){onAddStudent(s);setAdded(p=>[s,...p].slice(0,5));}
  return (
    <div>
      <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-slate-800">Agregar estudiante</h2><button onClick={()=>setShowForm(true)} className="flex items-center gap-2 bg-blue-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-800"><Plus size={16}/>Nuevo</button></div>
      {!added.length&&<div className="py-16 text-center bg-white rounded-2xl border"><div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3"><Users size={28} className="text-blue-700"/></div><p className="text-slate-500">Presiona el botón para registrar un estudiante</p></div>}
      {added.length>0&&<div className="space-y-2">{added.map(s=><div key={s.id} className="bg-white rounded-xl border p-3 flex items-center gap-3"><div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0"><CheckCircle2 size={16} className="text-emerald-600"/></div><div><p className="font-medium text-slate-800 text-sm">{s.name}</p><p className="text-xs text-slate-400">{s.group||'Sin curso'} · {s.numCuotas} cuota{s.numCuotas>1?'s':''}</p></div></div>)}</div>}
      {showForm&&<StudentFormModal groups={groups||[]} onAdd={s=>{handleAdd(s);setShowForm(false);}} onClose={()=>setShowForm(false)}/>}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loading,setLoading]=useState(true); const [data,setData]=useState(emptyData);
  const [pin,setPin]=useState(PIN0); const [user,setUser]=useState(null);
  const [askPin,setAskPin]=useState(false); const [tab,setTab]=useState('');

  useEffect(()=>{
    (async()=>{
      try{const r=await window.storage.get(SK,true);if(r?.value){const l=JSON.parse(r.value);setData({...emptyData,...l,groups:l.groups||emptyData.groups,incomeCategories:l.incomeCategories||emptyData.incomeCategories,expenseCategories:l.expenseCategories||emptyData.expenseCategories});}}catch{}
      try{const r=await window.storage.get(PK,true);if(r?.value)setPin(r.value);}catch{}
      setLoading(false);
    })();
  },[]);

  async function persist(d){setData(d);try{await window.storage.set(SK,JSON.stringify(d),true);}catch{}}
  async function changePin(p){setPin(p);try{await window.storage.set(PK,p,true);}catch{}}

  const isAdmin=user==='ana';
  const addPayment=p=>persist({...data,payments:[...data.payments,p]});
  const delPayment=id=>persist({...data,payments:data.payments.filter(p=>p.id!==id)});
  const dupPayment=item=>persist({...data,payments:[...data.payments,{...item,id:uid(),date:todayS()}]});
  const addExpense=e=>persist({...data,expenses:[...data.expenses,e]});
  const delExpense=id=>persist({...data,expenses:data.expenses.filter(e=>e.id!==id)});
  const dupExpense=item=>persist({...data,expenses:[...data.expenses,{...item,id:uid(),date:todayS()}]});
  const addStudent=s=>persist({...data,students:[...data.students,s]});
  const delStudent=id=>persist({...data,students:data.students.filter(s=>s.id!==id)});
  const updateGroups=g=>persist({...data,groups:g});
  const updateIncCats=c=>persist({...data,incomeCategories:c});
  const updateExpCats=c=>persist({...data,expenseCategories:c});
  const updateNotes=(id,notes)=>persist({...data,students:data.students.map(s=>s.id===id?{...s,notes}:s)});
  async function updateReceipts(sid,recs){try{await window.storage.set(RP+sid,JSON.stringify(recs),true);}catch{}const m=recs.map(({id,name,type,uploadedAt})=>({id,name,type,uploadedAt}));persist({...data,students:data.students.map(s=>s.id===sid?{...s,receipts:m}:s)});}

  function toggleCuota(sid,key){
    let payments=[...data.payments];
    const meta=CUOTA_KEYS.find(x=>x.key===key)||{label:'Cuota',tag:'cuota'};
    const students=data.students.map(s=>{
      if(s.id!==sid)return s;
      const wasPaid=s[key].paid,c=s[key],net=(c.amount||0)-(c.discount||0);
      let hist=[...(s.paymentHistory||[])];
      if(!wasPaid){hist=[...hist,{id:uid(),cuota:meta.label,amount:net,method:c.method,date:todayS(),time:nowT()}];payments=[...payments,{id:uid(),date:todayS(),amount:net,concept:`${meta.label} cuota - ${s.name}`,method:c.method||'Cuota',source:meta.tag,studentId:sid}];}
      else{hist=hist.filter(h=>h.cuota!==meta.label);payments=payments.filter(p=>!(p.studentId===sid&&p.source===meta.tag));}
      return {...s,[key]:{...c,paid:!wasPaid,paidDate:!wasPaid?todayS():null,paidTime:!wasPaid?nowT():null},paymentHistory:hist};
    });
    persist({...data,students,payments});
  }

  const alertCount=data.students.filter(s=>{const d=alertDays(s);return d!==null&&d<=5&&getCuotas(s).some(({c})=>!c.paid&&c.dueDate);}).length;

  if(loading) return <div className="min-h-screen flex items-center justify-center bg-amber-50"><p className="text-slate-400">Cargando…</p></div>;
  if(askPin) return <PinScreen pin={pin} onBack={()=>setAskPin(false)} onSuccess={()=>{setUser('ana');setAskPin(false);setTab('dashboard');}}/>;
  if(!user)  return <Login onAna={()=>setAskPin(true)} onColab={()=>{setUser('colab');setTab('estudiantes');}}/>;

  const adminTabs=[{id:'dashboard',label:'Reportes',icon:BarChart3},{id:'ingresos',label:'Ingresos',icon:TrendingUp},{id:'gastos',label:'Gastos',icon:TrendingDown},{id:'estudiantes',label:'Estudiantes',icon:Users},{id:'alertas',label:'Alertas',icon:Bell},{id:'ajustes',label:'Ajustes',icon:Settings}];
  const colabTabs=[{id:'estudiantes',label:'Estudiantes',icon:Users},{id:'alertas',label:'Alertas',icon:Bell}];
  const tabs=isAdmin?adminTabs:colabTabs;
  const cur=tab||tabs[0].id;

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-blue-950 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2"><GraduationCap className="text-yellow-400" size={22}/><span className="font-bold">LUMEN Finanzas</span></div>
        <div className="flex items-center gap-2 text-sm"><span className="text-blue-200 hidden sm:inline">{isAdmin?'Admin Ana':'Colaborador/a'}</span><button onClick={()=>{setUser(null);setAskPin(false);setTab('');}} className="flex items-center gap-1 bg-blue-900 hover:bg-blue-800 px-2.5 py-1.5 rounded-lg"><LogOut size={14}/>Salir</button></div>
      </header>
      <nav className="bg-white border-b border-slate-200 px-2 py-2 flex gap-1 overflow-x-auto sticky top-[52px] z-10">
        {tabs.map(t=>{const Icon=t.icon,active=cur===t.id;return(<button key={t.id} onClick={()=>setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${active?'bg-blue-900 text-white':'text-slate-600 hover:bg-slate-100'}`}><Icon size={15}/>{t.label}{t.id==='alertas'&&alertCount>0&&<span className="bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{alertCount}</span>}</button>);})}
      </nav>
      <main className="p-4 max-w-4xl mx-auto pb-24">
        {cur==='dashboard'&&isAdmin&&<AdminDashboard data={data}/>}
        {cur==='ingresos'&&isAdmin&&(
          <div>
            <h2 className="font-bold text-slate-800 mb-3">Ingresos</h2>
            <MoneyForm submitLabel="Agregar ingreso" fields={[
              {name:'concept',label:'Descripción',placeholder:'Ej: Simulacro Laura García',span:true},
              {name:'category',label:'Categoría',options:data.incomeCategories||DEF_INC},
              {name:'amount',label:'Monto (COP)',type:'number'},
              {name:'method',label:'Método de pago',options:METHODS},
              {name:'date',label:'Fecha',type:'date'},
            ]} onAdd={addPayment}/>
            <MoneyList items={data.payments} onDelete={delPayment} onDuplicate={dupPayment} labelKey="concept"/>
          </div>
        )}
        {cur==='gastos'&&isAdmin&&(
          <div>
            <h2 className="font-bold text-slate-800 mb-3">Gastos</h2>
            <MoneyForm submitLabel="Agregar gasto" fields={[
              {name:'description',label:'Descripción',placeholder:'Ej: Facebook Ads octubre',span:true},
              {name:'category',label:'Categoría',options:data.expenseCategories||DEF_EXP},
              {name:'amount',label:'Monto (COP)',type:'number'},
              {name:'method',label:'Método de pago',options:METHODS},
              {name:'date',label:'Fecha',type:'date'},
            ]} onAdd={addExpense}/>
            <MoneyList items={data.expenses} onDelete={delExpense} onDuplicate={dupExpense} labelKey="description"/>
          </div>
        )}
        {cur==='estudiantes'&&isAdmin&&<AdminEstudiantes data={data} onAddStudent={addStudent} onToggleCuota={toggleCuota} onUpdateNotes={updateNotes} onUpdateReceipts={updateReceipts} onDeleteStudent={delStudent}/>}
        {cur==='estudiantes'&&!isAdmin&&<ColabEstudiantes groups={data.groups} onAddStudent={addStudent}/>}
        {cur==='alertas'&&<AlertasPage data={data} onToggleCuota={isAdmin?toggleCuota:null} onUpdateNotes={isAdmin?updateNotes:null} onUpdateReceipts={isAdmin?updateReceipts:null}/>}
        {cur==='ajustes'&&isAdmin&&<AdminAjustes data={data} pin={pin} onChangePin={changePin} onUpdateGroups={updateGroups} onUpdateIncCats={updateIncCats} onUpdateExpCats={updateExpCats}/>}
      </main>
    </div>
  );
}