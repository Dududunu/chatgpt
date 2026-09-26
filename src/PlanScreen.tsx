import { useMemo, useState } from "react";
import { actual1rm, bestE1rm } from "./stats";
import { toFiniteNumber } from "./workoutLogic";
import { defaultTemplates } from "./seed";
import { addTemplateExercise, createWorkoutTemplate, duplicateWorkoutTemplate, moveTemplateExercise, removeTemplateExercise, updateTemplateExercise, validateWorkoutTemplate } from "./planLogic";
import type { ActiveWorkout, ExerciseTemplate, Settings, WorkoutHistory, WorkoutTemplate } from "./types";
import { ExerciseMotion } from "./ExerciseMotion";

type Props={
 settings:Settings|null;
 templates:WorkoutTemplate[];
 workouts:WorkoutHistory[];
 active:ActiveWorkout|null;
 onSave:(template:WorkoutTemplate)=>Promise<void>;
 onCreate:(template:WorkoutTemplate)=>Promise<void>;
 onDelete:(id:string)=>Promise<void>;
 onStart:(template:WorkoutTemplate)=>void;
 onContinue:()=>void;
 notify:(message:string)=>void;
};

const id=()=>crypto.randomUUID();
const uniqueExercises=(templates:WorkoutTemplate[])=>{
 const byId=new Map<string,ExerciseTemplate>();
 for(const template of [...defaultTemplates,...templates]) for(const exercise of template.exercises) if(!byId.has(exercise.id)) byId.set(exercise.id,exercise);
 return [...byId.values()];
};

