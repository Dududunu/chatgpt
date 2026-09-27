import type { ActiveWorkout, ExerciseLog, ExerciseTemplate, NumericField, RestState, SetLog, SetType } from "./types";

export function exerciseLogId(exercise:ExerciseLog):string{return exercise.logId??exercise.templateExerciseId}

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
 if(!current || current.status==="skipped"||current.status==="replaced"||!current.sets[setIndex]?.completedAt) return false;
 const group=current.target.superset;
 const hasUnfinishedLaterSet=(exercise:typeof current)=>
  exercise.sets.slice(setIndex+1).some(set=>!set.completedAt);
 if(!group) return hasUnfinishedLaterSet(current);

 const groupExercises=workout.exercises.filter(ex=>ex.target.superset===group&&ex.status!=="skipped"&&ex.status!=="replaced");
 const roundComplete=groupExercises.every(ex=>{
  const pairedSet=ex.sets[setIndex];
  return !pairedSet || Boolean(pairedSet.completedAt);
 });
 return roundComplete && groupExercises.some(hasUnfinishedLaterSet);
}

export function currentExerciseIndex(workout:ActiveWorkout):number{
 const savedIndex=workout.exercises.findIndex(ex=>exerciseLogId(ex)===workout.currentExerciseId);
 if(savedIndex>=0)return savedIndex;
 const firstActive=workout.exercises.findIndex(ex=>ex.status!=="skipped"&&ex.status!=="replaced");
 return firstActive>=0?firstActive:0;
}

export function restoreActiveWorkout(workout:ActiveWorkout):ActiveWorkout{
 const hasSavedExercise=workout.exercises.some(ex=>exerciseLogId(ex)===workout.currentExerciseId);
 const firstActive=workout.exercises.find(ex=>ex.status!=="skipped"&&ex.status!=="replaced");
 const currentExerciseId=hasSavedExercise?workout.currentExerciseId:firstActive?exerciseLogId(firstActive):workout.exercises[0]?exerciseLogId(workout.exercises[0]):undefined;
 const rest=workout.rest&&!workout.rest.kind?{...workout.rest,kind:"rest" as const}:workout.rest;
 if(currentExerciseId===workout.currentExerciseId&&rest===workout.rest)return workout;
 return {...workout,currentExerciseId,rest};
}

export function selectWorkoutExercise(workout:ActiveWorkout,exerciseId:string):ActiveWorkout{
 if(!workout.exercises.some(ex=>exerciseLogId(ex)===exerciseId)) return workout;
 return {...workout,currentExerciseId:exerciseId};
}

export type ExerciseNavigationStatus="completed"|"current"|"upcoming"|"skipped"|"replaced";
export function exerciseNavigationStatus(workout:ActiveWorkout,exerciseId:string):ExerciseNavigationStatus{
 const exercise=workout.exercises.find(item=>exerciseLogId(item)===exerciseId);
 if(!exercise)return "upcoming";
 if(exercise.status==="skipped")return "skipped";
 if(exercise.status==="replaced")return "replaced";
 if(workout.currentExerciseId===exerciseId)return "current";
 const workSets=exercise.sets.filter(set=>set.type!=="warmup");
 return workSets.length>0&&workSets.every(set=>Boolean(set.completedAt))?"completed":"upcoming";
}

export function navigateWorkoutExercise(workout:ActiveWorkout,direction:-1|1):ActiveWorkout{
 if(workout.exercises.length===0) return workout;
 const actionable=workout.exercises.map((exercise,index)=>({exercise,index})).filter(({exercise})=>exercise.status!=="skipped"&&exercise.status!=="replaced");
 const current=actionable.findIndex(({exercise})=>exerciseLogId(exercise)===workout.currentExerciseId);
 const next=actionable[Math.max(0,Math.min(actionable.length-1,(current<0?0:current)+direction))];
 return next?{...workout,currentExerciseId:exerciseLogId(next.exercise)}:workout;
}

export function firstIncompleteSetIndex(exercise:{sets:SetLog[]}):number{
 return exercise.sets.findIndex(set=>!set.completedAt);
}

