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

export function currentExerciseIndex(workout:ActiveWorkout):number{
 const savedIndex=workout.exercises.findIndex(ex=>ex.templateExerciseId===workout.currentExerciseId);
 return savedIndex>=0?savedIndex:0;
}

export function restoreActiveWorkout(workout:ActiveWorkout):ActiveWorkout{
 const hasSavedExercise=workout.exercises.some(ex=>ex.templateExerciseId===workout.currentExerciseId);
 const currentExerciseId=hasSavedExercise?workout.currentExerciseId:workout.exercises[0]?.templateExerciseId;
 const rest=workout.rest&&!workout.rest.kind?{...workout.rest,kind:"rest" as const}:workout.rest;
 if(currentExerciseId===workout.currentExerciseId&&rest===workout.rest)return workout;
 return {...workout,currentExerciseId,rest};
}

export function selectWorkoutExercise(workout:ActiveWorkout,exerciseId:string):ActiveWorkout{
 if(!workout.exercises.some(ex=>ex.templateExerciseId===exerciseId)) return workout;
 return {...workout,currentExerciseId:exerciseId};
}

export function navigateWorkoutExercise(workout:ActiveWorkout,direction:-1|1):ActiveWorkout{
 if(workout.exercises.length===0) return workout;
 const nextIndex=Math.max(0,Math.min(workout.exercises.length-1,currentExerciseIndex(workout)+direction));
 return {...workout,currentExerciseId:workout.exercises[nextIndex].templateExerciseId};
}

export function firstIncompleteSetIndex(exercise:{sets:SetLog[]}):number{
 return exercise.sets.findIndex(set=>!set.completedAt);
}

export function nextRestTarget(workout:ActiveWorkout,exerciseIndex:number,setIndex:number):{exerciseId:string;exerciseName:string;setNo:number}|null{
 const current=workout.exercises[exerciseIndex];
 if(!current||!shouldStartRest(workout,exerciseIndex,setIndex))return null;
 const nextId=current.target.superset?nextExerciseAfterCompletedSet(workout,exerciseIndex,setIndex):current.templateExerciseId;
 const nextExercise=workout.exercises.find(exercise=>exercise.templateExerciseId===nextId);
 const nextSetIndex=nextExercise?firstIncompleteSetIndex(nextExercise):-1;
 if(!nextExercise||nextSetIndex<0)return null;
 return {exerciseId:nextExercise.templateExerciseId,exerciseName:nextExercise.name,setNo:nextExercise.sets[nextSetIndex].setNo};
}

/**
 * Supersets alternate at the same set number. Once a round is complete, the
 * pointer advances to the next unfinished member so the rest timer leads back
 * to A for the next round.
 */
export function nextExerciseAfterCompletedSet(workout:ActiveWorkout,exerciseIndex:number,setIndex:number):string|null{
 const current=workout.exercises[exerciseIndex];
 const group=current?.target.superset;
 if(!current||!group) return current?.templateExerciseId??null;

 const groupMembers=workout.exercises
  .map((exercise,index)=>({exercise,index}))
  .filter(item=>item.exercise.target.superset===group);
 const partner=groupMembers.find(item=>item.index!==exerciseIndex&&item.exercise.sets[setIndex]&&!item.exercise.sets[setIndex].completedAt);
 if(partner) return partner.exercise.templateExerciseId;

 if(shouldStartRest(workout,exerciseIndex,setIndex)){
  const nextRound=groupMembers.find(({exercise})=>exercise.sets.slice(setIndex+1).some(set=>!set.completedAt));
  if(nextRound) return nextRound.exercise.templateExerciseId;
 }

 const lastGroupIndex=Math.max(...groupMembers.map(item=>item.index));
 const laterExercise=workout.exercises.slice(lastGroupIndex+1).find(ex=>ex.target.superset!==group&&ex.sets.some(set=>!set.completedAt));
 const otherExercise=workout.exercises.find(ex=>ex.target.superset!==group&&ex.sets.some(set=>!set.completedAt));
 return laterExercise?.templateExerciseId??otherExercise?.templateExerciseId??current.templateExerciseId;
}

export function adjustRestTimer(rest:RestState,deltaSeconds:number,now:number):RestState{
 if(rest.pausedRemaining===undefined&&rest.endsAt<=now)return rest;
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
 if(rest.pausedRemaining===undefined&&rest.endsAt<=now)return rest;
 const toggled={...rest};
 if(toggled.pausedRemaining!==undefined){
  if(toggled.pausedRemaining===0){
   toggled.endsAt=now;
   toggled.notifiedAt??=now;
   delete toggled.pausedRemaining;
   return toggled;
  }
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