export function PlanScreen({settings,templates,workouts,active,onSave,onCreate,onDelete,onStart,onContinue,notify}:Props){
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [createOpen,setCreateOpen]=useState(false);
 const [newName,setNewName]=useState("");
 const [libraryQuery,setLibraryQuery]=useState("");
 const [dragId,setDragId]=useState<string|null>(null);
 const [draft,setDraft]=useState<WorkoutTemplate|null>(null);
 const catalog=useMemo(()=>uniqueExercises(templates),[templates]);
 const selected=templates.find(template=>template.id===selectedId)||null;

 function openTemplate(template:WorkoutTemplate){setSelectedId(template.id);setDraft(structuredClone(template));setCreateOpen(false)}
 async function createTemplate(){
  const name=newName.trim();
  if(!name){notify("Wpisz nazwę treningu");return}
  const template=createWorkoutTemplate(name,id());
  await onCreate(template);setNewName("");setCreateOpen(false);openTemplate(template);
 }
 async function saveDraft(){
  if(!draft)return;
  if(!draft.name.trim()){notify("Nazwa treningu nie może być pusta");return}
  const cleaned={...draft,name:draft.name.trim()};
  const validation=validateWorkoutTemplate(cleaned);if(validation){notify(validation);return}
  await onSave(cleaned);setDraft(structuredClone(cleaned));notify("Plan zapisany");
 }
 async function duplicate(template:WorkoutTemplate){
  const copy=duplicateWorkoutTemplate(template,id());
  await onCreate(copy);notify("Trening zduplikowany");
 }
 async function deleteTemplate(template:WorkoutTemplate){
  if(!confirm(`Usunąć plan „${template.name}”? Zapisane treningi pozostaną w historii.`))return;
  await onDelete(template.id);setSelectedId(null);setDraft(null);notify("Plan usunięty");
 }
 function changeDraft(next:WorkoutTemplate){setDraft(next)}

 if(selected&&draft){
  const groupIds=[...new Set(draft.exercises.map(exercise=>exercise.superset).filter((value):value is string=>Boolean(value)))];
  const groups=[...new Set([...groupIds,"superset-a","superset-b"])].slice(0,4);
  const rows=draft.exercises;
  const onDropAt=(targetId:string)=>{
   if(!dragId||dragId===targetId)return;
   const targetIndex=rows.findIndex(item=>item.id===targetId);
   changeDraft(moveTemplateExercise(draft,dragId,targetIndex));
  };
  return <section className="section plan-screen">
   <button className="back-link" onClick={()=>{setSelectedId(null);setDraft(null)}}>← Wszystkie plany</button>
   <div className="editor-title">
    <label className="field-label">NAZWA TRENINGU<input value={draft.name} maxLength={36} onChange={event=>changeDraft({...draft,name:event.target.value})}/></label>
    <div className="editor-actions"><button className="quiet-button" onClick={()=>void duplicate(selected)}>Duplikuj</button><button className="quiet-button danger-text" onClick={()=>void deleteTemplate(selected)}>Usuń plan</button></div>
   </div>
   <div className="plan-editor-heading"><div><strong>{rows.length} ćwiczeń</strong><span>Przeciągnij uchwyt, aby zmienić kolejność</span></div><button className="primary compact" disabled={!rows.length||Boolean(active)} onClick={()=>onStart({...draft,name:draft.name.trim()})}>Rozpocznij</button></div>
   <div className="editor-exercises">
    {rows.map((exercise,index)=><div className={`editor-exercise ${dragId===exercise.id?"dragging":""}`} key={exercise.id} data-exercise-id={exercise.id}
     onDragOver={event=>{event.preventDefault();onDropAt(exercise.id)}} onDragEnd={()=>setDragId(null)}>
     <div className="editor-exercise-top">
      <button className="drag-handle" aria-label={`Przesuń ${exercise.name}`} title="Przeciągnij, aby zmienić kolejność" draggable onDragStart={event=>{setDragId(exercise.id);event.dataTransfer.effectAllowed="move"}} onPointerDown={()=>setDragId(exercise.id)} onPointerMove={event=>{
       if(!dragId||dragId!==exercise.id)return;
       const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-exercise-id]");
       const targetId=target?.dataset.exerciseId;
       if(targetId&&targetId!==exercise.id)onDropAt(targetId);
      }} onPointerUp={()=>setDragId(null)} onPointerCancel={()=>setDragId(null)}>⠿</button>
      <div className="editor-exercise-name"><b>{index+1}. {exercise.name}</b><span>{exercise.sets} × {exercise.timed?"czas":`${exercise.repMin}–${exercise.repMax}`} · przerwa {time(exercise.restSec)}</span></div>
      <div className="reorder-buttons"><button aria-label="Przesuń w górę" disabled={index===0} onClick={()=>changeDraft(moveTemplateExercise(draft,exercise.id,index-1))}>↑</button><button aria-label="Przesuń w dół" disabled={index===rows.length-1} onClick={()=>changeDraft(moveTemplateExercise(draft,exercise.id,index+1))}>↓</button></div>
     </div>
     <details className="exercise-edit-details"><summary>Edytuj ustawienia</summary>
      <div className="edit-fields">
       <label className="field-label span-two">NAZWA<input value={exercise.name} onChange={event=>changeDraft(updateTemplateExercise(draft,exercise.id,{name:event.target.value}))}/></label>
       <label className="field-label">SERIE<input type="number" inputMode="numeric" min="1" max="20" value={exercise.sets} onChange={event=>changeDraft(updateTemplateExercise(draft,exercise.id,{sets:boundedInt(event.target.value,1,20,exercise.sets)}))}/></label>
       <label className="field-label">RIR<input value={exercise.rir} onChange={event=>changeDraft(updateTemplateExercise(draft,exercise.id,{rir:event.target.value}))}/></label>
       <label className="field-label">POWT. OD<input type="number" inputMode="numeric" min="0" max="300" value={exercise.repMin} onChange={event=>changeDraft(updateTemplateExercise(draft,exercise.id,{repMin:boundedInt(event.target.value,0,300,exercise.repMin)}))}/></label>
       <label className="field-label">POWT. DO<input type="number" inputMode="numeric" min="0" max="300" value={exercise.repMax} onChange={event=>changeDraft(updateTemplateExercise(draft,exercise.id,{repMax:boundedInt(event.target.value,0,300,exercise.repMax)}))}/></label>
       <label className="field-label">TEMPO<input value={exercise.tempo} onChange={event=>changeDraft(updateTemplateExercise(draft,exercise.id,{tempo:event.target.value}))}/></label>
       <label className="field-label">PRZERWA (SEK.)<input type="number" inputMode="numeric" min="0" max="1800" value={exercise.restSec} onChange={event=>changeDraft(updateTemplateExercise(draft,exercise.id,{restSec:boundedInt(event.target.value,0,1800,exercise.restSec)}))}/></label>
       <label className="field-label">KROK (KG)<input type="number" inputMode="decimal" min="0.1" step="0.1" value={exercise.minIncrement??2.5} onChange={event=>changeDraft(updateTemplateExercise(draft,exercise.id,{minIncrement:boundedFloat(event.target.value,0.1,100,exercise.minIncrement??2.5)}))}/></label>
       <label className="field-label">SUPER SERIA<select value={exercise.superset??""} onChange={event=>changeDraft(updateTemplateExercise(draft,exercise.id,{superset:event.target.value||undefined}))}><option value="">Brak</option>{groups.map((group,groupIndex)=><option key={group} value={group}>Grupa {String.fromCharCode(65+groupIndex)}</option>)}</select></label>
       <label className="switch-row span-two">Ćwiczenie na czas<input type="checkbox" checked={Boolean(exercise.timed)} onChange={event=>changeDraft(updateTemplateExercise(draft,exercise.id,{timed:event.target.checked}))}/></label>
       <label className="switch-row span-two">Na każdą stronę<input type="checkbox" checked={Boolean(exercise.perLeg)} onChange={event=>changeDraft(updateTemplateExercise(draft,exercise.id,{perLeg:event.target.checked}))}/></label>
       <button className="quiet-button danger-text remove-exercise" onClick={()=>changeDraft(removeTemplateExercise(draft,exercise.id))}>Usuń ćwiczenie</button>
      </div>
     </details>
    </div>)}
   </div>
   <AddExercise catalog={catalog} template={draft} onChange={changeDraft} defaults={{rir:settings?.defaultRir??"2",restSec:settings?.defaultRestSec??120,increment:settings?.defaultIncrement??2.5}}/>
   <button className="primary save-plan" onClick={()=>void saveDraft()}>Zapisz plan</button>
  </section>;
 }

 const filtered=catalog.filter(exercise=>exercise.name.toLocaleLowerCase("pl-PL").includes(libraryQuery.toLocaleLowerCase("pl-PL")));
 return <section className="section plan-screen">
  <div className="section-heading"><div><h2>Plan treningowy</h2><p>Szablony edytujesz niezależnie od zapisanej historii.</p></div><button className="primary compact" onClick={()=>setCreateOpen(value=>!value)}>+ Nowy trening</button></div>
  {active&&<button className="continue-workout" onClick={onContinue}><span><b>Kontynuuj trening</b><small>{active.name} · {active.exercises.filter(exercise=>exercise.sets.some(set=>set.completedAt)).length} ćwiczeń rozpoczętych</small></span><span>→</span></button>}
  {createOpen&&<form className="create-plan" onSubmit={event=>{event.preventDefault();void createTemplate()}}><label className="field-label">NAZWA NOWEGO TRENINGU<input autoFocus value={newName} onChange={event=>setNewName(event.target.value)} placeholder="np. PUSH" maxLength={36}/></label><button className="primary" type="submit">Utwórz trening</button></form>}
  <div className="plan-list">{templates.map(template=><div className="plan-row" key={template.id}>
   <button className="plan-open" onClick={()=>openTemplate(template)}><span><b>{template.name}</b><small>{template.exercises.length} ćwiczeń</small></span><span aria-hidden="true">›</span></button>
   <button className="quiet-button" aria-label={`Rozpocznij ${template.name}`} disabled={Boolean(active)} onClick={()=>onStart(template)}>Start</button>
  </div>)}</div>
  <Library catalog={catalog} workouts={workouts} query={libraryQuery} onQuery={setLibraryQuery} filtered={filtered}/>
 </section>;
}

