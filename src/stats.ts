import type { WorkoutHistory } from "./types";
import { toFiniteNumber } from "./workoutLogic";

export const e1rm=(weight:number,reps:number)=>weight*(1+reps/30);

export const volume=(w:WorkoutHistory)=>w.exercises.reduce((total,exercise)=>
 total+exercise.sets.reduce((sum,set)=>{
  const weight=toFiniteNumber(set.weight)??0;
  const reps=toFiniteNumber(set.reps)??0;
  return sum+(weight*reps);
 },0),0);

export function bestE1rm(workouts:WorkoutHistory[],exerciseName:string){
 let best=0;
 for(const w of workouts) for(const e of w.exercises) if(e.name===exerciseName)
  for(const s of e.sets){
   const weight=toFiniteNumber(s.weight),reps=toFiniteNumber(s.reps);
   if(weight!==null&&reps!==null&&weight>=0&&reps>0) best=Math.max(best,e1rm(weight,reps));
  }
 return best;
}

export function actual1rm(workouts:WorkoutHistory[],exerciseName:string){
 let best=0;
 for(const w of workouts) for(const e of w.exercises) if(e.name===exerciseName)
  for(const s of e.sets){
   const weight=toFiniteNumber(s.weight),reps=toFiniteNumber(s.reps);
   if(weight!==null&&reps===1) best=Math.max(best,weight);
  }
 return best;
}
