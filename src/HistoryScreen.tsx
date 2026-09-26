import { useMemo, useState } from "react";
import { volume } from "./stats";
import { normalizeSetForCompletion } from "./workoutLogic";
import type { ExerciseTemplate, SetLog, WorkoutHistory } from "./types";

type Props={workouts:WorkoutHistory[];catalog:ExerciseTemplate[];onSave:(workout:WorkoutHistory)=>Promise<void>;notify:(message:string)=>void};
const duration=(seconds:number)=>{const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return h?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`};
const date=(timestamp:number)=>new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"short",year:"numeric"}).format(timestamp);
const dateTimeValue=(timestamp:number)=>{const d=new Date(timestamp);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};

export function HistoryScreen({workouts,catalog,onSave,notify}:Props){
 const [editingId,setEditingId]=useState<string|null>(null);
 const selected=workouts.find(workout=>workout.id===editingId)||null;
 return <section className="section history-screen">
  <div className="section-heading"><div><h2>Historia</h2><p>Każdy trening zachowuje własny snapshot planu.</p></div></div>
  {!workouts.length?<p className="empty-state">Zakończony trening pojawi się tutaj.</p>:<div className="history-list">{workouts.map(workout=>{
   const completed=workout.exercises.reduce((count,exercise)=>count+exercise.sets.filter(set=>set.completedAt).length,0);
   const seconds=Math.max(0,Math.floor((workout.endedAt-workout.startedAt)/1000));
   return <details className="history-item" key={workout.id} open={editingId===workout.id} onToggle={event=>{if(!event.currentTarget.open&&editingId===workout.id)setEditingId(null)}}>
    <summary><div><b>{workout.name}</b><span>{date(workout.startedAt)}</span></div><div className="history-summary-meta"><b>{duration(seconds)}</b><span>{completed} serii · {Math.round(volume(workout)).toLocaleString("pl-PL")} kg</span></div></summary>
    {editingId===workout.id&&selected?<HistoryEditor workout={selected} catalog={catalog} onCancel={()=>setEditingId(null)} onSave={async value=>{await onSave(value);setEditingId(null);notify("Historia treningu zaktualizowana")}} notify={notify}/>:<>
     <div className="history-exercises">{workout.exercises.map(exercise=><div className="history-exercise" key={`${exercise.templateExerciseId}-${exercise.name}`}><h3>{exercise.name}</h3><div>{exercise.sets.filter(set=>set.completedAt).map(set=><span key={set.id}>{set.weight} kg × {set.reps}{set.rir!==null?` · RIR ${set.rir}`:""}</span>)}</div></div>)}</div>
     <button className="quiet-button history-edit" onClick={()=>setEditingId(workout.id)}>Edytuj trening</button>
    </>}
   </details>;
  })}</div>}
 </section>;
}

function HistoryEditor({workout,catalog,onCancel,onSave,notify}:{workout:WorkoutHistory;catalog:ExerciseTemplate[];onCancel:()=>void;onSave:(workout:WorkoutHistory)=>Promise<void>;notify:(message:string)=>void}){
 const [draft,setDraft]=useState<WorkoutHistory>(()=>structuredClone(workout));
 const byId=useMemo(()=>new Map(catalog.map(exercise=>[exercise.id,exercise])),[catalog]);
 function setValue(exerciseIndex:number,setIndex:number,field:"weight"|"reps"|"rir",value:string){
  setDraft(current=>{const next=structuredClone(current);const set=next.exercises[exerciseIndex].sets[setIndex];set[field]=value===""?null:value;return next});
 }
 function addSet(exerciseIndex:number){
  setDraft(current=>{const next=structuredClone(current),sets=next.exercises[exerciseIndex].sets;const setNo=Math.max(0,...sets.map(set=>set.setNo))+1;sets.push({id:crypto.randomUUID(),setNo,weight:null,reps:null,rir:null,completedAt:null});return next});
 }
 function save(){
  const next=structuredClone(draft);
  if(!next.name.trim()){notify("Wpisz nazwę treningu");return}
  if(!Number.isFinite(next.startedAt)||!Number.isFinite(next.endedAt)||next.endedAt<next.startedAt){notify("Sprawdź datę rozpoczęcia i zakończenia treningu");return}
  next.name=next.name.trim();
  for(const exercise of next.exercises){
   for(const set of exercise.sets){
    const hasInput=[set.weight,set.reps,set.rir].some(value=>value!==null&&value!==undefined&&String(value).trim()!=="");
    if(!set.completedAt&&!hasInput)continue;
    const normalized=normalizeSetForCompletion(set,exercise.target);
    if(!normalized.ok){notify(`Seria ${set.setNo}, ${exercise.name}: ${normalized.message}`);return}
    set.weight=normalized.weight;set.reps=normalized.reps;set.rir=normalized.rir;
    if(!set.completedAt)set.completedAt=Date.now();
   }
  }
  void onSave(next);
 }
 function removeSet(exerciseIndex:number,setIndex:number){
  setDraft(current=>{const next=structuredClone(current);next.exercises[exerciseIndex].sets.splice(setIndex,1);next.exercises[exerciseIndex].sets.forEach((set,index)=>set.setNo=index+1);return next});
 }
 function replaceExercise(exerciseIndex:number,exerciseId:string){
  const target=byId.get(exerciseId);if(!target)return;
  setDraft(current=>{const next=structuredClone(current);const entry=next.exercises[exerciseIndex];entry.templateExerciseId=target.id;entry.name=target.name;entry.target={...target,sets:entry.target.sets};return next});
 }
 return <div className="history-editor">
  <label className="field-label">TRENING<input value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
  <div className="edit-fields history-dates"><label className="field-label">ROZPOCZĘCIE<input type="datetime-local" value={dateTimeValue(draft.startedAt)} onChange={event=>setDraft({...draft,startedAt:new Date(event.target.value).getTime()})}/></label><label className="field-label">ZAKOŃCZENIE<input type="datetime-local" value={dateTimeValue(draft.endedAt)} onChange={event=>setDraft({...draft,endedAt:new Date(event.target.value).getTime()})}/></label></div>
  {draft.exercises.map((exercise,exerciseIndex)=><section className="history-edit-exercise" key={`${exercise.templateExerciseId}-${exerciseIndex}`}>
   <label className="field-label">ĆWICZENIE<select value={exercise.templateExerciseId} onChange={event=>replaceExercise(exerciseIndex,event.target.value)}>{!byId.has(exercise.templateExerciseId)&&<option value={exercise.templateExerciseId}>{exercise.name}</option>}{catalog.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   <div className="history-set-heading"><span>SERIA</span><span>KG</span><span>{exercise.target.timed?"SEK.":"POWT."}</span><span>RIR</span><span/></div>
   {exercise.sets.map((set,setIndex)=><div className="history-set-row" key={set.id}><b>{set.setNo}</b><input aria-label={`${exercise.name} seria ${set.setNo}, kg`} inputMode="decimal" value={set.weight??""} onChange={event=>setValue(exerciseIndex,setIndex,"weight",event.target.value)}/><input aria-label={`${exercise.name} seria ${set.setNo}, powtórzenia`} inputMode="numeric" value={set.reps??""} onChange={event=>setValue(exerciseIndex,setIndex,"reps",event.target.value)}/><input aria-label={`${exercise.name} seria ${set.setNo}, RIR`} inputMode="numeric" value={set.rir??""} onChange={event=>setValue(exerciseIndex,setIndex,"rir",event.target.value)}/><button className="remove-set" aria-label={`Usuń serię ${set.setNo}`} onClick={()=>removeSet(exerciseIndex,setIndex)}>×</button></div>)}
   <button className="add-set-link" onClick={()=>addSet(exerciseIndex)}>+ Dodaj serię</button>
  </section>)}
  <div className="history-editor-actions"><button className="quiet-button" onClick={onCancel}>Anuluj</button><button className="primary compact" onClick={save}>Zapisz zmiany</button></div>
 </div>;
}