function AddExercise({catalog,template,onChange,defaults}:{catalog:ExerciseTemplate[];template:WorkoutTemplate;onChange:(template:WorkoutTemplate)=>void;defaults:{rir:string;restSec:number;increment:number}}){
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState("");
 const [custom,setCustom]=useState(false);
 const [draft,setDraft]=useState({name:"",muscleGroup:"",equipment:"",sets:"3",repMin:"8",repMax:"10",rir:defaults.rir,restSec:String(defaults.restSec),tempo:"2110",minIncrement:String(defaults.increment)});
 const matches=catalog.filter(exercise=>exercise.name.toLocaleLowerCase("pl-PL").includes(query.toLocaleLowerCase("pl-PL")));
 function add(exercise:ExerciseTemplate){onChange(addTemplateExercise(template,exercise));setOpen(false);setQuery("")}
 function addCustom(event:React.FormEvent){
  event.preventDefault();
  if(!draft.name.trim())return;
  add({id:`custom-${id()}`,name:draft.name.trim(),muscleGroup:draft.muscleGroup.trim()||undefined,equipment:draft.equipment.trim()||undefined,sets:boundedInt(draft.sets,1,20,3),repMin:boundedInt(draft.repMin,0,300,8),repMax:boundedInt(draft.repMax,0,300,10),rir:draft.rir,restSec:boundedInt(draft.restSec,0,1800,defaults.restSec),tempo:draft.tempo||"2110",minIncrement:boundedFloat(draft.minIncrement,.1,100,defaults.increment)});
  setDraft({name:"",muscleGroup:"",equipment:"",sets:"3",repMin:"8",repMax:"10",rir:defaults.rir,restSec:String(defaults.restSec),tempo:"2110",minIncrement:String(defaults.increment)});setCustom(false);
 }
 return <div className="add-exercise-area">
  {!open?<button className="add-exercise-button" onClick={()=>setOpen(true)}>+ Dodaj ćwiczenie</button>:<div className="exercise-picker">
   <div className="picker-heading"><b>Dodaj ćwiczenie</b><button className="quiet-button" onClick={()=>setOpen(false)}>Zamknij</button></div>
   <div className="picker-tabs"><button className={!custom?"selected":""} onClick={()=>setCustom(false)}>Biblioteka</button><button className={custom?"selected":""} onClick={()=>setCustom(true)}>Własne</button></div>
   {custom?<form className="edit-fields" onSubmit={addCustom}>
    <label className="field-label span-two">NAZWA<input required value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
    <label className="field-label">PARTIA<input value={draft.muscleGroup} onChange={event=>setDraft({...draft,muscleGroup:event.target.value})}/></label>
    <label className="field-label">SPRZĘT<input value={draft.equipment} onChange={event=>setDraft({...draft,equipment:event.target.value})}/></label>
    <label className="field-label">SERIE<input type="number" inputMode="numeric" value={draft.sets} onChange={event=>setDraft({...draft,sets:event.target.value})}/></label>
    <label className="field-label">RIR<input value={draft.rir} onChange={event=>setDraft({...draft,rir:event.target.value})}/></label>
    <label className="field-label">POWT. OD<input type="number" inputMode="numeric" value={draft.repMin} onChange={event=>setDraft({...draft,repMin:event.target.value})}/></label>
    <label className="field-label">POWT. DO<input type="number" inputMode="numeric" value={draft.repMax} onChange={event=>setDraft({...draft,repMax:event.target.value})}/></label>
    <label className="field-label">TEMPO<input value={draft.tempo} onChange={event=>setDraft({...draft,tempo:event.target.value})}/></label>
    <label className="field-label">PRZERWA (SEK.)<input type="number" inputMode="numeric" value={draft.restSec} onChange={event=>setDraft({...draft,restSec:event.target.value})}/></label>
    <label className="field-label">KROK (KG)<input type="number" inputMode="decimal" step="0.1" value={draft.minIncrement} onChange={event=>setDraft({...draft,minIncrement:event.target.value})}/></label>
    <button className="primary span-two" type="submit">Dodaj własne ćwiczenie</button>
   </form>:<>
    <input className="search-input" aria-label="Szukaj ćwiczenia" placeholder="Szukaj ćwiczenia" value={query} onChange={event=>setQuery(event.target.value)}/>
    <div className="picker-list">{matches.map(exercise=><button key={exercise.id} disabled={template.exercises.some(item=>item.id===exercise.id)} onClick={()=>add(exercise)}><span>{exercise.name}</span><small>{template.exercises.some(item=>item.id===exercise.id)?"Dodane":"Dodaj"}</small></button>)}</div>
   </>}
  </div>}
 </div>;
}