export function skipWorkoutExercise(workout:ActiveWorkout,exerciseId:string):ActiveWorkout{
 const index=workout.exercises.findIndex(exercise=>exerciseLogId(exercise)===exerciseId);
 if(index<0||workout.exercises[index].status==="replaced")return workout;
 const exercises=workout.exercises.map((exercise,i)=>i===index?{...exercise,status:"skipped" as const}:exercise);
 if(workout.currentExerciseId!==exerciseId)return {...workout,exercises};
 const next=exercises.slice(index+1).find(exercise=>exercise.status!=="skipped"&&exercise.status!=="replaced")??exercises.slice(0,index).reverse().find(exercise=>exercise.status!=="skipped"&&exercise.status!=="replaced");
 return {...workout,exercises,currentExerciseId:next?exerciseLogId(next):undefined};
}

export function restoreWorkoutExercise(workout:ActiveWorkout,exerciseId:string):ActiveWorkout{
 const exercise=workout.exercises.find(item=>exerciseLogId(item)===exerciseId);
 if(!exercise||exercise.status!=="skipped")return workout;
 return {...workout,exercises:workout.exercises.map(item=>item===exercise?{...item,status:"active"}:item),currentExerciseId:exerciseId};
}

export function moveWorkoutExerciseToEnd(workout:ActiveWorkout,exerciseId:string):ActiveWorkout{
 const index=workout.exercises.findIndex(exercise=>exerciseLogId(exercise)===exerciseId);
 if(index<0||index===workout.exercises.length-1||workout.exercises[index].status!==undefined&&workout.exercises[index].status!=="active")return workout;
 const exercises=[...workout.exercises];
 const [moved]=exercises.splice(index,1);exercises.push(moved);
 const next=exercises.slice(index).find(exercise=>exercise.status!=="skipped"&&exercise.status!=="replaced")??moved;
 return {...workout,exercises,currentExerciseId:exerciseLogId(next)};
}

/** Keeps the old log and every completed set intact, then adds a fresh snapshot entry. */
export function swapWorkoutExercise(workout:ActiveWorkout,exerciseId:string,target:ExerciseTemplate,idFactory:()=>string):ActiveWorkout{
 const index=workout.exercises.findIndex(exercise=>exerciseLogId(exercise)===exerciseId);
 if(index<0||workout.exercises[index].status==="replaced")return workout;
 const previous=workout.exercises[index],logId=idFactory();
 const replaced:ExerciseLog={...previous,status:"replaced",replacedBy:target.name};
 const setCount=Math.max(1,Math.min(20,Math.floor(target.sets)||1));
 const next:ExerciseLog={
  logId,templateExerciseId:target.id,planExerciseId:null,name:target.name,target:structuredClone(target),status:"active",
  replacesLogId:exerciseId,
  sets:Array.from({length:setCount},(_,setIndex)=>({id:idFactory(),setNo:setIndex+1,weight:null,reps:null,rir:null,completedAt:null,type:"normal"}))
 };
 const exercises=[...workout.exercises];exercises[index]=replaced;exercises.splice(index+1,0,next);
 return {...workout,exercises,currentExerciseId:logId};
}

export function addWorkoutSet(workout:ActiveWorkout,exerciseId:string,idFactory:()=>string):ActiveWorkout{
 const exercise=workout.exercises.find(item=>exerciseLogId(item)===exerciseId);
 if(!exercise||exercise.sets.length>=30)return workout;
 const setNo=Math.max(0,...exercise.sets.map(set=>set.setNo))+1;
 const nextSet:SetLog={id:idFactory(),setNo,weight:null,reps:null,rir:null,completedAt:null,type:"normal"};
 const planId=exercise.planExerciseId===null?null:exercise.planExerciseId??exercise.templateExerciseId;
 const changes=new Set(workout.planSetChanges??[]);if(planId)changes.add(planId);
 return {...workout,planSetChanges:[...changes],exercises:workout.exercises.map(item=>item===exercise?{...item,sets:[...item.sets,nextSet]}:item)};
}

