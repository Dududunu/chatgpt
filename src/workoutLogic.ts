import type { ActiveWorkout, ExerciseTemplate, NumericField, RestState, SetLog } from "./types";

export function toFiniteNumber(value:NumericField):number|null{
 if(typeof value==="number") return Number.isFinite(value)?value:null;
 if(typeof value!=="string") return null;
 const normalized=value.trim().replace(",",".");
 if(!normalized || normalized==="." || normalized==="-") return null;
 const parsed=Number(normalized);
 return Number.isFinite(parsed)?parsed:null;
}

export function normalizeSetForCompletion(set:SetLog,target:ExerciseTemplate):
 {ok:true;weight:number;reps:number;rir:number|null}|{ok:false;message:string}{
 const weight=toFiniteNumber(set.weight);
 const reps=toFiniteNumber(set.reps);
 const rir=toFiniteNumber(set.rir);

 if(weight===null || weight<0) return {ok:false,message:"Wpisz poprawny ciężar (0 kg jest dozwolone)."};
 if(reps===null || reps<=0) return {ok:false,message:target.timed?"Wpisz czas w sekundach.":"Wpisz liczbę powtórzeń."};
 if(!target.timed && !Number.isInteger(reps)) return {ok:false,message:"Liczba powtórzeń musi być całkowita."};
 if(rir!==null && (rir<0 || rir>10)) return {ok:false,message:"RIR powinien być w zakresie 0–10."};
 if(!Number.isFinite(weight*reps) || (!target.timed && !Number.isFinite(weight*(1+reps/30)))){
  return {ok:false,message:"Wartość jest zbyt duża do obliczeń."};
 }

 return {ok:true,weight,reps,rir};
}

export function shouldStartRest(workout:ActiveWorkout,exerciseIndex:number,setIndex:number):boolean{
 const current=workout.exercises[exerciseIndex];
 if(!current || !current.sets[setIndex]?.completedAt) return false;
 const group=current.target.superset;
 const hasUnfinishedLaterSet=(exercise:typeof current)=>
  exercise.sets.slice(setIndex+1).some(set=>!set.completedAt);
 if(!group) return hasUnfinishedLaterSet(current);

 const groupExercises=workout.exercises.filter(ex=>ex.target.superset===group);
 const roundComplete=groupExercises.every(ex=>{
  const pairedSet=ex.sets[setIndex];
  return !pairedSet || Boolean(pairedSet.completedAt);
 });
 return roundComplete && groupExercises.some(hasUnfinishedLaterSet);
}

export function adjustRestTimer(rest:RestState,deltaSeconds:number,now:number):RestState{
 const adjusted={...rest};
 if(adjusted.pausedRemaining!==undefined){
  adjusted.pausedRemaining=Math.max(0,adjusted.pausedRemaining+deltaSeconds*1000);
 }else{
  adjusted.endsAt=Math.max(now,adjusted.endsAt+deltaSeconds*1000);
 }
 delete adjusted.notifiedAt;
 return adjusted;
}

export function toggleRestPause(rest:RestState,now:number):RestState{
 const toggled={...rest};
 if(toggled.pausedRemaining!==undefined){
  toggled.endsAt=now+toggled.pausedRemaining;
  delete toggled.pausedRemaining;
  delete toggled.notifiedAt;
 }else{
  toggled.pausedRemaining=Math.max(0,toggled.endsAt-now);
 }
 return toggled;
}

export function isRestNotificationDue(rest:RestState,now:number):boolean{
 return rest.pausedRemaining===undefined&&rest.notifiedAt===undefined&&rest.endsAt<=now;
}
