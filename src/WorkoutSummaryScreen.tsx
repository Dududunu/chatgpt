import { lazy,Suspense } from "react";
import { bestSetsInWorkout,summarizeWorkout } from "./workoutSummary";
import { newPersonalRecords } from "./workoutSummary";
import type { WorkoutHistory } from "./types";
const WorkoutReviewEditor=lazy(()=>import("./WorkoutReviewEditor").then(module=>({default:module.WorkoutReviewEditor})));

type Props={workout:WorkoutHistory;history:WorkoutHistory[];userId:string;syncStatus:string;onDone:()=>void;onHistory:()=>void;onSavePlanChanges:()=>Promise<void>;onSaveReview:(workoutId:string,patch:Partial<Pick<WorkoutHistory,"rating"|"reviewText"|"photoPath">>)=>Promise<void>;onRetry:()=>Promise<void>;notify:(message:string)=>void};
const duration=(seconds:number)=>`${Math.floor(seconds/60)} min`;
const signed=(value:number,unit:string)=>`${value>0?"+":""}${value}${unit}`;

export function WorkoutSummaryScreen({workout,history,userId,syncStatus,onDone,onHistory,onSavePlanChanges,onSaveReview,onRetry,notify}:Props){
 const summary=summarizeWorkout(workout,history);
 const oldPrCount=summary.previous?newPersonalRecords(summary.previous,history.filter(item=>item.startedAt<summary.previous!.startedAt)).length:0;
 const changed=workout.planSetChanges??[];
 const bestSets=bestSetsInWorkout(workout);
 return <section className="section workout-summary-screen">
  <header className="workout-summary-heading"><span className="eyebrow">SESJA ZAPISANA</span><h2>Trening zakończony</h2><p>{workout.name}</p></header>
  <div className="summary-metrics"><div><small>CZAS</small><b>{duration(summary.durationSeconds)}</b></div><div><small>SERIE</small><b>{summary.completedSets}</b></div><div><small>OBJĘTOŚĆ</small><b>{Math.round(summary.volume).toLocaleString("pl-PL")} kg</b></div></div>
  {summary.previous&&<section className="summary-section"><h3>Vs poprzednio</h3><p className="summary-compare-label">{summary.previous.name} · {new Intl.DateTimeFormat("pl-PL",{day:"numeric",month:"short"}).format(summary.previous.startedAt)}</p><div className="summary-compare-grid"><span>Objętość <b>{summary.volumeChange===null?"—":signed(Math.round(summary.volumeChange)," kg")}</b></span><span>Czas <b>{summary.durationChange===null?"—":signed(Math.round(summary.durationChange/60)," min")}</b></span><span>PR <b>{signed(summary.prCount-oldPrCount,"")}</b></span></div></section>}
  {bestSets.length>0&&<section className="summary-section"><h3>Najlepsze serie</h3><div className="summary-pr-list">{bestSets.map(record=><div className="summary-pr-row" key={record.exerciseName}><span><b>{record.exerciseName}</b><small>{record.weight} × {record.reps}</small></span><b>e1RM {record.e1rm.toFixed(1)} kg</b></div>)}</div></section>}
  {summary.records.length>0&&<section className="summary-section"><h3>Nowe PR</h3><div className="summary-pr-list">{summary.records.map(record=><div className="summary-pr-row" key={record.exerciseName}><span><b>{record.exerciseName}</b><small>{record.weight} × {record.reps}</small></span><b>e1RM {record.e1rm.toFixed(1)} kg</b></div>)}</div></section>}
  {summary.records.length===0&&<p className="summary-note">Brak nowego rekordu względem zapisanej wcześniej historii.</p>}
  {changed.length>0&&<section className="summary-section plan-changes-prompt"><h3>Zmiana liczby serii</h3><p>W treningu zmieniła się liczba serii. Plan pozostaje bez zmian, dopóki tego nie potwierdzisz.</p><button className="quiet-button" onClick={()=>void onSavePlanChanges().then(()=>notify("Zmiany zapisane w planie"))}>Zapisz zmiany w planie</button></section>}
  <Suspense fallback={<p className="summary-note">Otwieranie podsumowania…</p>}><WorkoutReviewEditor workout={workout} userId={userId} syncStatus={syncStatus} onSaveReview={patch=>onSaveReview(workout.id,patch)} onRetry={onRetry} notify={notify}/></Suspense>
  <div className="summary-actions"><button className="primary" onClick={onDone}>Gotowe</button><button className="quiet-button" onClick={onHistory}>Zobacz historię</button></div>
 </section>;
}
