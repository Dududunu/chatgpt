import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { db } from "./db";
import type { ActiveWorkout, BodyEntry, ExerciseLog, ExerciseTemplate, RestState, SetLog, Settings, SetType, WorkoutHistory, WorkoutTemplate } from "./types";
import { actual1rm, bestE1rm, e1rm, isPrCandidate, volume } from "./stats";
import { addWorkoutSet, adjustRestTimer, currentExerciseIndex, exerciseLogId, exerciseNavigationStatus, firstIncompleteSetIndex, isRestNotificationDue, moveWorkoutExerciseToEnd, navigateWorkoutExercise, nextExerciseAfterCompletedSet, nextRestTarget, normalizeSetForCompletion, removeWorkoutSet, restoreActiveWorkout, restoreWorkoutExercise, selectWorkoutExercise, setWorkoutSetType, skipWorkoutExercise, swapWorkoutExercise, toFiniteNumber, toggleRestPause } from "./workoutLogic";
import { createWorkoutSnapshot,inheritNextSessionNotes,prefillPreviousWeights,replaceTemplateExercise } from "./planLogic";
import { defaultTemplates } from "./seed";
import { calculatePlates, generateWarmupSets, isBarbellExercise } from "./barbellTools";
import { ExerciseImage } from "./ExerciseImage";
import { AppIcon, type AppIconName } from "./AppIcons";
import { createManualRest, remainingRestMs, restSessionKey, shouldShowFullscreenTimer } from "./timerLogic";
const PlanScreen=lazy(()=>import("./PlanScreen").then(module=>({default:module.PlanScreen})));
const HistoryScreen=lazy(()=>import("./HistoryScreen").then(module=>({default:module.HistoryScreen})));
const ProgressScreen=lazy(()=>import("./ProgressScreen").then(module=>({default:module.ProgressScreen})));
const MoreScreen=lazy(()=>import("./MoreScreen").then(module=>({default:module.MoreScreen})));
const TimerScreen=lazy(()=>import("./TimerScreen").then(module=>({default:module.TimerScreen})));
import { normalizeSettings } from "./settings";
import { progressionSuggestion } from "./progression";
import { createUndoSnapshot,restoreUndoSnapshot,type UndoSnapshot } from "./undoLogic";
import { canActivateUpdate,getUpdateNotice,shouldReloadAfterControllerChange } from "./pwaUpdate";
import { useScreenWakeLock } from "./wakeLock";
import { isWorkoutPhotoPathOwnedBy, validateWorkoutRating, validateWorkoutReview } from "./workoutReview";
const WorkoutSummaryScreen=lazy(()=>import("./WorkoutSummaryScreen").then(module=>({default:module.WorkoutSummaryScreen})));

