import type { WorkoutHistory } from "./types";
import { toFiniteNumber } from "./workoutLogic";

export const e1rm=(weight:number,reps:number)=>weight*(1+reps/30);

export const volume=(w:WorkoutHistory)=>w.exercises.reduce((total,exercise)=>
 total+exercise.sets.reduce((sum,set)=>{
  if(!set.completedAt || exercise.target.timed) return sum;
  const weight=toFiniteNumber(set.weight),reps=toFiniteNumber(set.reps);
  if(weight===null || reps===null || weight<0 || reps<=0 || !Number.isInteger(reps)) return sum;
  const setVolume=weight*reps;
  return Number.isFinite(setVolume)&&Number.isFinite(sum+setVolume)?sum+setVolume:sum;
 },0),0);

export function bestE1rm(workouts:WorkoutHistory[],exerciseName:string){
 let best=0;
 for(const w of workouts) for(const e of w.exercises) if(e.name===exerciseName)
  for(const s of e.sets){
   if(!s.completedAt || e.target.timed) continue;
   const weight=toFiniteNumber(s.weight),reps=toFiniteNumber(s.reps);
   if(weight!==null&&reps!==null&&weight>=0&&reps>0&&Number.isInteger(reps)){
    const estimate=e1rm(weight,reps);
    if(Number.isFinite(estimate)) best=Math.max(best,estimate);
   }
  }
 return best;
}

export function actual1rm(workouts:WorkoutHistory[],exerciseName:string){
 let best=0;
 for(const w of workouts) for(const e of w.exercises) if(e.name===exerciseName)
  for(const s of e.sets){
   if(!s.completedAt || e.target.timed) continue;
   const weight=toFiniteNumber(s.weight),reps=toFiniteNumber(s.reps);
   if(weight!==null&&reps===1) best=Math.max(best,weight);
  }
 return best;
}

/** Counts at most one new strength record per exercise in each workout. */
export function recentPrCount(workouts:WorkoutHistory[],since=Date.now()-30*864e5):number{
 const ordered=workouts.filter(workout=>Number.isFinite(workout.startedAt)).slice().sort((a,b)=>a.startedAt-b.startedAt);
 const records=new Map<string,number>();let count=0;
 for(const workout of ordered){
  const sessionBest=new Map<string,number>();
  for(const exercise of workout.exercises){
   if(exercise.target.timed)continue;
   let best=0;
   for(const set of exercise.sets){
    if(!set.completedAt)continue;
    const weight=toFiniteNumber(set.weight),reps=toFiniteNumber(set.reps);
    if(weight===null||reps===null||weight<0||reps<=0||!Number.isInteger(reps))continue;
    const estimate=e1rm(weight,reps);
    if(Number.isFinite(estimate))best=Math.max(best,estimate);
   }
   if(best>0)sessionBest.set(exercise.name,Math.max(sessionBest.get(exercise.name)??0,best));
  }
  for(const [name,best] of sessionBest){
   const previous=records.get(name)??0;
   if(best>previous&&workout.startedAt>=since)count++;
   records.set(name,Math.max(previous,best));
  }
 }
 return count;
}
