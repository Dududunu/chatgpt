import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { db } from "./db";
import type { ActiveWorkout, BodyEntry, RestState, SetLog, Settings, WorkoutHistory, WorkoutTemplate } from "./types";
import { actual1rm, bestE1rm, e1rm, volume } from "./stats";
import { adjustRestTimer, currentExerciseIndex, firstIncompleteSetIndex, isRestNotificationDue, navigateWorkoutExercise, nextExerciseAfterCompletedSet, nextRestTarget, normalizeSetForCompletion, restoreActiveWorkout, toFiniteNumber, toggleRestPause } from "./workoutLogic";
import { createWorkoutSnapshot } from "./planLogic";
import { defaultTemplates } from "./seed";
import { ExerciseImage } from "./ExerciseImage";
const PlanScreen=lazy(()=>import("./PlanScreen").then(module=>({default:module.PlanScreen})));
const HistoryScreen=lazy(()=>import("./HistoryScreen").then(module=>({default:module.HistoryScreen})));
const ProgressScreen=lazy(()=>import("./ProgressScreen").then(module=>({default:module.ProgressScreen})));
const MoreScreen=lazy(()=>import("./MoreScreen").then(module=>({default:module.MoreScreen})));
const TimerScreen=lazy(()=>import("./TimerScreen").then(module=>({default:module.TimerScreen})));
import { normalizeSettings } from "./settings";

