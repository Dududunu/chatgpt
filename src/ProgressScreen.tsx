import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { actual1rm, bestE1rm, e1rm, recentPrCount, volume } from "./stats";
import { toFiniteNumber } from "./workoutLogic";
import type { BodyEntry, SetLog, WorkoutHistory } from "./types";

type Mode="e1rm"|"best"|"volume"|"body";
type Range="1M"|"3M"|"6M"|"1Y"|"ALL";
const ranges:Range[]=["1M","3M","6M","1Y","ALL"];
const rangeMs:Record<Exclude<Range,"ALL">,number>={"1M":30*864e5,"3M":90*864e5,"6M":183*864e5,"1Y":365*864e5};
const dateLabel=(time:number)=>new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"short"}).format(time);
const validStrengthSet=(set:SetLog)=>{
 const weight=toFiniteNumber(set.weight),reps=toFiniteNumber(set.reps);
 return set.completedAt&&weight!==null&&reps!==null&&weight>=0&&reps>0&&Number.isInteger(reps)?{weight,reps}:null;
};

export function ProgressScreen({workouts,body}:{workouts:WorkoutHistory[];body:BodyEntry[]}){
 const [mode,setMode]=useState<Mode>("e1rm");
 const [range,setRange]=useState<Range>("3M");
 const names=useMemo(()=>Array.from(new Set(workouts.flatMap(workout=>workout.exercises.map(exercise=>exercise.name)))),[workouts]);
 const [exerciseName,setExerciseName]=useState("");
 const activeName=names.includes(exerciseName)?exerciseName:names[0]||"";
 const chartData=useMemo(()=>{
  const since=range==="ALL"?0:Date.now()-rangeMs[range];
  if(mode==="body")return body.filter(entry=>entry.date>=since&&entry.weight!=null).slice().reverse().map(entry=>({timestamp:entry.date,label:dateLabel(entry.date),value:entry.weight??0}));
  const selected=workouts.filter(workout=>workout.startedAt>=since).slice().reverse();
  if(mode==="volume")return selected.map(workout=>({timestamp:workout.startedAt,label:dateLabel(workout.startedAt),value:Math.round(volume(workout))})).filter(point=>point.value>0);
  if(mode==="best")return selected.map(workout=>{
   let value=0;
   for(const exercise of workout.exercises)if(exercise.name===activeName&&!exercise.target.timed)for(const set of exercise.sets){const normalized=validStrengthSet(set);if(normalized)value=Math.max(value,normalized.weight)}
   return {timestamp:workout.startedAt,label:dateLabel(workout.startedAt),value};
  }).filter(point=>point.value>0);
  return selected.map(workout=>{
   let value=0;
   for(const exercise of workout.exercises)if(exercise.name===activeName&&!exercise.target.timed)for(const set of exercise.sets){const normalized=validStrengthSet(set);if(normalized){const estimate=e1rm(normalized.weight,normalized.reps);if(Number.isFinite(estimate))value=Math.max(value,estimate)}}
   return {timestamp:workout.startedAt,label:dateLabel(workout.startedAt),value:value?Number(value.toFixed(1)):0};
  }).filter(point=>point.value>0);
 },[mode,range,body,workouts,activeName]);
 const recent=workouts.filter(workout=>workout.startedAt>=Date.now()-30*864e5);
 const latestBody=body.find(entry=>entry.weight!=null)?.weight;
 const benchName="Wyciskanie sztangi na ławce płaskiej";
 const prs=recentPrCount(workouts);
 const actual=actual1rm(workouts,benchName),estimated=bestE1rm(workouts,benchName);
 const highlights=names.map(name=>{
  const sessions=workouts.map(workout=>({workout,value:workout.exercises.filter(exercise=>exercise.name===name&&!exercise.target.timed).flatMap(exercise=>exercise.sets.map(validStrengthSet).filter((set):set is {weight:number;reps:number}=>Boolean(set))).reduce((best,set)=>Math.max(best,e1rm(set.weight,set.reps)),0)})).filter(item=>item.value>0).sort((a,b)=>a.workout.startedAt-b.workout.startedAt);
  if(!sessions.length)return null;
  const latest=sessions.at(-1)!;
  return {name,value:latest.value,change:latest.value-sessions[0].value};
 }).filter((item):item is {name:string;value:number;change:number}=>Boolean(item)).sort((a,b)=>b.value-a.value).slice(0,4);
 const label=mode==="body"?"Masa ciała (kg)":mode==="volume"?"Objętość treningu (kg)":mode==="best"?`${activeName||"Ćwiczenie"} · najlepszy ciężar (kg)`: `${activeName||"Ćwiczenie"} · e1RM (kg)`;
 return <section className="section progress-screen">
  <div className="section-heading"><div><h2>Progres</h2><p>Wyniki liczone z zapisanych serii.</p></div></div>
  <div className="metric-strip progress-summary">
   <div><small>TRENINGI · 30 DNI</small><b>{recent.length}</b></div>
   <div><small>OBJĘTOŚĆ · 30 DNI</small><b>{Math.round(recent.reduce((sum,workout)=>sum+volume(workout),0)).toLocaleString("pl-PL")} kg</b></div>
   <div><small>NOWE PR · 30 DNI</small><b>{prs}</b></div>
  </div>
  <div className="progress-quick-stats"><span>Masa ciała <b>{latestBody==null?"—":`${latestBody} kg`}</b></span><span>Bench · actual 1RM <b>{actual?`${actual} kg`:"—"}</b></span><span>Bench · e1RM <b>{estimated?`${estimated.toFixed(1)} kg`:"—"}</b></span></div>
  {highlights.length>0&&<section className="exercise-highlights"><div className="chart-title"><h3>Najważniejsze ćwiczenia</h3></div>{highlights.map(item=><div className="exercise-highlight" key={item.name}><span><b>{item.name}</b><small>e1RM · od pierwszego zapisu</small></span><span><b>{item.value.toFixed(1)} kg</b><small className={item.change>0?"positive-change":""}>{item.change>0?"+":""}{item.change.toFixed(1)} kg</small></span></div>)}</section>}
  {!workouts.length&&!body.length&&<p className="empty-state">Po kilku treningach pokażemy tutaj Twój progres.</p>}
  <div className="chart-section">
   <div className="chart-title"><h3>{label}</h3><span>{chartData.length} punktów</span></div>
   <div className="chart-controls">
    <div className="segmented" aria-label="Rodzaj wykresu"><button className={mode==="e1rm"?"selected":""} onClick={()=>setMode("e1rm")}>e1RM</button><button className={mode==="best"?"selected":""} onClick={()=>setMode("best")}>Ciężar</button><button className={mode==="volume"?"selected":""} onClick={()=>setMode("volume")}>Objętość</button><button className={mode==="body"?"selected":""} onClick={()=>setMode("body")}>Masa</button></div>
    {(mode==="e1rm"||mode==="best")&&names.length>0&&<select aria-label="Ćwiczenie na wykresie" value={activeName} onChange={event=>setExerciseName(event.target.value)}>{names.map(name=><option key={name}>{name}</option>)}</select>}
   </div>
   <div className="range-select">{ranges.map(item=><button className={range===item?"selected":""} key={item} onClick={()=>setRange(item)}>{item}</button>)}</div>
   {chartData.length>0?<div className="chart-frame"><ResponsiveContainer width="100%" height={210}><LineChart data={chartData} margin={{top:10,right:14,bottom:2,left:-14}}>
    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4"/>
    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fill:"var(--muted)",fontSize:11}} minTickGap={28}/>
    <YAxis tickLine={false} axisLine={false} tick={{fill:"var(--muted)",fontSize:11}} width={40} domain={["dataMin - 2","dataMax + 2"]}/>
    <Tooltip contentStyle={{background:"var(--surface)",border:"1px solid var(--line)",borderRadius:8,color:"var(--text)"}} labelStyle={{color:"var(--muted)"}} formatter={(value)=>[`${value}${mode==="body"||mode==="e1rm"||mode==="best"?" kg":" kg"}`,label]}/>
    <Line dataKey="value" type="monotone" stroke="var(--accent)" strokeWidth={2} dot={{r:2.5,fill:"var(--accent)",strokeWidth:0}} activeDot={{r:4}}/>
   </LineChart></ResponsiveContainer></div>:<p className="chart-empty">Dodaj kilka treningów lub pomiarów, żeby zobaczyć wykres.</p>}
  </div>
 </section>;
}
