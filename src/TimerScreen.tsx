import { toFiniteNumber } from "./workoutLogic";
import type { ActiveWorkout, RestState } from "./types";

type Props={rest:RestState;remaining:number;active:ActiveWorkout|null;onClose:()=>void;onAdjust:(seconds:number)=>void;onPause:()=>void;onSkip:()=>void};
const clock=(milliseconds:number)=>{const seconds=Math.max(0,Math.ceil(milliseconds/1000));const minutes=Math.floor(seconds/60);return `${String(minutes).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`};

export function TimerScreen({rest,remaining,active,onClose,onAdjust,onPause,onSkip}:Props){
 const paused=rest.pausedRemaining!==undefined;
 const ended=remaining<=0&&!paused;
 const exercise=rest.kind==="manual"?null:active?.exercises.find(item=>rest.nextExerciseId?item.templateExerciseId===rest.nextExerciseId:item.name===rest.exerciseName);
 const upcoming=exercise?.sets.find(set=>set.setNo===rest.nextSet);
 const previous=exercise?.sets.find(set=>set.setNo===rest.nextSet-1&&set.completedAt);
 const weight=toFiniteNumber(previous?.weight??null),reps=toFiniteNumber(previous?.reps??null);
 return <div className="timer-overlay" role="dialog" aria-modal="true" aria-labelledby="timer-title">
  <div className="timer-sheet">
   <div className="timer-sheet-top"><span>PRZERWA</span><button className="quiet-button" aria-label="Wróć do treningu" onClick={onClose}>Zamknij</button></div>
   <div className="timer-display"><div className="timer-status" id="timer-title">{ended?"GOTOWY":paused?"PAUZA":"ODPOCZYNEK"}</div><strong>{clock(remaining)}</strong><span>{rest.kind==="manual"?"Timer ręczny":rest.exerciseName}</span></div>
   {rest.kind!=="manual"&&<div className="timer-next">
    <small>{ended?"PRZERWA ZAKOŃCZONA":"NASTĘPNIE"}</small>
    <b>{rest.exerciseName} · seria {rest.nextSet}</b>
    {previous&&<span>Ostatnio: {previous.weight??"—"} × {previous.reps??"—"}</span>}
    {upcoming&&weight!==null&&reps!==null&&<span>Sugestia: {weight} kg × {reps+1} <i>(bez automatycznego wpisywania)</i></span>}
   </div>}
   <div className="timer-controls">
    <button onClick={()=>onAdjust(-30)}>−30 sek.</button>
    <button className="pause-button" onClick={onPause}>{paused?"Wznów":"Pauza"}</button>
    <button onClick={()=>onAdjust(30)}>+30 sek.</button>
   </div>
   <button className="skip-rest" onClick={onSkip}>Pomiń przerwę</button>
   <button className="return-workout" onClick={onClose}>Wróć do treningu</button>
  </div>
 </div>;
}
