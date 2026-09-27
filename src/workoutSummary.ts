import type { ExerciseLog,WorkoutHistory } from "./types";
import { actual1rm,bestE1rm,bestE1rmOrNull,e1rm,isPrCandidate,volume } from "./stats";
import { toFiniteNumber } from "./workoutLogic";

export type PersonalRecord={exerciseName:string;weight:number;reps:number;e1rm:number};
export type WorkoutSummary={durationSeconds:number;completedSets:number;volume:number;previous:WorkoutHistory|null;volumeChange:number|null;durationChange:number|null;prCount:number;records:PersonalRecord[];bestSets:PersonalRecord[]};

function eligibleBest(exercise:ExerciseLog):PersonalRecord|null{
 if(exercise.status==="skipped")return null;
 let best:PersonalRecord|null=null;
 for(const set of exercise.sets){
  if(!set.completedAt||!isPrCandidate(set,exercise.target.timed))continue;
  const weight=toFiniteNumber(set.weight),reps=toFiniteNumber(set.reps);
  if(weight===null||reps===null||weight<0||reps<=0||!Number.isInteger(reps))continue;
  const estimate=e1rm(weight,reps);
  if(Number.isFinite(estimate)&&(!best||estimate>best.e1rm))best={exerciseName:exercise.name,weight,reps,e1rm:estimate};
 }
 return best;
}

export function previousTemplateWorkout(workout:WorkoutHistory,workouts:WorkoutHistory[]):WorkoutHistory|null{
 return workouts.filter(item=>item.id!==workout.id&&item.templateId===workout.templateId&&item.startedAt<workout.startedAt).sort((a,b)=>b.startedAt-a.startedAt)[0]??null;
}

export function newPersonalRecords(workout:WorkoutHistory,history:WorkoutHistory[]):PersonalRecord[]{
 const prior=history.filter(item=>item.id!==workout.id&&item.startedAt<workout.startedAt);
 const records=new Map<string,PersonalRecord>();
 for(const exercise of workout.exercises){
  if(exercise.status==="skipped")continue;
  const candidate=eligibleBest(exercise);
  if(!candidate)continue;
  const previous=bestE1rmOrNull(prior,candidate.exerciseName);
  if(previous!==null&&candidate.e1rm>previous){
   const saved=records.get(candidate.exerciseName);
   if(!saved||candidate.e1rm>saved.e1rm)records.set(candidate.exerciseName,candidate);
  }
 }
 return [...records.values()].sort((a,b)=>b.e1rm-a.e1rm);
}

export function bestSetsInWorkout(workout:WorkoutHistory):PersonalRecord[]{
 const bestByExercise=new Map<string,PersonalRecord>();
 for(const exercise of workout.exercises){
  if(exercise.status==="skipped")continue;
  const candidate=eligibleBest(exercise);if(!candidate)continue;
  const current=bestByExercise.get(candidate.exerciseName);
  if(!current||candidate.e1rm>current.e1rm)bestByExercise.set(candidate.exerciseName,candidate);
 }
 return [...bestByExercise.values()].sort((a,b)=>b.e1rm-a.e1rm);
}

export function summarizeWorkout(workout:WorkoutHistory,history:WorkoutHistory[]):WorkoutSummary{
 const previous=previousTemplateWorkout(workout,history);
 const durationSeconds=Math.max(0,Math.floor((workout.endedAt-workout.startedAt)/1000));
 const previousDuration=previous?Math.max(0,Math.floor((previous.endedAt-previous.startedAt)/1000)):null;
 const totalVolume=volume(workout),previousVolume=previous?volume(previous):null;
 return {
  durationSeconds,
  completedSets:workout.exercises.filter(exercise=>exercise.status!=="skipped").reduce((count,exercise)=>count+exercise.sets.filter(set=>set.completedAt&&set.type!=="warmup").length,0),
  volume:totalVolume,
  previous,
  volumeChange:previousVolume===null?null:totalVolume-previousVolume,
  durationChange:previousDuration===null?null:durationSeconds-previousDuration,
  prCount:newPersonalRecords(workout,history).length,
  records:newPersonalRecords(workout,history),
  bestSets:bestSetsInWorkout(workout)
 };
}

export function knownBestBefore(workout:WorkoutHistory,exerciseName:string,history:WorkoutHistory[]):number{
 return bestE1rm(history.filter(item=>item.startedAt<workout.startedAt),exerciseName);
}

export function actualBestBefore(workout:WorkoutHistory,exerciseName:string,history:WorkoutHistory[]):number{
 return actual1rm(history.filter(item=>item.startedAt<workout.startedAt),exerciseName);
}
