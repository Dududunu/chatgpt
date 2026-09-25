import { useEffect, useRef, useState } from "react";
import { db } from "./db";
import type { ActiveWorkout, BodyEntry, SetLog, Settings, WorkoutHistory, WorkoutTemplate } from "./types";
import { actual1rm, bestE1rm, e1rm, volume } from "./stats";
import { exerciseSubstitutions } from "./seed";

type Tab="train"|"history"|"progress"|"body"|"more";
const uid=()=>crypto.randomUUID();
const fmtDuration=(sec:number)=>{const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60; return h?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`};
const fmtDate=(t:number)=>new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"short",year:"numeric"}).format(t);
const parseNum=(v:string)=>{const n=Number(v.replace(",","."));return Number.isFinite(n)?n:null};

export default function App(){
 const [tab,setTab]=useState<Tab>("train");
 const [templates,setTemplates]=useState<WorkoutTemplate[]>([]);
 const [workouts,setWorkouts]=useState<WorkoutHistory[]>([]);
 const [active,setActive]=useState<ActiveWorkout|null>(null);
 const [settings,setSettings]=useState<Settings|null>(null);
 const [body,setBody]=useState<BodyEntry[]>([]);
 const [now,setNow]=useState(Date.now());
 const [toast,setToast]=useState("");
 const audioRef=useRef<HTMLAudioElement|null>(null);

 async function refresh(){
  setTemplates(await db.templates.toArray());
  setWorkouts(await db.workouts.orderBy("startedAt").reverse().toArray());
  setActive((await db.active.toArray())[0]||null);
  setSettings((await db.settings.get("main"))||null);
  setBody(await db.body.orderBy("date").reverse().toArray());
 }
 useEffect(()=>{refresh();const id=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(id)},[]);
 useEffect(()=>{
  if(!active?.rest) return;
  const remaining=active.rest.endsAt-now;
  if(remaining<=0 && !active.rest.pausedRemaining){
   if(settings?.vibration && navigator.vibrate) navigator.vibrate([80,60,80]);
   if(settings?.sound && audioRef.current) audioRef.current.play().catch(()=>{});
  }
 },[active?.rest?.endsAt,now,settings?.sound,settings?.vibration]);

 const notify=(s:string)=>{setToast(s);setTimeout(()=>setToast(""),2200)};

 async function startWorkout(t:WorkoutTemplate){
  if(active) return;
  const w:ActiveWorkout={id:uid(),templateId:t.id,name:t.name,startedAt:Date.now(),rest:null,
   exercises:t.exercises.map(ex=>({templateExerciseId:ex.id,name:ex.name,target:{...ex},sets:Array.from({length:ex.sets},(_,i)=>({id:uid(),setNo:i+1,weight:null,reps:null,rir:null,completedAt:null}))}))};
  await db.active.put(w);setActive(w);
 }
 async function persistActive(w:ActiveWorkout){await db.active.put(w);setActive({...w});}
 async function setField(ei:number,si:number,field:"weight"|"reps"|"rir",value:string){
  if(!active)return; const w=structuredClone(active); const s=w.exercises[ei].sets[si];
  (s as any)[field]=value===""?null:parseNum(value); await persistActive(w);
 }
 async function completeSet(ei:number,si:number){
  if(!active)return;
  const w=structuredClone(active), ex=w.exercises[ei], s=ex.sets[si];
  if(s.completedAt) return;
  if(!s.weight || !s.reps){notify("Wpisz ciężar i powtórzenia");return}
  s.completedAt=Date.now();
  const oldBest=bestE1rm(workouts,ex.name),newE=e1rm(s.weight,s.reps);
  if(newE>oldBest && oldBest>0) notify(`Nowy e1RM PR • ${newE.toFixed(1)} kg`);
  if(settings?.autoRest!==false){
   const startedAt=Date.now(), endsAt=startedAt+ex.target.restSec*1000;
   s.restStartedAt=startedAt;s.restEndsAt=endsAt;
   w.rest={exerciseName:ex.name,nextSet:Math.min(si+2,ex.sets.length),startedAt,endsAt};
  }
  await persistActive(w);
 }
 async function adjustRest(delta:number){if(!active?.rest)return;const w=structuredClone(active);w.rest!.endsAt=Math.max(Date.now(),w.rest!.endsAt+delta*1000);await persistActive(w)}
 async function skipRest(){if(!active)return;const w=structuredClone(active);w.rest=null;await persistActive(w)}
 async function pauseRest(){if(!active?.rest)return;const w=structuredClone(active);if(w.rest!.pausedRemaining){w.rest!.endsAt=Date.now()+w.rest!.pausedRemaining;delete w.rest!.pausedRemaining}else w.rest!.pausedRemaining=Math.max(0,w.rest!.endsAt-Date.now());await persistActive(w)}
 async function finishWorkout(){
  if(!active)return;const incomplete=active.exercises.flatMap(e=>e.sets).filter(s=>!s.completedAt).length;
  if(incomplete && !confirm(`${incomplete} niewykonanych serii. Zakończyć mimo to?`))return;
  const done:WorkoutHistory={...structuredClone(active),endedAt:Date.now(),rest:null};
  await db.transaction("rw",db.workouts,db.active,async()=>{await db.workouts.put(done);await db.active.delete(active.id)});
  setActive(null);await refresh();setTab("history");
 }
 async function discard(){if(active&&confirm("Usunąć aktywny trening?")){await db.active.delete(active.id);setActive(null)}}
 function previousSet(name:string,setNo:number){for(const w of workouts){const ex=w.exercises.find(x=>x.name===name);const s=ex?.sets.find(x=>x.setNo===setNo&&x.completedAt);if(s)return s}return null}
 async function addBody(fd:FormData){
  const ent:BodyEntry={id:uid(),date:Date.now()};
  for(const k of ["weight","waist","chest","arm"] as const){const v=String(fd.get(k)||"");const n=parseNum(v);if(n!=null)(ent as any)[k]=n}
  ent.note=String(fd.get("note")||"");await db.body.put(ent);await refresh();notify("Pomiar zapisany");
 }
 async function exportJson(){
  const data={version:1,exportedAt:new Date().toISOString(),templates:await db.templates.toArray(),workouts:await db.workouts.toArray(),body:await db.body.toArray(),settings:await db.settings.toArray(),active:await db.active.toArray()};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download=`gym-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
 }
 async function importJson(file:File){
  try{const d=JSON.parse(await file.text());if(!Array.isArray(d.workouts)||!Array.isArray(d.templates))throw new Error();
   if(!confirm(`Import: ${d.workouts.length} treningów. Nadpisać lokalne dane?`))return;
   await db.transaction("rw",db.templates,db.workouts,db.body,db.settings,db.active,async()=>{await Promise.all([db.templates.clear(),db.workouts.clear(),db.body.clear(),db.settings.clear(),db.active.clear()]);await db.templates.bulkPut(d.templates);if(d.workouts?.length)await db.workouts.bulkPut(d.workouts);if(d.body?.length)await db.body.bulkPut(d.body);if(d.settings?.length)await db.settings.bulkPut(d.settings);if(d.active?.length)await db.active.bulkPut(d.active)});
   await refresh();notify("Backup przywrócony");
  }catch{notify("Nieprawidłowy plik backupu")}
 }
 async function exportCsv(){
  const rows=[["date","workout","exercise","set","kg","reps","rir","e1rm"]];
  for(const w of workouts)for(const e of w.exercises)for(const s of e.sets)if(s.completedAt)rows.push([new Date(w.startedAt).toISOString(),w.name,e.name,String(s.setNo),String(s.weight??""),String(s.reps??""),String(s.rir??""),s.weight&&s.reps?e1rm(s.weight,s.reps).toFixed(2):""]);
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="gym-history.csv";a.click();URL.revokeObjectURL(a.href);
 }
 const restRemaining=active?.rest ? (active.rest.pausedRemaining??Math.max(0,active.rest.endsAt-now)) : 0;
 return <div className="app">
  <audio ref={audioRef} preload="auto" />
  <header className="topbar"><div><span className="eyebrow">GYM</span><h1>{active?active.name:tab==="train"?"Trening":tab==="history"?"Historia":tab==="progress"?"Progres":tab==="body"?"Ciało":"Więcej"}</h1></div>{active&&<button className="finish" onClick={finishWorkout}>Zakończ</button>}</header>
  <main>
   {tab==="train" && (active?<ActiveView active={active} now={now} previousSet={previousSet} setField={setField} completeSet={completeSet} discard={discard}/>:<TrainHome templates={templates} workouts={workouts} startWorkout={startWorkout}/>)}
   {tab==="history"&&<History workouts={workouts}/>}
   {tab==="progress"&&<Progress workouts={workouts}/>}
   {tab==="body"&&<Body body={body} addBody={addBody}/>}
   {tab==="more"&&<More settings={settings} setSettings={async s=>{await db.settings.put(s);setSettings(s)}} exportJson={exportJson} importJson={importJson} exportCsv={exportCsv}/>}
  </main>
  {active?.rest&&<div className={"restbar "+(restRemaining<=0?"done":"")}><div><small>{restRemaining<=0?"PRZERWA ZAKOŃCZONA":active.rest.exerciseName+" • PRZERWA"}</small><strong>{restRemaining<=0?"Gotowy":fmtDuration(Math.ceil(restRemaining/1000))}</strong></div><div className="restactions"><button onClick={()=>adjustRest(-30)}>−30</button><button onClick={pauseRest}>{active.rest.pausedRemaining?"Wznów":"Pauza"}</button><button onClick={()=>adjustRest(30)}>+30</button><button onClick={skipRest}>Pomiń</button></div></div>}
  {!active&&<nav className="bottom">{([["train","Trening"],["history","Historia"],["progress","Progres"],["body","Ciało"],["more","Więcej"]] as [Tab,string][]).map(([k,l])=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{l}</button>)}</nav>}
  {toast&&<div className="toast">{toast}</div>}
 </div>
}

