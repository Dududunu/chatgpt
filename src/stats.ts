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