type Tab="train"|"plan"|"history"|"progress"|"more";
type Field="weight"|"reps"|"rir";
const uid=()=>crypto.randomUUID();
const fmtDuration=(sec:number)=>{const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`};
const fmtDate=(time:number)=>new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"long",year:"numeric"}).format(time);
const parseNum=(value:string)=>{const normalized=value.trim().replace(",",".");if(!normalized)return null;const n=Number(normalized);return Number.isFinite(n)&&n>=0?n:null};
const labels:Record<Tab,string>={train:"Trening",plan:"Plan",history:"Historia",progress:"Progres",more:"Więcej"};

type AppProps={accountEmail:string;syncStatus:"syncing"|"synced"|"offline"|"error";onSyncNow:()=>Promise<void>;onSignOut:()=>Promise<void>};

export default function App({accountEmail,syncStatus,onSyncNow,onSignOut}:AppProps){
 const [tab,setTab]=useState<Tab>("train");
 const [templates,setTemplates]=useState<WorkoutTemplate[]>([]);
 const [workouts,setWorkouts]=useState<WorkoutHistory[]>([]);
 const [active,setActive]=useState<ActiveWorkout|null>(null);
 const [settings,setSettings]=useState<Settings|null>(null);
 const [body,setBody]=useState<BodyEntry[]>([]);
 const [now,setNow]=useState(Date.now());
 const [toast,setToast]=useState("");
 const [timerOpen,setTimerOpen]=useState(false);
 const [manualTimerOpen,setManualTimerOpen]=useState(false);
 const audioContextRef=useRef<AudioContext|null>(null);
 const startingRef=useRef(false);
 const finishingRef=useRef(false);
 const completingRef=useRef(new Set<string>());
 const lastRestNoticeRef=useRef("");

 async function refresh(){
  const [templateRows,workoutRows,activeRows,storedSettings,bodyRows]=await Promise.all([
   db.templates.toArray(),db.workouts.orderBy("startedAt").reverse().toArray(),db.active.toArray(),db.settings.get("main"),db.body.orderBy("date").reverse().toArray()
  ]);
  let storedActive=activeRows[0]||null;
  if(storedActive){const restored=restoreActiveWorkout(storedActive);if(restored!==storedActive){await db.active.put(restored);storedActive=restored}}
  const normalizedSettings=normalizeSettings(storedSettings??null);
  if(!storedSettings||storedSettings.showExerciseImages===undefined)await db.settings.put(normalizedSettings);
  setTemplates(templateRows);setWorkouts(workoutRows);setActive(storedActive);setSettings(normalizedSettings);setBody(bodyRows);
 }

 useEffect(()=>{
  const light=settings?.theme==="light"||(settings?.theme==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",light?"#f6f6f3":"#0b0c0b");
 },[settings?.theme]);

 useEffect(()=>{
  void refresh();
  const tick=window.setInterval(()=>setNow(Date.now()),500);
  const onResume=()=>{if(!document.hidden)void refresh()};
  window.addEventListener("focus",onResume);document.addEventListener("visibilitychange",onResume);
  return()=>{window.clearInterval(tick);window.removeEventListener("focus",onResume);document.removeEventListener("visibilitychange",onResume)};
 },[]);

 function notify(message:string){setToast(message);window.setTimeout(()=>setToast(current=>current===message?"":current),2200)}
 function unlockAudio(){
  if(!settings?.sound)return;
  try{audioContextRef.current??=new AudioContext();void audioContextRef.current.resume()}catch{}
 }
 function playChime(){
  const context=audioContextRef.current;
  if(!context)return;
  void context.resume().then(()=>{
   const oscillator=context.createOscillator(),gain=context.createGain();
   oscillator.type="sine";oscillator.frequency.value=660;gain.gain.setValueAtTime(.001,context.currentTime);gain.gain.exponentialRampToValueAtTime(.16,context.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.24);
   oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+.25);
  }).catch(()=>{});
 }

 useEffect(()=>{
  const rest=active?.rest;
  if(!active||!rest||!isRestNotificationDue(rest,now))return;
  const noticeKey=`${active.id}:${rest.startedAt}:${rest.endsAt}`;
  if(lastRestNoticeRef.current===noticeKey)return;
  lastRestNoticeRef.current=noticeKey;
  void db.transaction("rw",db.active,async()=>{
   const stored=await db.active.get(active.id);
   if(!stored?.rest||stored.rest.startedAt!==rest.startedAt||stored.rest.endsAt!==rest.endsAt||stored.rest.notifiedAt!==undefined)return null;
   stored.rest.notifiedAt=Date.now();await db.active.put(stored);return stored;
  }).then(stored=>{
   if(!stored)return;
   setActive(current=>current?.id===stored.id?stored:current);
   if(settings?.vibration&&navigator.vibrate)navigator.vibrate([70,70,70]);
   if(settings?.sound)playChime();
   notify("Przerwa zakończona");
  }).catch(()=>{if(lastRestNoticeRef.current===noticeKey)lastRestNoticeRef.current=""});
 },[active?.id,active?.rest?.startedAt,active?.rest?.endsAt,active?.rest?.pausedRemaining,active?.rest?.notifiedAt,now,settings?.sound,settings?.vibration]);

 async function mutateActive(workoutId:string,update:(workout:ActiveWorkout)=>ActiveWorkout|null):Promise<ActiveWorkout|null>{
  let result:ActiveWorkout|null=null;
  await db.transaction("rw",db.active,async()=>{
   const stored=await db.active.get(workoutId);if(!stored)return;
   const next=update(structuredClone(stored));if(!next)return;
   await db.active.put(next);result=next;
  });
  if(result)setActive(current=>current?.id===workoutId?result:current);
  return result;
 }

 async function startWorkout(template:WorkoutTemplate){
  if(active||startingRef.current)return;
  startingRef.current=true;
  try{
   const existing=(await db.active.toArray())[0];
   if(existing){const restored=restoreActiveWorkout(existing);if(restored!==existing)await db.active.put(restored);setActive(restored);setTab("train");return}
   unlockAudio();
   const workout=createWorkoutSnapshot(template,Date.now(),uid);
   await db.active.put(workout);setActive(workout);setTab("train");
  }finally{startingRef.current=false}
 }

 async function updateSetField(exerciseId:string,setId:string,field:Field,value:string){
  if(!active)return;
  await mutateActive(active.id,workout=>{
   const exercise=workout.exercises.find(item=>item.templateExerciseId===exerciseId);const set=exercise?.sets.find(item=>item.id===setId);
   if(!set)return null;
   set[field]=value===""?null:value;return workout;
  });
 }

 async function usePreviousWeight(exerciseId:string,setId:string,weight:SetLog["weight"]){
  if(!active||weight==null)return;
  await mutateActive(active.id,workout=>{
   const set=workout.exercises.find(item=>item.templateExerciseId===exerciseId)?.sets.find(item=>item.id===setId);
   if(!set||set.completedAt)return null;set.weight=weight;return workout;
  });
 }

 async function completeSet(exerciseId:string,setId:string){
  if(!active)return;
  const requestKey=`${active.id}:${setId}`;
  if(completingRef.current.has(requestKey))return;
  completingRef.current.add(requestKey);
  let validationMessage="",prMessage="";
  try{
   await mutateActive(active.id,workout=>{
    const exerciseIndex=workout.exercises.findIndex(item=>item.templateExerciseId===exerciseId),exercise=workout.exercises[exerciseIndex];
    const setIndex=exercise?.sets.findIndex(item=>item.id===setId)??-1,set=exercise?.sets[setIndex];
    if(!exercise||!set||set.completedAt)return null;
    const normalized=normalizeSetForCompletion(set,exercise.target);
    if(!normalized.ok){validationMessage=normalized.message;return null}
    const oldBest=exercise.target.timed?0:Math.max(bestE1rm(workouts,exercise.name),bestActiveE1rm(workout,exercise.name,set.id));
    const newEstimate=exercise.target.timed?null:e1rm(normalized.weight,normalized.reps);
    set.weight=normalized.weight;set.reps=normalized.reps;set.rir=normalized.rir;set.completedAt=Date.now();
    if(newEstimate!==null&&Number.isFinite(newEstimate)&&newEstimate>oldBest)prMessage=`NOWY PR · ${exercise.name} · ${normalized.weight} × ${normalized.reps} · e1RM ${newEstimate.toFixed(1)} kg`;
    workout.rest=null;lastRestNoticeRef.current="";
    const supersetNextId=exercise.target.superset?nextExerciseAfterCompletedSet(workout,exerciseIndex,setIndex):null;
    const restTarget=nextRestTarget(workout,exerciseIndex,setIndex);
    if(settings?.autoRest!==false&&restTarget){
     const startedAt=Date.now(),endsAt=startedAt+exercise.target.restSec*1000;
     set.restStartedAt=startedAt;set.restEndsAt=endsAt;
     workout.rest={kind:"rest",exerciseName:restTarget.exerciseName,nextExerciseId:restTarget.exerciseId,nextSet:restTarget.setNo,startedAt,endsAt};
    }
    if(supersetNextId)workout.currentExerciseId=supersetNextId;
    return workout;
   });
   if(validationMessage)notify(validationMessage);else if(prMessage)notify(prMessage);
  }finally{completingRef.current.delete(requestKey)}
 }

 async function navigateExercise(direction:-1|1){
  if(!active)return;
  await mutateActive(active.id,workout=>navigateWorkoutExercise(workout,direction));
 }

 async function changeRest(update:(rest:RestState)=>RestState|null){
  if(!active)return;
  await mutateActive(active.id,workout=>{
   if(!workout.rest)return null;
   const next=update(workout.rest);workout.rest=next;lastRestNoticeRef.current="";return workout;
  });
 }
 async function adjustRest(delta:number){await changeRest(rest=>adjustRestTimer(rest,delta,Date.now()))}
 async function pauseRest(){await changeRest(rest=>toggleRestPause(rest,Date.now()))}
 async function skipRest(){await changeRest(()=>null);setTimerOpen(false)}
 async function startManualTimer(seconds:number){
  if(!active)return;
  unlockAudio();const startedAt=Date.now();
  await mutateActive(active.id,workout=>{workout.rest={kind:"manual",exerciseName:"Timer",nextSet:0,startedAt,endsAt:startedAt+seconds*1000};return workout});
  setManualTimerOpen(false);setTimerOpen(true);
 }

 async function finishWorkout(){
  if(!active||finishingRef.current)return;finishingRef.current=true;
  try{
   const stored=await db.active.get(active.id);if(!stored)return;
   const incomplete=stored.exercises.flatMap(exercise=>exercise.sets).filter(set=>!set.completedAt).length;
   if(incomplete&&!confirm(`${incomplete} niewykonanych serii. Zakończyć trening?`))return;
   await db.transaction("rw",db.workouts,db.active,async()=>{const latest=await db.active.get(active.id);if(!latest)return;const finished:WorkoutHistory={...structuredClone(latest),endedAt:Date.now(),rest:null};delete finished.currentExerciseId;await db.workouts.put(finished);await db.active.delete(active.id)});
   setActive(null);setTimerOpen(false);setTab("history");await refresh();
  }finally{finishingRef.current=false}
 }
 async function discardWorkout(){if(!active||!confirm("Usunąć aktywny trening? Zakończona historia pozostanie bez zmian."))return;await db.active.delete(active.id);setActive(null);setTimerOpen(false);notify("Aktywny trening usunięty")}

 async function saveTemplate(template:WorkoutTemplate){await db.templates.put(template);setTemplates(await db.templates.toArray())}
 async function createTemplate(template:WorkoutTemplate){await db.templates.add(template);setTemplates(await db.templates.toArray())}
 async function deleteTemplate(templateId:string){await db.templates.delete(templateId);setTemplates(await db.templates.toArray())}
 async function saveHistory(workout:WorkoutHistory){await db.workouts.put(workout);setWorkouts(await db.workouts.orderBy("startedAt").reverse().toArray())}
 async function saveSettings(patch:Partial<Settings>){const current=await db.settings.get("main");const next=normalizeSettings({...current,...patch});await db.settings.put(next);setSettings(next)}
 async function addBody(entry:BodyEntry){await db.body.put(entry);setBody(await db.body.orderBy("date").reverse().toArray())}

 async function exportJson(){
  const data={version:2,exportedAt:new Date().toISOString(),templates:await db.templates.toArray(),workouts:await db.workouts.toArray(),body:await db.body.toArray(),settings:await db.settings.toArray(),active:await db.active.toArray()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`gym-backup-${new Date().toISOString().slice(0,10)}.json`;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function importJson(file:File){
  try{
   const data=JSON.parse(await file.text());
   if(!Array.isArray(data.workouts)||!Array.isArray(data.templates))throw new Error("Nieprawidłowy format");
   if(!confirm(`Kopia zawiera ${data.templates.length} planów i ${data.workouts.length} treningów. Zastąpić lokalne dane?`))return;
   await db.transaction("rw",db.templates,db.workouts,db.body,db.settings,db.active,async()=>{
    await Promise.all([db.templates.clear(),db.workouts.clear(),db.body.clear(),db.settings.clear(),db.active.clear()]);
    await db.templates.bulkPut(data.templates);if(data.workouts.length)await db.workouts.bulkPut(data.workouts);
    if(Array.isArray(data.body)&&data.body.length)await db.body.bulkPut(data.body);
    if(Array.isArray(data.settings)&&data.settings.length)await db.settings.bulkPut(data.settings.map((setting:Partial<Settings>)=>normalizeSettings(setting)));else await db.settings.put(normalizeSettings(null));
    if(Array.isArray(data.active)&&data.active.length)await db.active.bulkPut(data.active.map((workout:ActiveWorkout)=>restoreActiveWorkout(workout)));
   });await refresh();notify("Kopia przywrócona");
  }catch{notify("Nieprawidłowy plik kopii")}
 }
 async function exportCsv(){
  const rows:[[string,...string[]],...string[][]]=[["date","workout","exercise","set","kg","reps","rir","e1rm"]];
  for(const workout of workouts)for(const exercise of workout.exercises)for(const set of exercise.sets)if(set.completedAt){
   const weight=toFiniteNumber(set.weight),reps=toFiniteNumber(set.reps);const estimate=!exercise.target.timed&&weight!==null&&reps!==null&&weight>=0&&reps>0&&Number.isInteger(reps)?e1rm(weight,reps):null;
   rows.push([new Date(workout.startedAt).toISOString(),workout.name,exercise.name,String(set.setNo),String(weight??""),String(reps??""),String(toFiniteNumber(set.rir)??""),estimate!==null&&Number.isFinite(estimate)?estimate.toFixed(2):""]);
  }
  const csv=rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(",")).join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const anchor=document.createElement("a");anchor.href=url;anchor.download="gym-history.csv";anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 }

 const restRemaining=active?.rest?(active.rest.pausedRemaining!==undefined?active.rest.pausedRemaining:Math.max(0,active.rest.endsAt-now)):0;
 const pageTitle=tab==="train"&&active?active.name:labels[tab];
 return <div className="app" data-theme={settings?.theme??"dark"}>
  <header className="topbar">
   <div className="topbar-copy"><span className="eyebrow">GYM PWA</span><h1>{pageTitle}</h1>{active&&tab!=="train"&&<span className="workout-live">Trening trwa · {fmtDuration(Math.floor((now-active.startedAt)/1000))}</span>}</div>
   {active&&tab==="train"&&<div className="topbar-actions"><button className="timer-shortcut" onClick={()=>active.rest?setTimerOpen(true):setManualTimerOpen(true)}>TIMER</button><button className="finish-button" onClick={()=>void finishWorkout()}>Zakończ</button></div>}
   {active&&tab!=="train"&&<button className="return-to-workout" onClick={()=>setTab("train")}>Do treningu</button>}
  </header>
  <main>
   <Suspense fallback={<section className="section"><p className="muted">Otwieranie ekranu…</p></section>}>
   {tab==="train"&&(active?<ActiveView active={active} now={now} settings={settings} previousSets={name=>previousSets(workouts,name)} setField={updateSetField} usePreviousWeight={usePreviousWeight} completeSet={completeSet} navigateExercise={navigateExercise} discard={discardWorkout} openTimer={()=>active.rest?setTimerOpen(true):setManualTimerOpen(true)}/>:<TrainHome templates={templates} workouts={workouts} active={active} onStart={startWorkout} onContinue={()=>setTab("train")}/>)}
   {tab==="plan"&&<PlanScreen settings={settings} templates={templates} workouts={workouts} active={active} onSave={saveTemplate} onCreate={createTemplate} onDelete={deleteTemplate} onStart={startWorkout} onContinue={()=>setTab("train")} notify={notify}/>}
   {tab==="history"&&<HistoryScreen workouts={workouts} catalog={exerciseCatalog(templates)} onSave={saveHistory} notify={notify}/>}
   {tab==="progress"&&<ProgressScreen workouts={workouts} body={body}/>}
   {tab==="more"&&<MoreScreen databaseVersion={db.verno} settings={settings} body={body} accountEmail={accountEmail} syncStatus={syncStatus} onSyncNow={onSyncNow} onSignOut={onSignOut} onSaveSettings={saveSettings} onAddBody={addBody} exportJson={exportJson} importJson={importJson} exportCsv={exportCsv} notify={notify}/>}
   </Suspense>
  </main>
  {active?.rest&&<RestBar rest={active.rest} remaining={restRemaining} onOpen={()=>setTimerOpen(true)} onAdjust={adjustRest} onPause={pauseRest} onSkip={skipRest}/>}
  <nav className="bottom-nav" aria-label="Nawigacja główna">{([["train","Trening","◉"],["plan","Plan","▤"],["history","Historia","↺"],["progress","Progres","⌁"],["more","Więcej","···"]] as [Tab,string,string][]).map(([key,label,icon])=><button key={key} className={tab===key?"active":""} aria-current={tab===key?"page":undefined} onClick={()=>setTab(key)}><span aria-hidden="true">{icon}</span><small>{label}</small></button>)}</nav>
  {manualTimerOpen&&<ManualTimer onClose={()=>setManualTimerOpen(false)} onStart={startManualTimer}/>}
  {timerOpen&&active?.rest&&<Suspense fallback={null}><TimerScreen rest={active.rest} remaining={restRemaining} active={active} onClose={()=>setTimerOpen(false)} onAdjust={adjustRest} onPause={pauseRest} onSkip={skipRest}/></Suspense>}
  {toast&&<div className="toast" role="status">{toast}</div>}
 </div>;
}

function TrainHome({templates,workouts,active,onStart,onContinue}:{templates:WorkoutTemplate[];workouts:WorkoutHistory[];active:ActiveWorkout|null;onStart:(template:WorkoutTemplate)=>void;onContinue:()=>void}){
 const last=workouts[0];const todays=new Intl.DateTimeFormat("pl-PL",{weekday:"long",day:"numeric",month:"long"}).format(Date.now());
 const lastSets=last?.exercises.reduce((count,exercise)=>count+exercise.sets.filter(set=>set.completedAt).length,0)||0;
 return <section className="section train-home">
  <div className="today-label">{capitalize(todays)}</div>
  {active&&<button className="continue-workout" onClick={onContinue}><span><b>Kontynuuj {active.name}</b><small>Trening zapisany · {active.exercises.reduce((sum,exercise)=>sum+exercise.sets.filter(set=>set.completedAt).length,0)} serii ukończonych</small></span><span>→</span></button>}
  <div className="section-heading home-heading"><div><h2>Wybierz trening</h2><p>Twoje zapisane szablony.</p></div><span>{templates.length}</span></div>
  <div className="workout-pick-list">{templates.map(template=><button key={template.id} className="workout-pick" onClick={()=>onStart(template)} disabled={Boolean(active)}><span><b>{template.name}</b><small>{template.exercises.length} ćwiczeń · około {Math.max(15,Math.round(template.exercises.length*8))} min</small></span><span aria-hidden="true">→</span></button>)}</div>
  {last&&<section className="last-workout"><div className="section-heading"><div><h2>Ostatni trening</h2></div></div><div className="last-workout-row"><b>{last.name}</b><span>{fmtDate(last.startedAt)}</span></div><div className="last-workout-stats"><span>{fmtDuration(Math.floor((last.endedAt-last.startedAt)/1000))}</span><span>{lastSets} serii</span><span>{Math.round(volume(last)).toLocaleString("pl-PL")} kg</span></div></section>}
  {!last&&<p className="empty-state">Po pierwszym treningu zobaczysz tu swoje ostatnie wyniki.</p>}
 </section>;
}
function ActiveView({active,now,settings,previousSets,setField,usePreviousWeight,completeSet,navigateExercise,discard,openTimer}:{active:ActiveWorkout;now:number;settings:Settings|null;previousSets:(name:string)=>SetLog[];setField:(exerciseId:string,setId:string,field:Field,value:string)=>void;usePreviousWeight:(exerciseId:string,setId:string,weight:SetLog["weight"])=>void;completeSet:(exerciseId:string,setId:string)=>void;navigateExercise:(direction:-1|1)=>void;discard:()=>void;openTimer:()=>void}){
 const index=currentExerciseIndex(active),count=active.exercises.length,exercise=active.exercises[index];
 if(!exercise)return <section className="section"><Empty text="Ten trening nie ma już ćwiczeń."/><button className="quiet-button danger-text" onClick={discard}>Odrzuć trening</button></section>;
 const setIndex=firstIncompleteSetIndex(exercise),set=setIndex>=0?exercise.sets[setIndex]:null;
 const latestCompleted=[...exercise.sets].reverse().find(item=>item.completedAt);
 const previous=previousSets(exercise.name);
 const completeSets=active.exercises.reduce((sum,item)=>sum+item.sets.filter(entry=>entry.completedAt).length,0);
 const allSets=active.exercises.reduce((sum,item)=>sum+item.sets.length,0);
 const progress=count?Math.round((index+1)/count*100):0;
 return <section className="section active-workout">
  <div className="workout-info-row"><span>{fmtDuration(Math.floor((now-active.startedAt)/1000))}</span><span>{completeSets}/{allSets} serii</span><button className="quiet-button danger-text" onClick={discard}>Odrzuć</button></div>
  <div className="exercise-progress"><div><b>{index+1} / {count}</b><span>ćwiczeń</span></div><div className="progress-track" role="progressbar" aria-label="Postęp treningu" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:`${progress}%`}}/></div></div>
  <article className="current-exercise" key={exercise.templateExerciseId}>
   <div className="current-exercise-heading"><h2>{exercise.name}</h2><p>{exercise.target.sets} × {exercise.target.timed?"czas":`${exercise.target.repMin}–${exercise.target.repMax}`} <span>·</span> RIR {exercise.target.rir} <span>·</span> tempo {exercise.target.tempo}</p><small>PRZERWA {fmtDuration(exercise.target.restSec)}</small></div>
   {settings?.showExerciseImages===true&&<ExerciseImage exerciseId={exercise.templateExerciseId}/>}
   <div className="set-progress" aria-label="Postęp serii">{exercise.sets.map((item,setNo)=><span key={item.id} className={item.completedAt?"done":setNo===setIndex?"current":""}>{item.completedAt?"✓":item.setNo}</span>)}</div>
   {set?<>
    <div className="set-context"><b>SERIA {set.setNo}</b>{previous.length>0?<div className="previous-results"><small>OSTATNIO</small><div>{previous.map(item=><button key={item.id} className="previous-result" onClick={()=>usePreviousWeight(exercise.templateExerciseId,set.id,item.weight)}><b>{item.weight??"—"} × {item.reps??"—"}</b></button>)}</div></div>:latestCompleted?<span className="last-set-note">Poprzednia seria: {latestCompleted.weight??"—"} × {latestCompleted.reps??"—"}</span>:<span className="last-set-note">Brak poprzedniego wyniku</span>}</div>
    <div className="set-input-labels"><span>KG</span><span>{exercise.target.timed?"SEK.":"POWT."}</span><span>RIR</span></div>
    <div className="set-inputs"><input aria-label={`Ciężar seria ${set.setNo}`} inputMode="decimal" placeholder="0" value={set.weight??""} onChange={event=>setField(exercise.templateExerciseId,set.id,"weight",event.target.value)}/><input aria-label={`${exercise.target.timed?"Czas":"Powtórzenia"} seria ${set.setNo}`} inputMode="numeric" placeholder={exercise.target.timed?"sek.":String(exercise.target.repMin)} value={set.reps??""} onChange={event=>setField(exercise.templateExerciseId,set.id,"reps",event.target.value)}/><input aria-label={`RIR seria ${set.setNo}`} inputMode="numeric" placeholder={exercise.target.rir} value={set.rir??""} onChange={event=>setField(exercise.templateExerciseId,set.id,"rir",event.target.value)}/></div>
    <button className="complete-set-button" onClick={()=>completeSet(exercise.templateExerciseId,set.id)}>✓ Zakończ serię</button>
   </>:<div className="exercise-complete"><b>Wszystkie serie wykonane</b><span>Możesz przejść dalej albo wrócić do zapisanych serii.</span></div>}
  </article>
  <div className="exercise-navigation"><button onClick={()=>navigateExercise(-1)} disabled={index===0}>← Poprzednie</button><button onClick={()=>navigateExercise(1)} disabled={index===count-1}>Następne ćwiczenie →</button></div>
  <button className="manual-timer-link" onClick={openTimer}>Timer ręczny</button>
 </section>;
}

function RestBar({rest,remaining,onOpen,onAdjust,onPause,onSkip}:{rest:RestState;remaining:number;onOpen:()=>void;onAdjust:(seconds:number)=>void;onPause:()=>void;onSkip:()=>void}){
 const paused=rest.pausedRemaining!==undefined,ended=remaining<=0&&!paused;
 return <div className={`rest-bar ${ended?"ended":""}`}>
  <button className="rest-bar-open" onClick={onOpen}><small>{rest.kind==="manual"?"TIMER":ended?"PRZERWA ZAKOŃCZONA":"PRZERWA"}</small><b>{clock(remaining)}</b><span>{rest.kind==="manual"?"Timer ręczny":rest.exerciseName}</span></button>
  <div className="rest-bar-actions"><button aria-label="Odejmij 30 sekund" onClick={()=>onAdjust(-30)}>−30</button><button aria-label={paused?"Wznów":"Pauza"} onClick={onPause}>{paused?"Wznów":"Pauza"}</button><button aria-label="Dodaj 30 sekund" onClick={()=>onAdjust(30)}>+30</button><button aria-label="Pomiń przerwę" onClick={onSkip}>Pomiń</button></div>
 </div>;
}

function ManualTimer({onClose,onStart}:{onClose:()=>void;onStart:(seconds:number)=>void}){
 const presets=[60,90,120,150,180,240];
 const [custom,setCustom]=useState("120");
 return <div className="timer-overlay" role="dialog" aria-modal="true" aria-labelledby="manual-timer-title"><div className="manual-timer-sheet">
  <div className="timer-sheet-top"><span id="manual-timer-title">TIMER RĘCZNY</span><button className="quiet-button" onClick={onClose}>Zamknij</button></div>
  <p>Wybierz długość przerwy</p><div className="timer-presets">{presets.map(seconds=><button key={seconds} onClick={()=>onStart(seconds)}>{seconds/60}:{String(seconds%60).padStart(2,"0")}</button>)}</div>
  <label className="field-label">WŁASNY CZAS (SEK.)<input type="number" min="1" max="7200" inputMode="numeric" value={custom} onChange={event=>setCustom(event.target.value)}/></label>
  <button className="primary" onClick={()=>{const seconds=Number(custom);if(Number.isInteger(seconds)&&seconds>0&&seconds<=7200)onStart(seconds)}}>Uruchom timer</button>
 </div></div>;
}

function Empty({text}:{text:string}){return <p className="empty-state">{text}</p>}
function previousSets(workouts:WorkoutHistory[],name:string):SetLog[]{
 for(const workout of workouts){const exercise=workout.exercises.find(item=>item.name===name);const sets=exercise?.sets.filter(set=>set.completedAt);if(sets?.length)return sets}
 return [];
}
function bestActiveE1rm(workout:ActiveWorkout,exerciseName:string,excludeSetId:string){
 let best=0;
 for(const exercise of workout.exercises)if(exercise.name===exerciseName&&!exercise.target.timed)for(const set of exercise.sets){
  if(set.id===excludeSetId||!set.completedAt)continue;
  const weight=toFiniteNumber(set.weight),reps=toFiniteNumber(set.reps);
  if(weight!==null&&reps!==null&&weight>=0&&reps>0&&Number.isInteger(reps))best=Math.max(best,e1rm(weight,reps));
 }
 return best;
}
function exerciseCatalog(templates:WorkoutTemplate[]){
 const entries=[...defaultTemplates,...templates].flatMap(template=>template.exercises);const seen=new Map<string,typeof entries[number]>();
 for(const exercise of entries)if(!seen.has(exercise.id))seen.set(exercise.id,exercise);return [...seen.values()];
}
function capitalize(value:string){return value.charAt(0).toLocaleUpperCase("pl-PL")+value.slice(1)}
function clock(milliseconds:number){const seconds=Math.max(0,Math.ceil(milliseconds/1000));return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`}