function TrainHome({templates,workouts,startWorkout}:{templates:WorkoutTemplate[];workouts:WorkoutHistory[];startWorkout:(t:WorkoutTemplate)=>void}){
 const last=workouts[0];return <section className="section"><div className="sectionhead"><h2>Co dzisiaj trenujesz?</h2>{last&&<p>Ostatnio: <b>{last.name}</b> · {fmtDate(last.startedAt)}</p>}</div><div className="templateList">{templates.map(t=><button className="templateRow" key={t.id} onClick={()=>startWorkout(t)}><span><b>{t.name}</b><small>{t.exercises.length} ćwiczeń</small></span><span>Rozpocznij</span></button>)}</div></section>
}
function ActiveView({active,now,previousSet,setField,completeSet,discard}:{active:ActiveWorkout;now:number;previousSet:(n:string,s:number)=>SetLog|null;setField:(e:number,s:number,f:"weight"|"reps"|"rir",v:string)=>void;completeSet:(e:number,s:number)=>void;discard:()=>void}){
 return <section className="workout"><div className="workoutMeta"><span>{fmtDuration(Math.floor((now-active.startedAt)/1000))}</span><button className="textbtn danger" onClick={discard}>Odrzuć</button></div>{active.exercises.map((ex,ei)=><article className="exercise" key={ex.templateExerciseId}><div className="exerciseHead"><div><h3>{ex.name}</h3><p>{ex.target.timed?"Maks. czas":`${ex.target.repMin}–${ex.target.repMax} powt.`} · RIR {ex.target.rir} · tempo {ex.target.tempo}</p></div><span>{Math.round(ex.target.restSec/30)/2} min</span></div><div className="setHeader"><span>Seria</span><span>Poprz.</span><span>kg</span><span>powt.</span><span>RIR</span><span></span></div>{ex.sets.map((s,si)=>{const p=previousSet(ex.name,s.setNo);return <div className={"setRow "+(s.completedAt?"complete":"")} key={s.id}><span>{s.setNo}</span><button className="prev" onClick={()=>p?.weight!=null&&setField(ei,si,"weight",String(p.weight))}>{p?.weight&&p?.reps?`${p.weight}×${p.reps}`:"—"}</button><input inputMode="decimal" value={s.weight??""} disabled={!!s.completedAt} onChange={e=>setField(ei,si,"weight",e.target.value)}/><input inputMode="numeric" value={s.reps??""} disabled={!!s.completedAt} onChange={e=>setField(ei,si,"reps",e.target.value)}/><input inputMode="decimal" value={s.rir??""} disabled={!!s.completedAt} onChange={e=>setField(ei,si,"rir",e.target.value)}/><button className="check" disabled={!!s.completedAt} onClick={()=>completeSet(ei,si)}>{s.completedAt?"✓":"○"}</button></div>})}</article>)}</section>
}
function History({workouts}:{workouts:WorkoutHistory[]}){return <section className="section">{workouts.length===0?<Empty text="Brak zapisanych treningów."/>:<div className="historyList">{workouts.map(w=><details key={w.id} className="historyItem"><summary><div><b>{w.name}</b><span>{fmtDate(w.startedAt)}</span></div><div className="right"><b>{fmtDuration(Math.floor((w.endedAt-w.startedAt)/1000))}</b><span>{Math.round(volume(w)).toLocaleString("pl-PL")} kg</span></div></summary><div className="historyBody">{w.exercises.map(e=><div key={e.templateExerciseId}><h4>{e.name}</h4>{e.sets.filter(s=>s.completedAt).map(s=><p key={s.id}>{s.setNo}. {s.weight} kg × {s.reps}{s.rir!=null?` · RIR ${s.rir}`:""}</p>)}</div>)}</div></details>)}</div>}</section>}
function Progress({workouts}:{workouts:WorkoutHistory[]}){
 const names=Array.from(new Set(workouts.flatMap(w=>w.exercises.map(e=>e.name))));const bench="Wyciskanie sztangi na ławce płaskiej",bE=bestE1rm(workouts,bench),bA=actual1rm(workouts,bench),recent=workouts.filter(w=>w.startedAt>=Date.now()-30*864e5);
 return <section className="section"><div className="metrics"><div><small>Treningi · 30 dni</small><b>{recent.length}</b></div><div><small>Objętość · 30 dni</small><b>{Math.round(recent.reduce((a,w)=>a+volume(w),0)).toLocaleString("pl-PL")} kg</b></div><div><small>Bench e1RM</small><b>{bE?bE.toFixed(1):"—"} kg</b></div><div><small>Bench 1RM / cel</small><b>{bA?bA.toFixed(1):"—"} / 100 kg</b></div></div><h2>Ćwiczenia</h2><div className="progressList">{names.length?names.map(n=><div key={n}><span>{n}</span><b>{bestE1rm(workouts,n)?bestE1rm(workouts,n).toFixed(1)+" kg e1RM":"—"}</b></div>):<Empty text="Statystyki pojawią się po pierwszych treningach."/>}</div></section>
}
function Body({body,addBody}:{body:BodyEntry[];addBody:(fd:FormData)=>void}){return <section className="section"><form className="bodyForm" action={addBody}><div className="formgrid"><label>Masa (kg)<input name="weight" inputMode="decimal"/></label><label>Talia (cm)<input name="waist" inputMode="decimal"/></label><label>Klatka (cm)<input name="chest" inputMode="decimal"/></label><label>Ramię (cm)<input name="arm" inputMode="decimal"/></label></div><label>Notatka<input name="note"/></label><button className="primary" type="submit">Zapisz pomiar</button></form><div className="progressList">{body.map(x=><div key={x.id}><span>{fmtDate(x.date)}{x.waist?` · talia ${x.waist} cm`:""}</span><b>{x.weight?x.weight+" kg":"—"}</b></div>)}</div></section>}
function More({settings,setSettings,exportJson,importJson,exportCsv}:{settings:Settings|null;setSettings:(s:Settings)=>void;exportJson:()=>void;importJson:(f:File)=>void;exportCsv:()=>void}){
 if(!settings)return null;return <section className="section"><div className="settings"><h2>Trening</h2><label className="switchrow">Autostart przerwy<input type="checkbox" checked={settings.autoRest} onChange={e=>setSettings({...settings,autoRest:e.target.checked})}/></label><label className="switchrow">Dźwięk<input type="checkbox" checked={settings.sound} onChange={e=>setSettings({...settings,sound:e.target.checked})}/></label><label className="switchrow">Wibracja<input type="checkbox" checked={settings.vibration} onChange={e=>setSettings({...settings,vibration:e.target.checked})}/></label><h2>Dane</h2><button className="settingsBtn" onClick={exportJson}>Eksportuj backup JSON</button><label className="settingsBtn file">Importuj backup JSON<input type="file" accept=".json,application/json" onChange={e=>e.target.files?.[0]&&importJson(e.target.files[0])}/></label><button className="settingsBtn" onClick={exportCsv}>Eksportuj historię CSV</button><h2>Plan</h2>{exerciseSubstitutions.map(x=><p className="sub" key={x}>{x}</p>)}<h2>O aplikacji</h2><p className="muted">Gym PWA · dane lokalne w IndexedDB · bez analityki i trackerów.</p></div></section>
}
function Empty({text}:{text:string}){return <p className="empty">{text}</p>}
