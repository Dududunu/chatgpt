import { toFiniteNumber } from "./workoutLogic";
import { restProgress } from "./timerLogic";
import type { ActiveWorkout, RestState } from "./types";

type Props={rest:RestState;remaining:number;now:number;active:ActiveWorkout|null;onClose:()=>void;onAdjust:(seconds:number)=>void;onPause:()=>void;onSkip:()=>void};
const clock=(milliseconds:number)=>{const seconds=Math.max(0,Math.ceil(milliseconds/1000));const minutes=Math.floor(seconds/60);return `${String(minutes).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`};
const circumference=2*Math.PI*104;

export function TimerScreen({rest,remaining,now,active,onClose,onAdjust,onPause,onSkip}:Props){
 const paused=rest.pausedRemaining!==undefined;
 const ended=remaining<=0&&!paused;
 const exercise=rest.kind==="manual"?null:active?.exercises.find(item=>rest.nextExerciseId?item.templateExerciseId===rest.nextExerciseId:item.name===rest.exerciseName);
 const upcoming=exercise?.sets.find(set=>set.setNo===rest.nextSet);
 const previous=exercise?.sets.find(set=>set.setNo===rest.nextSet-1&&set.completedAt);
 const weight=toFiniteNumber(upcoming?.weight??previous?.weight??null);
 const reps=toFiniteNumber(upcoming?.reps??null)??(toFiniteNumber(previous?.reps??null)===null?null:toFiniteNumber(previous?.reps??null)!+1);
 const progress=restProgress(rest,now);
 const offset=circumference*(1-progress);
 const completedName=rest.completedExerciseName??rest.exerciseName;
 const completedSetNo=rest.completedSetNo??Math.max(1,rest.nextSet-1);
 const completedSetTotal=rest.completedSetTotal??exercise?.target.sets;
 return <div className="timer-overlay timer-fullscreen" role="dialog" aria-modal="true" aria-labelledby="timer-title">
  <section className="timer-screen">
   <header className="timer-screen-header"><div><span className="eyebrow">{active?.name??"GYM"}</span><h1>Przerwa</h1></div><button className="timer-back" onClick={onClose}>Wróć do treningu</button></header>
   <div className="timer-ring" role="timer" aria-label={`Pozostało ${clock(remaining)}`} aria-live={ended?"assertive":"off"}>
    <svg viewBox="0 0 240 240" aria-hidden="true"><circle className="timer-ring-track" cx="120" cy="120" r="104"/><circle className="timer-ring-progress" cx="120" cy="120" r="104" style={{strokeDasharray:circumference,strokeDashoffset:offset}}/></svg>
    <div className="timer-display"><span className="timer-status" id="timer-title">{ended?"PRZERWA ZAKOŃCZONA":paused?"PAUZA":"ODPOCZYNEK"}</span><strong>{clock(remaining)}</strong><span>{rest.kind==="manual"?"Timer ręczny":rest.exerciseName}</span></div>
   </div>
   {rest.kind!=="manual"&&<div className="timer-next">
   <small>{ended?"GOTOWY DO POWROTU":"NASTĘPNA SERIA"}</small>
    {weight!==null&&reps!==null&&<b>{weight} kg × {reps}</b>}
    <span>{rest.exerciseName} · seria {rest.nextSet}{upcoming?.weight!=null&&upcoming?.reps!=null?"":" · propozycja na podstawie poprzedniej serii"}</span>
    {previous&&<span>Ostatnio: {previous.weight??"—"} × {previous.reps??"—"}</span>}
    {completedSetTotal&&<span className="timer-completed-context">Po serii {completedSetNo} / {completedSetTotal} · {completedName}</span>}
   </div>}
   <div className="timer-controls">
    <button aria-label="Odejmij 30 sekund" disabled={ended} onClick={()=>onAdjust(-30)}>−30 sek.</button>
    <button className="pause-button" disabled={ended} onClick={onPause}>{paused?"Wznów":"Pauza"}</button>
    <button aria-label="Dodaj 30 sekund" disabled={ended} onClick={()=>onAdjust(30)}>+30 sek.</button>
   </div>
   {!ended?<button className="skip-rest" onClick={onSkip}>Pomiń przerwę</button>:<button className="primary timer-return" onClick={onSkip}>Wróć do serii</button>}
   {!ended&&<button className="return-workout" onClick={onClose}>Zwiń timer</button>}
  </section>
 </div>;
}