function Library({catalog,workouts,query,onQuery,filtered}:{catalog:ExerciseTemplate[];workouts:WorkoutHistory[];query:string;onQuery:(query:string)=>void;filtered:ExerciseTemplate[]}){
 const [open,setOpen]=useState(false);
 const [openExerciseId,setOpenExerciseId]=useState<string|null>(null);
 return <section className="library-section">
  <button className="library-toggle" onClick={()=>setOpen(value=>!value)}><span><b>Biblioteka ćwiczeń</b><small>{catalog.length} ćwiczeń · ustawienia, podgląd i wyniki</small></span><span>{open?"−":"+"}</span></button>
  {open&&<div className="library-content"><input className="search-input" placeholder="Szukaj w bibliotece" value={query} onChange={event=>onQuery(event.target.value)}/>
   <div className="library-list">{filtered.map(exercise=>{
    const isOpen=openExerciseId===exercise.id;
    const related=workouts.flatMap(workout=>workout.exercises.filter(entry=>entry.name===exercise.name).map(entry=>({workout,entry}))).sort((a,b)=>b.workout.startedAt-a.workout.startedAt);
    const best=bestE1rm(workouts,exercise.name),one=actual1rm(workouts,exercise.name);
    const bestLoad=workouts.flatMap(workout=>workout.exercises.filter(entry=>entry.name===exercise.name&&!entry.target.timed).flatMap(entry=>entry.sets.filter(set=>set.completedAt).map(set=>toFiniteNumber(set.weight)))).filter((weight):weight is number=>weight!==null&&weight>=0).reduce<number|null>((value,weight)=>value===null?weight:Math.max(value,weight),null);
    return <details className="library-exercise" key={exercise.id} open={isOpen} onToggle={event=>{if(event.currentTarget.open)setOpenExerciseId(exercise.id);else if(isOpen)setOpenExerciseId(null)}}><summary><span>{exercise.name}</span><small>{exercise.muscleGroup||"Ćwiczenie"}</small></summary>
     {isOpen&&<div className="library-detail"><div className="library-stats"><span>Najcięższa seria <b>{bestLoad===null?"—":`${bestLoad} kg`}</b></span><span>Actual 1RM <b>{one?`${one} kg`:"—"}</b></span><span>e1RM <b>{best?`${best.toFixed(1)} kg`:"—"}</b></span></div><p>{exercise.equipment||"Sprzęt według planu"} · domyślnie {exercise.sets} serie · {exercise.timed?"czas":`${exercise.repMin}–${exercise.repMax} powt.`} · przerwa {time(exercise.restSec)}</p>
      {related[0]&&<div className="last-performance"><b>Ostatnio · {date(related[0].workout.startedAt)}</b>{related[0].entry.sets.filter(set=>set.completedAt).map(set=><span key={set.id}>{set.weight} × {set.reps}</span>)}</div>}
      <ExerciseMotion exerciseId={exercise.id}/>
     </div>}
    </details>;
   })}</div>
  </div>}
 </section>;
}

const time=(seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
const date=(timestamp:number)=>new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"short"}).format(timestamp);
function boundedInt(value:string,min:number,max:number,fallback:number){const parsed=Number(value);return Number.isFinite(parsed)?Math.max(min,Math.min(max,Math.trunc(parsed))):fallback}
function boundedFloat(value:string,min:number,max:number,fallback:number){const parsed=Number(value.replace(",","."));return Number.isFinite(parsed)?Math.max(min,Math.min(max,parsed)):fallback}