export function removeWorkoutSet(workout:ActiveWorkout,exerciseId:string,setId:string):ActiveWorkout{
 const exercise=workout.exercises.find(item=>exerciseLogId(item)===exerciseId);
 if(!exercise||!exercise.sets.some(set=>set.id===setId))return workout;
 const removed=exercise.sets.find(set=>set.id===setId)!;
 const planId=exercise.planExerciseId===null?null:exercise.planExerciseId??exercise.templateExerciseId;
 const changes=new Set(workout.planSetChanges??[]);if(removed.type!=="warmup"&&planId)changes.add(planId);
 return {...workout,planSetChanges:[...changes],exercises:workout.exercises.map(item=>item!==exercise?item:{...item,sets:item.sets.filter(set=>set.id!==setId).map((set,index)=>({...set,setNo:index+1}))})};
}

export function setWorkoutSetType(workout:ActiveWorkout,exerciseId:string,setId:string,type:SetType):ActiveWorkout{
 return {...workout,exercises:workout.exercises.map(exercise=>exerciseLogId(exercise)!==exerciseId?exercise:{
  ...exercise,
  sets:exercise.sets.map(set=>set.id!==setId?set:{...set,type,toFailure:type==="failure"})
 })};
}

export function nextRestTarget(workout:ActiveWorkout,exerciseIndex:number,setIndex:number):{exerciseId:string;exerciseName:string;setNo:number}|null{
 const current=workout.exercises[exerciseIndex];
 if(!current||!shouldStartRest(workout,exerciseIndex,setIndex))return null;
 const nextId=current.target.superset?nextExerciseAfterCompletedSet(workout,exerciseIndex,setIndex):exerciseLogId(current);
 const nextExercise=workout.exercises.find(exercise=>exerciseLogId(exercise)===nextId);
 const nextSetIndex=nextExercise?firstIncompleteSetIndex(nextExercise):-1;
 if(!nextExercise||nextSetIndex<0)return null;
 return {exerciseId:exerciseLogId(nextExercise),exerciseName:nextExercise.name,setNo:nextExercise.sets[nextSetIndex].setNo};
}

/**
 * Supersets alternate at the same set number. Once a round is complete, the
 * pointer advances to the next unfinished member so the rest timer leads back
 * to A for the next round.
 */
export function nextExerciseAfterCompletedSet(workout:ActiveWorkout,exerciseIndex:number,setIndex:number):string|null{
 const current=workout.exercises[exerciseIndex];
 const group=current?.target.superset;
 if(!current||!group) return current?exerciseLogId(current):null;

 const groupMembers=workout.exercises
  .map((exercise,index)=>({exercise,index}))
  .filter(item=>item.exercise.target.superset===group&&item.exercise.status!=="skipped"&&item.exercise.status!=="replaced");
 const partner=groupMembers.find(item=>item.index!==exerciseIndex&&item.exercise.sets[setIndex]&&!item.exercise.sets[setIndex].completedAt);
 if(partner) return exerciseLogId(partner.exercise);

 if(shouldStartRest(workout,exerciseIndex,setIndex)){
  const nextRound=groupMembers.find(({exercise})=>exercise.sets.slice(setIndex+1).some(set=>!set.completedAt));
  if(nextRound) return exerciseLogId(nextRound.exercise);
 }

 const lastGroupIndex=Math.max(...groupMembers.map(item=>item.index));
 const laterExercise=workout.exercises.slice(lastGroupIndex+1).find(ex=>ex.target.superset!==group&&ex.status!=="skipped"&&ex.status!=="replaced"&&ex.sets.some(set=>!set.completedAt));
 const otherExercise=workout.exercises.find(ex=>ex.target.superset!==group&&ex.status!=="skipped"&&ex.status!=="replaced"&&ex.sets.some(set=>!set.completedAt));
 return laterExercise?exerciseLogId(laterExercise):otherExercise?exerciseLogId(otherExercise):exerciseLogId(current);
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