type Tab="train"|"plan"|"history"|"progress"|"more"|"summary";
type Field="weight"|"reps"|"rir";
type ToastState={message:string;undo?:()=>void};
const uid=()=>crypto.randomUUID();
const fmtDuration=(sec:number)=>{const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`};
const fmtDate=(time:number)=>new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"long",year:"numeric"}).format(time);
const parseNum=(value:string)=>{const normalized=value.trim().replace(",",".");if(!normalized)return null;const n=Number(normalized);return Number.isFinite(n)&&n>=0?n:null};
const labels:Record<Tab,string>={train:"Trening",plan:"Plan",history:"Historia",progress:"Progres",more:"Więcej",summary:"Podsumowanie"};

type AppProps={userId:string;accountEmail:string;displayName:string;syncStatus:"syncing"|"synced"|"offline"|"error";onSyncNow:()=>Promise<void>;onSignOut:()=>Promise<void>;onUpdateDisplayName:(name:string)=>Promise<void>;onChangePassword:(current:string,next:string)=>Promise<void>;onDeleteAccount:(confirmation:string)=>Promise<void>};

export default function App({userId,accountEmail,displayName,syncStatus,onSyncNow,onSignOut,onUpdateDisplayName,onChangePassword,onDeleteAccount}:AppProps){
 const [tab,setTab]=useState<Tab>("train");
 const [templates,setTemplates]=useState<WorkoutTemplate[]>([]);
 const [workouts,setWorkouts]=useState<WorkoutHistory[]>([]);
 const [active,setActive]=useState<ActiveWorkout|null>(null);
 const [settings,setSettings]=useState<Settings|null>(null);
 const [body,setBody]=useState<BodyEntry[]>([]);
 const [now,setNow]=useState(Date.now());
 const [toast,setToast]=useState<ToastState|null>(null);
 const [localSaveError,setLocalSaveError]=useState(false);
 const [updateAvailable,setUpdateAvailable]=useState(false);
 const [dismissedRestKey,setDismissedRestKey]=useState<string|null>(null);
 const [manualTimerOpen,setManualTimerOpen]=useState(false);
 const [finishedWorkout,setFinishedWorkout]=useState<WorkoutHistory|null>(null);
 const audioContextRef=useRef<AudioContext|null>(null);
 const toastTimerRef=useRef<number|null>(null);
 const undoSnapshotRef=useRef<UndoSnapshot|null>(null);
 const reloadAfterUpdateRef=useRef(false);
 const startingRef=useRef(false);
 const finishingRef=useRef(false);
 const completingRef=useRef(new Set<string>());
 const lastRestNoticeRef=useRef("");
 useScreenWakeLock(Boolean(active),settings?.keepScreenAwake!==false);

 async function refresh(){
  try{
   const [templateRows,workoutRows,activeRows,storedSettings,bodyRows]=await Promise.all([
    db.templates.toArray(),db.workouts.orderBy("startedAt").reverse().toArray(),db.active.toArray(),db.settings.get("main"),db.body.orderBy("date").reverse().toArray()
   ]);
   let storedActive=activeRows[0]||null;
   if(storedActive){const restored=restoreActiveWorkout(storedActive);if(restored!==storedActive){await db.active.put({...restored,updatedAt:Date.now()});storedActive=restored}}
   const normalizedSettings=normalizeSettings(storedSettings??null);
   if(!storedSettings||storedSettings.showExerciseImages===undefined)await db.settings.put(normalizedSettings);
   setTemplates(templateRows.filter(item=>item.deletedAt===undefined));setWorkouts(workoutRows.filter(item=>item.deletedAt===undefined));setActive(storedActive);setSettings(normalizedSettings);setBody(bodyRows.filter(item=>item.deletedAt===undefined));setLocalSaveError(false);
  }catch{setLocalSaveError(true);showToast("Nie udało się zapisać zmian lokalnie.")}
 }

 useEffect(()=>{
  const media=window.matchMedia("(prefers-color-scheme: light)");
  const applyTheme=()=>{
   const light=settings?.theme==="light"||(settings?.theme==="system"&&media.matches);
   document.documentElement.style.setProperty("--page-bg",light?"#f6f6f3":"#0b0c0b");
   document.querySelector('meta[name="theme-color"]')?.setAttribute("content",light?"#f6f6f3":"#0b0c0b");
  };
  applyTheme();media.addEventListener("change",applyTheme);
  return()=>media.removeEventListener("change",applyTheme);
 },[settings?.theme]);

 useEffect(()=>{
  void refresh();
  const tick=window.setInterval(()=>setNow(Date.now()),500);
  const onResume=()=>{if(!document.hidden)void refresh()};
  window.addEventListener("focus",onResume);document.addEventListener("visibilitychange",onResume);
  return()=>{window.clearInterval(tick);window.removeEventListener("focus",onResume);document.removeEventListener("visibilitychange",onResume)};
 },[]);

 useEffect(()=>{
  const announce=()=>setUpdateAvailable(true);
  const controllerChanged=()=>{if(shouldReloadAfterControllerChange(reloadAfterUpdateRef.current))window.location.reload()};
  window.addEventListener("gym-pwa-update-available",announce);
  navigator.serviceWorker?.addEventListener("controllerchange",controllerChanged);
  return()=>{window.removeEventListener("gym-pwa-update-available",announce);navigator.serviceWorker?.removeEventListener("controllerchange",controllerChanged)};
 },[]);

 function showToast(message:string,undo?:()=>void,duration=undo?6500:2400){
  setToast({message,undo});if(toastTimerRef.current!==null)window.clearTimeout(toastTimerRef.current);
  toastTimerRef.current=window.setTimeout(()=>{setToast(null);undoSnapshotRef.current=null;toastTimerRef.current=null},duration);
 }
 function notify(message:string){showToast(message)}
 function notifyUndo(message:string){showToast(message,()=>{void undoLastAction()})}
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
   if((settings?.haptics??settings?.vibration)&&navigator.vibrate)navigator.vibrate([100,50,180]);
   if(settings?.sound)playChime();
   notify("Przerwa zakończona");
  }).catch(()=>{if(lastRestNoticeRef.current===noticeKey)lastRestNoticeRef.current=""});
 },[active?.id,active?.rest?.startedAt,active?.rest?.endsAt,active?.rest?.pausedRemaining,active?.rest?.notifiedAt,now,settings?.sound,settings?.haptics,settings?.vibration]);

 async function undoLastAction(){
  const previous=undoSnapshotRef.current;if(!previous)return;
  try{
   const restored=restoreUndoSnapshot(previous,Date.now());
   await db.transaction("rw",db.active,db.templates,async()=>{await db.active.put(restored);if(previous.template)await db.templates.put({...structuredClone(previous.template),updatedAt:Date.now()})});
   setActive(current=>current?.id===restored.id?restored:current);if(previous.template)setTemplates((await db.templates.toArray()).filter(item=>item.deletedAt===undefined));undoSnapshotRef.current=null;
   if(toastTimerRef.current!==null)window.clearTimeout(toastTimerRef.current);setToast(null);setLocalSaveError(false);
  }catch{setLocalSaveError(true);showToast("Nie udało się zapisać zmian lokalnie.")}
 }
 async function mutateActive(workoutId:string,update:(workout:ActiveWorkout)=>ActiveWorkout|null,undoMessage?:string|(()=>string)):Promise<ActiveWorkout|null>{
  let result:ActiveWorkout|null=null,previous:ActiveWorkout|null=null;
  try{
   await db.transaction("rw",db.active,async()=>{
    const stored=await db.active.get(workoutId);if(!stored)return;
    previous=structuredClone(stored);const next=update(structuredClone(stored));if(!next)return;
    await db.active.put({...next,updatedAt:Date.now()});result=next;
   });
  }catch{setLocalSaveError(true);showToast("Nie udało się zapisać zmian lokalnie.");return null}
  if(result){
   setActive(current=>current?.id===workoutId?result:current);setLocalSaveError(false);
   if(undoMessage&&previous){undoSnapshotRef.current=createUndoSnapshot(previous);notifyUndo(typeof undoMessage==="function"?undoMessage():undoMessage)}
   else if(undoSnapshotRef.current){undoSnapshotRef.current=null;if(toastTimerRef.current!==null)window.clearTimeout(toastTimerRef.current);toastTimerRef.current=null;setToast(null)}
  }
  return result;
 }

 async function startWorkout(template:WorkoutTemplate){
  if(active||startingRef.current)return;
  startingRef.current=true;
  try{
   const existing=(await db.active.toArray())[0];
   if(existing){const restored=restoreActiveWorkout(existing);if(restored!==existing)await db.active.put(restored);setActive(restored);setTab("train");return}
   unlockAudio();
   const startedAt=Date.now();
   const previous=workouts.find(item=>item.templateId===template.id&&item.startedAt<startedAt);
   const snapshot=prefillPreviousWeights(createWorkoutSnapshot(template,startedAt,uid),previous,settings?.prefillPreviousWeight===true);
   const workout=inheritNextSessionNotes(snapshot,previous);
   await db.active.put(workout);setActive(workout);setTab("train");
  }catch{setLocalSaveError(true);showToast("Nie udało się zapisać zmian lokalnie.")}finally{startingRef.current=false}
 }

 async function updateSetField(exerciseId:string,setId:string,field:Field,value:string){
  if(!active)return;
  await mutateActive(active.id,workout=>{
   const exercise=workout.exercises.find(item=>exerciseLogId(item)===exerciseId);const set=exercise?.sets.find(item=>item.id===setId);
   if(!set||exercise?.status==="skipped"||exercise?.status==="replaced")return null;
   set[field]=value===""?null:value;return workout;
  });
 }

 async function usePreviousResult(exerciseId:string,setId:string,source:SetLog){
  if(!active)return;
  await mutateActive(active.id,workout=>{
   const set=workout.exercises.find(item=>exerciseLogId(item)===exerciseId)?.sets.find(item=>item.id===setId);
   if(!set||set.completedAt)return null;set.weight=source.weight;set.reps=source.reps;
   if(settings?.copyPreviousRir&&source.rir!==null)set.rir=source.rir;
   return workout;
  });
 }

 async function completeSet(exerciseId:string,setId:string){
  if(!active)return;
  const requestKey=`${active.id}:${setId}`;
  if(completingRef.current.has(requestKey))return;
  completingRef.current.add(requestKey);
  let validationMessage="",prMessage="";
  try{
   const saved=await mutateActive(active.id,workout=>{
    const exerciseIndex=workout.exercises.findIndex(item=>exerciseLogId(item)===exerciseId),exercise=workout.exercises[exerciseIndex];
    const setIndex=exercise?.sets.findIndex(item=>item.id===setId)??-1,set=exercise?.sets[setIndex];
    if(!exercise||exercise.status==="skipped"||exercise.status==="replaced"||!set||set.completedAt)return null;
    const normalized=normalizeSetForCompletion(set,exercise.target);
    if(!normalized.ok){validationMessage=normalized.message;return null}
    const historicalBest=exercise.target.timed?0:bestE1rm(workouts,exercise.name);
    const oldBest=Math.max(historicalBest,bestActiveE1rm(workout,exercise.name,set.id));
    const isPrEligible=isPrCandidate(set,exercise.target.timed);
    const newEstimate=isPrEligible?e1rm(normalized.weight,normalized.reps):null;
    set.weight=normalized.weight;set.reps=normalized.reps;set.rir=normalized.rir;set.completedAt=Date.now();
    if(historicalBest>0&&newEstimate!==null&&Number.isFinite(newEstimate)&&newEstimate>oldBest)prMessage=`NOWY PR · ${exercise.name} · ${normalized.weight} × ${normalized.reps} · e1RM ${newEstimate.toFixed(1)} kg`;
    workout.rest=null;lastRestNoticeRef.current="";
    const supersetNextId=exercise.target.superset?nextExerciseAfterCompletedSet(workout,exerciseIndex,setIndex):null;
    const restTarget=nextRestTarget(workout,exerciseIndex,setIndex);
    if(settings?.autoRest!==false&&restTarget){
     const startedAt=Date.now(),endsAt=startedAt+exercise.target.restSec*1000;
     set.restStartedAt=startedAt;set.restEndsAt=endsAt;
     workout.rest={kind:"rest",exerciseName:restTarget.exerciseName,nextExerciseId:restTarget.exerciseId,nextSet:restTarget.setNo,completedExerciseName:exercise.name,completedSetNo:set.setNo,completedSetTotal:exercise.target.sets,startedAt,endsAt};
    }
    if(supersetNextId)workout.currentExerciseId=supersetNextId;
    return workout;
   },()=>prMessage||"Seria zakończona");
   if(validationMessage)notify(validationMessage);
   else if(saved&&(settings?.haptics??settings?.vibration)&&navigator.vibrate)navigator.vibrate(12);
  }finally{completingRef.current.delete(requestKey)}
 }

 async function navigateExercise(direction:-1|1){
  if(!active)return;
  await mutateActive(active.id,workout=>navigateWorkoutExercise(workout,direction));
 }

 async function addSet(exerciseId:string){if(!active)return;await mutateActive(active.id,workout=>addWorkoutSet(workout,exerciseId,uid))}
 async function removeSet(exerciseId:string,setId:string){if(!active)return;await mutateActive(active.id,workout=>removeWorkoutSet(workout,exerciseId,setId),"Seria usunięta")}
 async function changeSetType(exerciseId:string,setId:string,type:SetType){if(!active)return;await mutateActive(active.id,workout=>setWorkoutSetType(workout,exerciseId,setId,type),"Typ serii zmieniony")}
 async function updateExerciseNote(exerciseId:string,note:string){if(!active)return;await mutateActive(active.id,workout=>{const exercise=workout.exercises.find(item=>exerciseLogId(item)===exerciseId);if(!exercise)return null;exercise.note=note.slice(0,300);return workout})}
 async function updateNextSessionNote(exerciseId:string,note:string){if(!active)return;await mutateActive(active.id,workout=>{const exercise=workout.exercises.find(item=>exerciseLogId(item)===exerciseId);if(!exercise)return null;exercise.nextSessionNote=note.slice(0,200);return workout})}
 async function dismissPreviousNote(exerciseId:string){if(!active)return;await mutateActive(active.id,workout=>{const exercise=workout.exercises.find(item=>exerciseLogId(item)===exerciseId);if(!exercise)return null;exercise.previousNoteDismissed=true;return workout})}
 async function togglePlateTools(exerciseId:string){if(!active)return;await mutateActive(active.id,workout=>{const exercise=workout.exercises.find(item=>exerciseLogId(item)===exerciseId);if(!exercise)return null;exercise.target.plateCalculatorEnabled=exercise.target.plateCalculatorEnabled!==true;return workout},"Ustawienie talerzy zmienione")}
 async function skipExercise(exerciseId:string){if(!active)return;await mutateActive(active.id,workout=>skipWorkoutExercise(workout,exerciseId),"Pominięto ćwiczenie")}
 async function resumeExercise(exerciseId:string){if(!active)return;await mutateActive(active.id,workout=>restoreWorkoutExercise(workout,exerciseId))}
 async function moveExercise(exerciseId:string){if(!active)return;await mutateActive(active.id,workout=>moveWorkoutExerciseToEnd(workout,exerciseId),"Ćwiczenie przeniesione")}
 async function selectExercise(exerciseId:string){if(!active)return;await mutateActive(active.id,workout=>selectWorkoutExercise(workout,exerciseId))}

 async function addWarmup(exerciseId:string){
  if(!active)return;
  let message="";
  await mutateActive(active.id,workout=>{
   const exercise=workout.exercises.find(item=>exerciseLogId(item)===exerciseId);if(!exercise)return null;
   if(exercise.sets.some(set=>set.type==="warmup")){message="Serie rozgrzewkowe są już dodane.";return null}
   const firstWorking=exercise.sets.find(set=>set.type!=="warmup"),targetWeight=toFiniteNumber(firstWorking?.weight??null);
   if(targetWeight===null){message="Najpierw wpisz ciężar pierwszej serii roboczej.";return null}
   const warmups=generateWarmupSets(targetWeight,settings?.barWeight??20,exercise.target.minIncrement??settings?.defaultIncrement??2.5,uid);
   if(!warmups.length){message="Ten ciężar nie wymaga dodatkowej rozgrzewki.";return null}
   exercise.sets=[...warmups,...exercise.sets].slice(0,30).map((set,index)=>({...set,setNo:index+1}));return workout;
  },"Serie rozgrzewkowe dodane");
  if(message)notify(message);
 }

 async function swapExercise(exerciseId:string,target:ExerciseTemplate,saveToPlan:boolean){
  if(!active)return;let previous:ActiveWorkout|null=null,result:ActiveWorkout|null=null,previousTemplate:WorkoutTemplate|undefined,planError="";
  try{
   await db.transaction("rw",db.active,db.templates,async()=>{
    const stored=await db.active.get(active.id);if(!stored)return;
    const original=stored.exercises.find(item=>exerciseLogId(item)===exerciseId);if(!original)return;
    const next=swapWorkoutExercise(structuredClone(stored),exerciseId,target,uid);if(next===stored)return;
    if(saveToPlan){
     const template=await db.templates.get(stored.templateId);
     let source=original;
     while(source.replacesLogId){const previousSource=stored.exercises.find(item=>exerciseLogId(item)===source.replacesLogId);if(!previousSource)break;source=previousSource}
     const planId=source.planExerciseId===null?null:source.planExerciseId??source.templateExerciseId;
     if(!planId||!template||template.deletedAt!==undefined||!template.exercises.some(item=>item.id===planId)){planError="Ćwiczenia planu nie udało się odnaleźć. Zmiana pozostała tylko w tym treningu."}
     else{
      const changed=next.exercises.find(item=>item.replacesLogId===exerciseId);
      if(changed){changed.templateExerciseId=planId;changed.planExerciseId=planId;changed.target={...structuredClone(target),id:planId}}
      previousTemplate=structuredClone(template);
      await db.templates.put({...replaceTemplateExercise(template,planId,target),updatedAt:Date.now()});
     }
    }
    previous=structuredClone(stored);await db.active.put({...next,updatedAt:Date.now()});result=next;
   });
  }catch{setLocalSaveError(true);showToast("Nie udało się zapisać zmian lokalnie.");return}
  if(result&&previous){setActive(result);setTemplates((await db.templates.toArray()).filter(item=>item.deletedAt===undefined));setLocalSaveError(false);undoSnapshotRef.current=createUndoSnapshot(previous,previousTemplate);notifyUndo("Ćwiczenie zamienione")}
  if(planError)notify(planError);
 }

 async function saveWorkoutChangesToPlan(){
  if(!finishedWorkout||!finishedWorkout.planSetChanges?.length)return;
  const template=await db.templates.get(finishedWorkout.templateId);if(!template||template.deletedAt!==undefined){notify("Plan nie jest już dostępny do aktualizacji");return}
  const counts=new Map<string,number>();for(const exercise of finishedWorkout.exercises){const planId=exercise.planExerciseId===null?null:exercise.planExerciseId??exercise.templateExerciseId;if(planId)counts.set(planId,exercise.sets.filter(set=>set.type!=="warmup").length)}
  const updated={...template,exercises:template.exercises.map(exercise=>finishedWorkout.planSetChanges!.includes(exercise.id)&&counts.has(exercise.id)?{...exercise,sets:Math.max(1,counts.get(exercise.id)!)}:exercise),updatedAt:Date.now()};
  await db.templates.put(updated);setTemplates((await db.templates.toArray()).filter(item=>item.deletedAt===undefined));
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
 async function skipRest(){await changeRest(()=>null)}
 async function startManualTimer(seconds:number){
  if(!active)return;
  unlockAudio();const rest=createManualRest(seconds,Date.now());
  await mutateActive(active.id,workout=>{workout.rest=rest;return workout});
  setDismissedRestKey(null);setManualTimerOpen(false);
 }

 async function finishWorkout(){
  if(!active||finishingRef.current)return;finishingRef.current=true;
  try{
   const stored=await db.active.get(active.id);if(!stored)return;
   const incomplete=stored.exercises.filter(exercise=>exercise.status!=="skipped"&&exercise.status!=="replaced").flatMap(exercise=>exercise.sets).filter(set=>!set.completedAt&&set.type!=="warmup").length;
   if(incomplete&&!confirm(`${incomplete} niewykonanych serii. Zakończyć trening?`))return;
   undoSnapshotRef.current=null;
   const endedAt=Date.now();
   await db.transaction("rw",db.workouts,db.active,db.syncMeta,async()=>{const latest=await db.active.get(active.id);if(!latest)return;const finished:WorkoutHistory={...structuredClone(latest),endedAt,rest:null,updatedAt:endedAt,rating:null,reviewText:null,photoPath:null};delete finished.currentExerciseId;await db.workouts.put(finished);await db.active.delete(active.id);const meta=await db.syncMeta.get("main")??{id:"main" as const};await db.syncMeta.put({...meta,activeDeletedAt:endedAt})});
   const latest=await db.workouts.get(active.id);if(latest){setFinishedWorkout(latest);setTab("summary")}
   setActive(null);setDismissedRestKey(null);await refresh();
  }finally{finishingRef.current=false}
 }
 async function discardWorkout(){if(!active||!confirm("Usunąć aktywny trening? Zakończona historia pozostanie bez zmian."))return;undoSnapshotRef.current=null;const deletedAt=Date.now();await db.transaction("rw",db.active,db.syncMeta,async()=>{await db.active.delete(active.id);const meta=await db.syncMeta.get("main")??{id:"main" as const};await db.syncMeta.put({...meta,activeDeletedAt:deletedAt})});setActive(null);setDismissedRestKey(null);notify("Aktywny trening usunięty")}

 async function saveTemplate(template:WorkoutTemplate){await db.templates.put({...template,updatedAt:Date.now()});setTemplates((await db.templates.toArray()).filter(item=>item.deletedAt===undefined))}
 async function createTemplate(template:WorkoutTemplate){await db.templates.add({...template,updatedAt:Date.now()});setTemplates((await db.templates.toArray()).filter(item=>item.deletedAt===undefined))}
 async function deleteTemplate(templateId:string){const template=await db.templates.get(templateId);if(!template)return;await db.templates.put({...template,deletedAt:Date.now(),updatedAt:Date.now()});setTemplates((await db.templates.toArray()).filter(item=>item.deletedAt===undefined))}
 async function saveHistory(workout:WorkoutHistory){await db.workouts.put({...workout,updatedAt:Date.now()});setWorkouts((await db.workouts.orderBy("startedAt").reverse().toArray()).filter(item=>item.deletedAt===undefined))}
 async function saveWorkoutReview(workoutId:string,patch:Partial<Pick<WorkoutHistory,"rating"|"reviewText"|"photoPath">>){
  const workout=await db.workouts.get(workoutId);if(!workout||workout.deletedAt!==undefined)return;
  const normalized:Partial<Pick<WorkoutHistory,"rating"|"reviewText"|"photoPath">>={};
  if("rating" in patch){const result=validateWorkoutRating(patch.rating);if(!result.ok){notify(result.error);return}normalized.rating=result.value}
  if("reviewText" in patch){const result=validateWorkoutReview(String(patch.reviewText??""));if(result.error){notify(result.error);return}normalized.reviewText=result.value}
  if("photoPath" in patch){const path=patch.photoPath??null;if(path!==null&&!isWorkoutPhotoPathOwnedBy(path,userId,workoutId)){notify("Nieprawidłowa ścieżka zdjęcia treningu.");return}normalized.photoPath=path}
  const updated={...workout,...normalized,updatedAt:Date.now()};await db.workouts.put(updated);
  setWorkouts((current)=>current.map(item=>item.id===workoutId?updated:item));setFinishedWorkout(current=>current?.id===workoutId?updated:current);
  if(navigator.onLine)void onSyncNow().catch(()=>{});
 }
 async function deleteHistory(workout:WorkoutHistory){
  const deletedAt=Date.now();
  {const {queueWorkoutPhotoRemoval}=await import("./workoutMedia");await queueWorkoutPhotoRemoval(userId,workout.id)}
  await db.workouts.put({...workout,deletedAt,updatedAt:deletedAt});
  setWorkouts(current=>current.filter(item=>item.id!==workout.id));setFinishedWorkout(current=>current?.id===workout.id?null:current);
  if(navigator.onLine)void onSyncNow().catch(()=>{});
 }
 async function saveSettings(patch:Partial<Settings>){const current=await db.settings.get("main");const next=normalizeSettings({...current,...patch});await db.settings.put(next);setSettings(next)}
 async function addBody(entry:BodyEntry){await db.body.put({...entry,updatedAt:Date.now()});setBody((await db.body.orderBy("date").reverse().toArray()).filter(item=>item.deletedAt===undefined))}

 async function exportJson(){
  const data={version:2,exportedAt:new Date().toISOString(),templates:await db.templates.toArray(),workouts:await db.workouts.toArray(),body:await db.body.toArray(),settings:await db.settings.toArray(),active:await db.active.toArray()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`gym-backup-${new Date().toISOString().slice(0,10)}.json`;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function importJson(file:File){
  try{
   const data=JSON.parse(await file.text());
   if(!Array.isArray(data.workouts)||!Array.isArray(data.templates))throw new Error("Nieprawidłowy format");
   if(!confirm(`Kopia zawiera ${data.templates.length} planów i ${data.workouts.length} treningów. Zastąpić lokalne dane?`))return;
   await db.transaction("rw",[db.templates,db.workouts,db.body,db.settings,db.active,db.syncMeta],async()=>{
    await Promise.all([db.templates.clear(),db.workouts.clear(),db.body.clear(),db.settings.clear(),db.active.clear()]);
    await db.templates.bulkPut(data.templates);if(data.workouts.length)await db.workouts.bulkPut((data.workouts as WorkoutHistory[]).map(workout=>{
     const rating=validateWorkoutRating(workout.rating);const review=validateWorkoutReview(String(workout.reviewText??""));
     return {...workout,rating:rating.ok?rating.value:null,reviewText:review.value,photoPath:workout.photoPath&&isWorkoutPhotoPathOwnedBy(workout.photoPath,userId,workout.id)?workout.photoPath:null};
    }));
    if(Array.isArray(data.body)&&data.body.length)await db.body.bulkPut(data.body);
    if(Array.isArray(data.settings)&&data.settings.length)await db.settings.bulkPut(data.settings.map((setting:Partial<Settings>)=>normalizeSettings(setting)));else await db.settings.put(normalizeSettings(null));
    if(Array.isArray(data.active)&&data.active.length)await db.active.bulkPut(data.active.map((workout:ActiveWorkout)=>restoreActiveWorkout(workout)));
    const meta=await db.syncMeta.get("main")??{id:"main" as const};delete meta.activeDeletedAt;await db.syncMeta.put(meta);
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

 const restRemaining=active?.rest?remainingRestMs(active.rest,now):0;
 const timerKey=active?.rest?restSessionKey(active.id,active.rest):null;
 const timerOpen=shouldShowFullscreenTimer(active?.id??null,active?.rest,dismissedRestKey);
 function openWorkoutTimer(){
  if(active?.rest){setDismissedRestKey(null);return}
  setManualTimerOpen(true);
 }
 async function activateUpdate(){
  if(!canActivateUpdate(Boolean(active)))return;
  try{
   const registration=await navigator.serviceWorker?.getRegistration();
   if(registration?.waiting){reloadAfterUpdateRef.current=true;registration.waiting.postMessage({type:"SKIP_WAITING"});return}
   window.location.reload();
  }catch{notify("Nie udało się odświeżyć aplikacji.")}
 }
 const syncLabel=syncStatus==="offline"?"Offline · zapisuję lokalnie":syncStatus==="syncing"?"Synchronizacja…":syncStatus==="error"?"Błąd synchronizacji":"Zsynchronizowano";
 const updateNotice=updateAvailable?getUpdateNotice(Boolean(active)):null;
 const pageTitle=tab==="train"&&active?active.name:labels[tab];
 return <div className="app" data-theme={settings?.theme??"dark"}>
  <header className="topbar">
   <div className="topbar-copy"><span className="eyebrow">GYM PWA</span><h1>{pageTitle}</h1><span className={`sync-inline ${syncStatus}`} aria-live="polite"><i aria-hidden="true"/> {syncLabel}</span>{active&&tab!=="train"&&<span className="workout-live">Trening trwa · {fmtDuration(Math.floor((now-active.startedAt)/1000))}</span>}</div>
   {active&&tab==="train"&&<div className="topbar-actions"><button className="timer-shortcut" onClick={openWorkoutTimer}>{active.rest?"PRZERWA":"TIMER"}</button><button className="finish-button" onClick={()=>void finishWorkout()}>Zakończ</button></div>}
   {active&&tab!=="train"&&<button className="return-to-workout" onClick={()=>setTab("train")}>Do treningu</button>}
  </header>
  {localSaveError&&<div className="local-save-error" role="alert">Nie udało się zapisać zmian lokalnie. Sprawdź dostępne miejsce i ponów działanie.</div>}
  {updateNotice&&<div className="update-notice" role="status"><span>{updateNotice.message}</span>{updateNotice.canReload&&<button onClick={()=>void activateUpdate()}>ODŚWIEŻ</button>}</div>}
  <main>
   <Suspense fallback={<section className="section"><p className="muted">Otwieranie ekranu…</p></section>}>
   {tab==="train"&&(active?<ActiveView active={active} displayName={displayName} now={now} settings={settings} catalog={exerciseCatalog(templates)} previousSets={name=>previousSets(workouts,name)} previousExercise={exercise=>previousExerciseForWorkout(active,workouts,exercise)} setField={updateSetField} copyPrevious={usePreviousResult} completeSet={completeSet} addSet={addSet} addWarmup={addWarmup} removeSet={removeSet} changeSetType={changeSetType} updateExerciseNote={updateExerciseNote} updateNextSessionNote={updateNextSessionNote} dismissPreviousNote={dismissPreviousNote} togglePlateTools={togglePlateTools} skipExercise={skipExercise} resumeExercise={resumeExercise} moveExercise={moveExercise} swapExercise={swapExercise} selectExercise={selectExercise} navigateExercise={navigateExercise} discard={discardWorkout} openTimer={openWorkoutTimer}/>:<TrainHome displayName={displayName} templates={templates} workouts={workouts} active={active} onStart={startWorkout} onContinue={()=>setTab("train")}/>)}
   {tab==="plan"&&<PlanScreen settings={settings} templates={templates} workouts={workouts} active={active} onSave={saveTemplate} onCreate={createTemplate} onDelete={deleteTemplate} onStart={startWorkout} onContinue={()=>setTab("train")} notify={notify}/>}
   {tab==="history"&&<HistoryScreen workouts={workouts} body={body} catalog={exerciseCatalog(templates)} userId={userId} syncStatus={syncStatus} onSave={saveHistory} onSaveReview={saveWorkoutReview} onDelete={deleteHistory} onRetry={onSyncNow} notify={notify}/>}
   {tab==="progress"&&<ProgressScreen workouts={workouts} body={body}/>}
   {tab==="more"&&<MoreScreen settings={settings} body={body} accountEmail={accountEmail} displayName={displayName} syncStatus={syncStatus} onSyncNow={onSyncNow} onSignOut={onSignOut} onUpdateDisplayName={onUpdateDisplayName} onChangePassword={onChangePassword} onDeleteAccount={onDeleteAccount} onSaveSettings={saveSettings} onAddBody={addBody} exportJson={exportJson} importJson={importJson} exportCsv={exportCsv} notify={notify}/>}
   {tab==="summary"&&finishedWorkout&&<WorkoutSummaryScreen workout={finishedWorkout} history={workouts.filter(item=>item.id!==finishedWorkout.id)} userId={userId} syncStatus={syncStatus} onDone={()=>{setFinishedWorkout(null);setTab("train")}} onHistory={()=>{setFinishedWorkout(null);setTab("history")}} onSavePlanChanges={saveWorkoutChangesToPlan} onSaveReview={(workoutId,patch)=>saveWorkoutReview(workoutId,patch)} onRetry={onSyncNow} notify={notify}/>}
   </Suspense>
  </main>
  {active?.rest&&!timerOpen&&<RestBar rest={active.rest} remaining={restRemaining} onOpen={openWorkoutTimer} onAdjust={adjustRest} onPause={pauseRest} onSkip={skipRest}/>}
  <nav className="bottom-nav" aria-label="Nawigacja główna">{([["train","Trening","train"],["plan","Plan","plan"],["history","Historia","history"],["progress","Progres","progress"],["more","Więcej","more"]] as [Tab,string,AppIconName][]).map(([key,label,icon])=><button key={key} className={tab===key?"active":""} aria-label={label} aria-current={tab===key?"page":undefined} onClick={()=>setTab(key)}><AppIcon name={icon}/><small>{label}</small></button>)}</nav>
  {manualTimerOpen&&<ManualTimer onClose={()=>setManualTimerOpen(false)} onStart={startManualTimer}/>}
  {timerOpen&&active?.rest&&timerKey&&<Suspense fallback={<div className="timer-loading">Otwieranie timera…</div>}><TimerScreen key={timerKey} rest={active.rest} remaining={restRemaining} now={now} active={active} onClose={()=>setDismissedRestKey(timerKey)} onAdjust={adjustRest} onPause={pauseRest} onSkip={skipRest}/></Suspense>}
  {toast&&<div className="toast" role="status"><span>{toast.message}</span>{toast.undo&&<button onClick={toast.undo}>COFNIJ</button>}</div>}
 </div>;
}

function TrainHome({displayName,templates,workouts,active,onStart,onContinue}:{displayName:string;templates:WorkoutTemplate[];workouts:WorkoutHistory[];active:ActiveWorkout|null;onStart:(template:WorkoutTemplate)=>void;onContinue:()=>void}){
 const last=workouts[0];const todays=new Intl.DateTimeFormat("pl-PL",{weekday:"long",day:"numeric",month:"long"}).format(Date.now());
 const lastSets=last?.exercises.reduce((count,exercise)=>count+exercise.sets.filter(set=>set.completedAt).length,0)||0;
 return <section className="section train-home">
  {displayName&&<p className="home-greeting">Cześć, <b>{displayName}</b></p>}
  <div className="today-label"><b>Dzisiaj</b><span>{capitalize(todays)}</span></div>
  {active&&<button className="continue-workout" onClick={onContinue}><span><b>Kontynuuj {active.name}</b><small>Trening zapisany · {active.exercises.reduce((sum,exercise)=>sum+exercise.sets.filter(set=>set.completedAt).length,0)} serii ukończonych</small></span><span>→</span></button>}
  {!active&&templates[0]&&<div className="home-start"><div><span className="eyebrow">GOTOWY NA TRENING?</span><h2>{templates[0].name}</h2><p>{templates[0].exercises.length} ćwiczeń · około {Math.max(15,Math.round(templates[0].exercises.length*8))} min</p></div><button className="primary" onClick={()=>onStart(templates[0])}>Rozpocznij trening</button></div>}
  <div className="section-heading home-heading"><div><h2>{active?"Twoje plany":"Wybierz trening"}</h2></div><span>{templates.length}</span></div>
  <div className="workout-pick-list">{templates.map(template=>{
   const lastForTemplate=workouts.find(workout=>workout.templateId===template.id);
   return <button key={template.id} className="workout-pick" onClick={()=>onStart(template)} disabled={Boolean(active)}><span><b>{template.name}</b><small>{template.exercises.length} ćwiczeń · ~{Math.max(15,Math.round(template.exercises.length*8))} min{lastForTemplate?` · ostatnio ${relativeDate(lastForTemplate.startedAt)}`:" · jeszcze bez historii"}</small></span><span aria-hidden="true">→</span></button>;
  })}</div>
  {!templates.length&&<p className="empty-state">Dodaj swój pierwszy plan w zakładce Plan.</p>}
  {last&&<section className="last-workout"><div className="section-heading"><div><h2>Ostatni trening</h2></div></div><div className="last-workout-row"><b>{last.name}</b><span>{fmtDate(last.startedAt)}</span></div><div className="last-workout-stats"><span>{fmtDuration(Math.floor((last.endedAt-last.startedAt)/1000))}</span><span>{lastSets} serii</span><span>{Math.round(volume(last)).toLocaleString("pl-PL")} kg</span></div></section>}
  {!last&&<p className="empty-state">Po pierwszym treningu zobaczysz tu swoje ostatnie wyniki.</p>}
 </section>;
}
function ActiveView({active,displayName,now,settings,catalog,previousSets,previousExercise,setField,copyPrevious,completeSet,addSet,addWarmup,removeSet,changeSetType,updateExerciseNote,updateNextSessionNote,dismissPreviousNote,togglePlateTools,skipExercise,resumeExercise,moveExercise,swapExercise,selectExercise,navigateExercise,discard,openTimer}:{
 active:ActiveWorkout;displayName:string;now:number;settings:Settings|null;catalog:ExerciseTemplate[];previousSets:(name:string)=>SetLog[];previousExercise:(exercise:ExerciseLog)=>ExerciseLog|undefined;
 setField:(exerciseId:string,setId:string,field:Field,value:string)=>Promise<void>;copyPrevious:(exerciseId:string,setId:string,source:SetLog)=>Promise<void>;completeSet:(exerciseId:string,setId:string)=>Promise<void>;
 addSet:(exerciseId:string)=>Promise<void>;addWarmup:(exerciseId:string)=>Promise<void>;removeSet:(exerciseId:string,setId:string)=>Promise<void>;changeSetType:(exerciseId:string,setId:string,type:SetType)=>Promise<void>;
 updateExerciseNote:(exerciseId:string,note:string)=>Promise<void>;updateNextSessionNote:(exerciseId:string,note:string)=>Promise<void>;dismissPreviousNote:(exerciseId:string)=>Promise<void>;togglePlateTools:(exerciseId:string)=>Promise<void>;skipExercise:(exerciseId:string)=>Promise<void>;resumeExercise:(exerciseId:string)=>Promise<void>;
 moveExercise:(exerciseId:string)=>Promise<void>;swapExercise:(exerciseId:string,target:ExerciseTemplate,saveToPlan:boolean)=>Promise<void>;selectExercise:(exerciseId:string)=>Promise<void>;navigateExercise:(direction:-1|1)=>Promise<void>;discard:()=>void;openTimer:()=>void
}){
 const [exerciseSheetOpen,setExerciseSheetOpen]=useState(false),[swapOpen,setSwapOpen]=useState(false),[swapSearch,setSwapSearch]=useState(""),[swapTarget,setSwapTarget]=useState<ExerciseTemplate|null>(null),[saveSwapToPlan,setSaveSwapToPlan]=useState(false);
 const [plateOpen,setPlateOpen]=useState(false),[plateTarget,setPlateTarget]=useState("");
 const visible=active.exercises.filter(item=>item.status!=="replaced"),actualIndex=currentExerciseIndex(active),exercise=active.exercises[actualIndex];
 if(!exercise)return <section className="section"><Empty text="Ten trening nie ma już ćwiczeń."/><button className="quiet-button danger-text" onClick={discard}>Odrzuć trening</button></section>;
 const exerciseId=exerciseLogId(exercise),index=Math.max(0,visible.findIndex(item=>exerciseLogId(item)===exerciseId)),count=visible.length;
 const skipped=exercise.status==="skipped",setIndex=skipped?-1:firstIncompleteSetIndex(exercise),previousEntry=previousExercise(exercise),previous=previousEntry?.sets.filter(set=>set.completedAt&&set.type!=="warmup")??previousSets(exercise.name).filter(set=>set.type!=="warmup");
 const suggestion=progressionSuggestion(previousEntry,exercise.target,settings?.defaultIncrement??2.5);
 const countable=active.exercises.filter(item=>item.status!=="skipped"),completeSets=countable.reduce((sum,item)=>sum+item.sets.filter(entry=>entry.completedAt&&entry.type!=="warmup").length,0);
 const allSets=countable.reduce((sum,item)=>sum+item.sets.filter(entry=>entry.type!=="warmup"&&(item.status!=="replaced"||entry.completedAt)).length,0);
 const progress=count?Math.round((index+1)/count*100):0;
 const warmupEligible=isBarbellExercise(exercise.name,exercise.target.equipment),barbell=isBarbellExercise(exercise.name,exercise.target.equipment,exercise.target.plateCalculatorEnabled),currentSet=exercise.sets[setIndex];
 const calculator=plateOpen?calculatePlates(Number(plateTarget.trim().replace(",",".")),settings?.barWeight??20,settings?.availablePlates??[]):null;
 const matchingExercises=catalog.filter(item=>item.id!==exercise.templateExerciseId&&item.name.toLocaleLowerCase("pl-PL").includes(swapSearch.toLocaleLowerCase("pl-PL"))).slice(0,30);
 const fieldId=(setId:string,field:Field)=>`set-${exerciseId}-${setId}-${field}`;
 function focusNext(setId:string,field:Field){
  const next:Field|undefined=field==="weight"?"reps":field==="reps"?"rir":undefined;
  if(next){const input=document.getElementById(fieldId(setId,next)) as HTMLInputElement|null;input?.focus({preventScroll:true});input?.scrollIntoView({block:"nearest",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}
 }
 function onFieldKey(event:React.KeyboardEvent<HTMLInputElement>,setId:string,field:Field){
  if(event.key!=="Enter")return;event.preventDefault();
  void setField(exerciseId,setId,field,event.currentTarget.value).then(()=>{
   if(field==="rir")void completeSet(exerciseId,setId);else focusNext(setId,field);
  });
 }
 function useAllPrevious(){
  for(const item of exercise.sets){if(item.completedAt||item.type==="warmup")continue;const prior=previous.find(entry=>entry.setNo===item.setNo)||previous.at(-1);if(prior)void copyPrevious(exerciseId,item.id,prior)}
 }
 function copyCurrent(target:SetLog,source:SetLog){void copyPrevious(exerciseId,target.id,source)}
 function adjustWeight(item:SetLog,delta:number){const value=toFiniteNumber(item.weight);const next=Math.max(0,(value??0)+delta);void setField(exerciseId,item.id,"weight",String(Number(next.toFixed(2))))}
 return <section className="section active-workout">
  <div className="workout-info-row"><span>{fmtDuration(Math.floor((now-active.startedAt)/1000))}</span><span>{completeSets}/{allSets} serii</span>{displayName&&<span className="workout-greeting">Cześć, {displayName}</span>}<button className="quiet-button danger-text" onClick={discard}>Odrzuć</button></div>
  <div className="exercise-progress"><button className="exercise-count-button" onClick={()=>setExerciseSheetOpen(true)} aria-label="Pokaż ćwiczenia">{index+1} / {count} <span>ćwiczeń ▾</span></button><div className="progress-track" role="progressbar" aria-label="Postęp treningu" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:`${progress}%`}}/></div></div>
  <article className="current-exercise" key={exerciseId}>
   <div className="current-exercise-heading"><div className="exercise-title-row"><h2>{exercise.name}</h2><details className="exercise-menu"><summary aria-label="Opcje ćwiczenia">···</summary><div>
    <button onClick={()=>{setSwapOpen(true);setSwapTarget(null);setSwapSearch("");setSaveSwapToPlan(false)}}>Zamień ćwiczenie</button>
    {skipped?<button onClick={()=>void resumeExercise(exerciseId)}>Wznów ćwiczenie</button>:<button onClick={()=>void skipExercise(exerciseId)}>Pomiń ćwiczenie</button>}
    {!skipped&&<button onClick={()=>void moveExercise(exerciseId)}>Przenieś na później</button>}
    {!warmupEligible&&<button onClick={()=>void togglePlateTools(exerciseId)}>{exercise.target.plateCalculatorEnabled?"Ukryj kalkulator talerzy":"Pokaż kalkulator talerzy"}</button>}
    <button onClick={()=>document.getElementById(`next-note-${exerciseId}`)?.focus()}>Dodaj notatkę</button>
   </div></details></div><p>{exercise.target.sets} × {exercise.target.timed?"czas":`${exercise.target.repMin}–${exercise.target.repMax}`} <span>·</span> RIR {exercise.target.rir} <span>·</span> tempo {exercise.target.tempo}</p><small>PRZERWA {fmtDuration(exercise.target.restSec)}</small>{skipped&&<span className="skipped-badge">Pominięto</span>}</div>
   {settings?.showExerciseImages===true&&<ExerciseImage exerciseId={exercise.templateExerciseId}/>}
   {exercise.previousSessionNote&&!exercise.previousNoteDismissed&&<section className="previous-session-note"><div><b>Z OSTATNIEGO TRENINGU</b><button aria-label="Usuń notatkę z poprzedniego treningu" onClick={()=>void dismissPreviousNote(exerciseId)}>Usuń</button></div><p>{exercise.previousSessionNote}</p></section>}
   {!skipped&&previous.length>0&&<section className="previous-sets"><div><b>OSTATNIO</b><span>{previousEntry?new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"short"}).format(previousEntry.sets[0]?.completedAt??active.startedAt):""}</span></div><p>{previous.filter(item=>item.type!=="warmup").map(item=><button type="button" key={item.id} title="Wypełnij tę serię danymi z ostatniego treningu" onClick={()=>currentSet&&copyCurrent(currentSet,item)}>S{item.setNo} · {item.weight??"—"} × {item.reps??"—"}</button>)}</p><button className="quiet-button" onClick={useAllPrevious}>Użyj poprzednich</button></section>}
   {!skipped&&suggestion&&<div className={`progression-suggestion ${suggestion.kind}`}><small>CEL NASTĘPNYM RAZEM</small><b>{suggestion.kind==="increase"?`${suggestion.targetWeight} kg`:`Powtórz ${suggestion.currentWeight} kg`}</b>{suggestion.kind==="repeat"&&<span>Utrzymaj ciężar i spróbuj poprawić wynik.</span>}</div>}
   {skipped?<div className="exercise-complete"><b>Ćwiczenie pominięte</b><span>Nie wliczamy go do wykonanych serii.</span><button className="primary" onClick={()=>void resumeExercise(exerciseId)}>Wznów ćwiczenie</button></div>:<>
    {warmupEligible&&<button className="warmup-action" disabled={exercise.sets.length>=30} onClick={()=>void addWarmup(exerciseId)}>＋ DODAJ ROZGRZEWKĘ</button>}
    <div className="set-table" role="table" aria-label={`Serie ćwiczenia ${exercise.name}`}>
     <div className="set-table-heading" role="row"><span role="columnheader">SERIA</span><span role="columnheader">OSTATNIO</span><span role="columnheader">KG</span><span role="columnheader">{exercise.target.timed?"SEK.":"POWT."}</span><span role="columnheader">RIR</span><span role="columnheader" aria-label="Zakończona"/><span role="columnheader" aria-label="Opcje serii"/></div>
     {exercise.sets.map((item,rowIndex)=>{
      const done=Boolean(item.completedAt),isCurrent=rowIndex===setIndex,previousSet=previous.find(previousItem=>previousItem.setNo===item.setNo),priorCurrent=exercise.sets.slice(0,rowIndex).reverse().find(set=>set.completedAt&&set.type!=="warmup");
      const increment=exercise.target.minIncrement??settings?.defaultIncrement??2.5;
      return <div className={`set-table-row ${done?"completed":""} ${isCurrent?"current":""} ${item.type&&item.type!=="normal"?`set-${item.type}`:""}`} role="row" key={item.id}>
       <span className="set-number" role="cell">{done?<span aria-label="Zakończona">✓</span>:item.setNo}</span>
       <span role="cell">{previousSet?<button type="button" className="previous-result" aria-label={`Skopiuj poprzednią serię ${previousSet.weight??"brak"} kg × ${previousSet.reps??"brak"}`} disabled={done||previousSet.weight==null&&previousSet.reps==null} onClick={()=>copyCurrent(item,previousSet)}>{previousSet.weight??"—"} × {previousSet.reps??"—"}</button>:<span className="previous-empty">—</span>}</span>
       <div className="set-weight-cell" role="cell"><input id={fieldId(item.id,"weight")} aria-label={`Ciężar seria ${item.setNo}`} inputMode="decimal" autoComplete="off" placeholder="kg" value={item.weight??""} disabled={done||skipped} onFocus={event=>event.currentTarget.select()} onKeyDown={event=>onFieldKey(event,item.id,"weight")} onChange={event=>void setField(exerciseId,item.id,"weight",event.target.value)}/>
        {isCurrent&&!done&&<><div className="weight-adjust"><button type="button" aria-label={`Odejmij ${increment} kg`} onClick={()=>adjustWeight(item,-increment)}>−{increment}</button><button type="button" aria-label={`Dodaj ${increment} kg`} onClick={()=>adjustWeight(item,increment)}>+{increment}</button></div>{barbell&&<button type="button" className="plate-open" onClick={()=>{setPlateTarget(String(item.weight??""));setPlateOpen(true)}}>TALERZE</button>}{priorCurrent&&<button type="button" className="copy-current-set" onClick={()=>copyCurrent(item,priorCurrent)}>↳ {priorCurrent.weight??"—"} × {priorCurrent.reps??"—"}</button>}</>}
       </div>
       <input id={fieldId(item.id,"reps")} role="cell" aria-label={`${exercise.target.timed?"Czas":"Powtórzenia"} seria ${item.setNo}`} inputMode="numeric" autoComplete="off" placeholder={exercise.target.timed?"sek.":String(exercise.target.repMin)} value={item.reps??""} disabled={done||skipped} onFocus={event=>event.currentTarget.select()} onKeyDown={event=>onFieldKey(event,item.id,"reps")} onChange={event=>void setField(exerciseId,item.id,"reps",event.target.value)}/>
       <input id={fieldId(item.id,"rir")} role="cell" aria-label={`RIR seria ${item.setNo}`} title={item.toFailure?"Seria do upadku jest liczona jako RIR 0; wpisana wartość pozostaje zachowana.":undefined} inputMode="decimal" autoComplete="off" placeholder={exercise.target.rir} value={item.rir??""} disabled={done||skipped} onFocus={event=>event.currentTarget.select()} onKeyDown={event=>onFieldKey(event,item.id,"rir")} onChange={event=>void setField(exerciseId,item.id,"rir",event.target.value)}/>
       <button role="cell" className="set-complete" aria-label={`Zakończ serię ${item.setNo}`} aria-pressed={done} disabled={done||!isCurrent||skipped} onClick={()=>void completeSet(exerciseId,item.id)}>✓</button>
       <details className="set-options" role="cell"><summary aria-label={`Opcje serii ${item.setNo}`}>···</summary><div><label>Typ<select aria-label={`Typ serii ${item.setNo}`} value={item.type??"normal"} onChange={event=>void changeSetType(exerciseId,item.id,event.target.value as SetType)}><option value="normal">Normalna</option><option value="warmup">Rozgrzewkowa</option><option value="drop">Drop set</option><option value="failure">Do upadku</option></select></label><button type="button" className="danger-text" onClick={()=>void removeSet(exerciseId,item.id)}>Usuń serię · COFNIJ</button></div></details>
      </div>;
     })}
    </div>
    <button className="add-set-link" disabled={exercise.sets.length>=30} onClick={()=>void addSet(exerciseId)}>+ Dodaj serię</button>
    <label className="exercise-note">NOTATKA<textarea rows={2} maxLength={300} placeholder="Opcjonalnie: ból barku, ustawienie sprzętu…" value={exercise.note??""} onChange={event=>void updateExerciseNote(exerciseId,event.target.value)}/></label>
    <label className="exercise-note next-session-field">NA NASTĘPNY RAZ<textarea id={`next-note-${exerciseId}`} rows={2} maxLength={200} placeholder="Np. spróbuj 32,5 kg lub zmień uchwyt" value={exercise.nextSessionNote??""} onChange={event=>void updateNextSessionNote(exerciseId,event.target.value)}/><small>Pokażemy tę notatkę przy ćwiczeniu w kolejnej sesji.</small></label>
    {setIndex<0&&<div className="exercise-complete"><b>Wszystkie serie wykonane</b><span>Możesz przejść dalej albo wrócić do zapisanych serii.</span></div>}
   </>}
  </article>
  <div className="exercise-navigation"><button onClick={()=>void navigateExercise(-1)} disabled={index===0}>← Poprzednie</button><button onClick={()=>void navigateExercise(1)} disabled={index===count-1}>Następne ćwiczenie →</button></div>
  <button className="manual-timer-link" onClick={openTimer}>Timer ręczny</button>
  {exerciseSheetOpen&&<div className="timer-overlay exercise-sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="exercise-sheet-title"><section className="exercise-sheet"><header><div><span className="eyebrow">TRENING</span><h2 id="exercise-sheet-title">Ćwiczenia</h2></div><button className="quiet-button" onClick={()=>setExerciseSheetOpen(false)}>Zamknij</button></header><p className="exercise-legend">✓ wykonane · ● aktualne · ○ pozostałe · — pominięte</p>{visible.map(item=>{const itemId=exerciseLogId(item),status=exerciseNavigationStatus(active,itemId),marker=status==="skipped"?"—":status==="current"?"●":status==="completed"?"✓":"○";return <button key={itemId} className={`exercise-sheet-row ${status==="skipped"?"skipped":""}`} onClick={()=>{void selectExercise(itemId);setExerciseSheetOpen(false)}}><span>{marker}</span><b>{item.name}</b><small>{status==="skipped"?"Pominięto":status==="completed"?"Wykonane":`${item.sets.filter(set=>set.completedAt&&set.type!=="warmup").length}/${item.sets.filter(set=>set.type!=="warmup").length} serii`}</small></button>})}</section></div>}
  {swapOpen&&<div className="timer-overlay exercise-sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="swap-title"><section className="exercise-sheet swap-sheet"><header><div><span className="eyebrow">ZAMIANA W TYM TRENINGU</span><h2 id="swap-title">Wybierz ćwiczenie</h2></div><button className="quiet-button" onClick={()=>setSwapOpen(false)}>Zamknij</button></header><input className="search-input" autoFocus placeholder="Szukaj ćwiczenia" value={swapSearch} onChange={event=>{setSwapSearch(event.target.value);setSwapTarget(null)}}/>{!swapTarget?<div className="swap-results">{matchingExercises.map(item=><button key={item.id} onClick={()=>setSwapTarget(item)}><b>{item.name}</b><small>{item.sets} × {item.repMin}–{item.repMax}</small></button>)}</div>:<div className="swap-confirm"><h3>{swapTarget.name}</h3><p>Serie ukończone w {exercise.name} zostaną zachowane w historii. Nowe ćwiczenie dostanie własne serie robocze.</p><label><input type="checkbox" checked={saveSwapToPlan} onChange={event=>setSaveSwapToPlan(event.target.checked)}/> Zapisz także w planie</label><button className="primary" onClick={()=>{void swapExercise(exerciseId,swapTarget,saveSwapToPlan);setSwapOpen(false)}}>{saveSwapToPlan?"Zamień i zapisz w planie":"Zamień tylko w tym treningu"}</button></div>}</section></div>}
  {plateOpen&&currentSet&&<div className="timer-overlay exercise-sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="plate-title"><section className="plate-sheet"><header><div><span className="eyebrow">KALKULATOR</span><h2 id="plate-title">Talerze</h2></div><button className="quiet-button" onClick={()=>setPlateOpen(false)}>Zamknij</button></header><label className="field-label">CEL (KG)<input inputMode="decimal" value={plateTarget} onChange={event=>setPlateTarget(event.target.value)}/></label><div className="plate-output"><span>GRYF</span><b>{settings?.barWeight??20} kg</b><span>NA KAŻDĄ STRONĘ</span>{calculator&&<><b>{calculator.nearest.platesPerSide.length?calculator.nearest.platesPerSide.map(value=>`${value} kg`).join(" + "):"bez talerzy"}</b><small>{calculator.exact?"Dokładne dopasowanie":`Najbliżej: ${calculator.nearest.weight} kg`}</small>{!calculator.exact&&(calculator.below||calculator.above)&&<p>{calculator.below?`Poniżej ${calculator.below.weight} kg`:""}{calculator.below&&calculator.above?" · ":""}{calculator.above?`powyżej ${calculator.above.weight} kg`:""}</p>}</>}</div>{calculator&&<button className="primary" onClick={()=>{void setField(exerciseId,currentSet.id,"weight",String(calculator.nearest.weight));setPlateOpen(false)}}>Wpisz {calculator.nearest.weight} kg</button>}</section></div>}
 </section>;
}

function RestBar({rest,remaining,onOpen,onAdjust,onPause,onSkip}:{rest:RestState;remaining:number;onOpen:()=>void;onAdjust:(seconds:number)=>void;onPause:()=>void;onSkip:()=>void}){
 const paused=rest.pausedRemaining!==undefined,ended=remaining<=0&&!paused;
 return <div className={`rest-bar ${ended?"ended":""}`}>
  <button className="rest-bar-open" onClick={onOpen}><small>{rest.kind==="manual"?"TIMER":ended?"PRZERWA ZAKOŃCZONA":"PRZERWA"}</small><b>{clock(remaining)}</b><span>{rest.kind==="manual"?"Timer ręczny":rest.exerciseName}</span></button>
  <div className="rest-bar-actions"><button aria-label="Odejmij 30 sekund" disabled={ended} onClick={()=>onAdjust(-30)}>−30</button><button aria-label={paused?"Wznów":"Pauza"} disabled={ended} onClick={onPause}>{paused?"Wznów":"Pauza"}</button><button aria-label="Dodaj 30 sekund" disabled={ended} onClick={()=>onAdjust(30)}>+30</button><button aria-label={ended?"Wróć do treningu":"Pomiń przerwę"} onClick={onSkip}>{ended?"Wróć":"Pomiń"}</button></div>
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
 for(const workout of workouts){const exercise=workout.exercises.find(item=>item.name===name&&item.status!=="skipped"&&item.status!=="replaced");const sets=exercise?.sets.filter(set=>set.completedAt);if(sets?.length)return sets}
 return [];
}
function previousExerciseForWorkout(active:ActiveWorkout,workouts:WorkoutHistory[],exercise:ExerciseLog):ExerciseLog|undefined{
 const prior=workouts.filter(item=>item.templateId===active.templateId&&item.startedAt<active.startedAt).sort((a,b)=>b.startedAt-a.startedAt);
 for(const workout of prior){const match=workout.exercises.find(item=>item.status!=="skipped"&&item.status!=="replaced"&&item.templateExerciseId===exercise.templateExerciseId)||workout.exercises.find(item=>item.status!=="skipped"&&item.status!=="replaced"&&item.name===exercise.name);if(match?.sets.some(set=>set.completedAt))return match}
 return undefined;
}
function bestActiveE1rm(workout:ActiveWorkout,exerciseName:string,excludeSetId:string){
 let best=0;
 for(const exercise of workout.exercises)if(exercise.name===exerciseName&&!exercise.target.timed)for(const set of exercise.sets){
  if(set.id===excludeSetId||!set.completedAt||!isPrCandidate(set,false))continue;
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
function relativeDate(timestamp:number){
 const today=new Date();today.setHours(0,0,0,0);const day=new Date(timestamp);day.setHours(0,0,0,0);
 const days=Math.max(0,Math.floor((today.getTime()-day.getTime())/86_400_000));
 if(days===0)return "dzisiaj";
 if(days===1)return "wczoraj";
 if(days<7)return `${days} dni temu`;
 return fmtDate(timestamp);
}
function clock(milliseconds:number){const seconds=Math.max(0,Math.ceil(milliseconds/1000));return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`}
