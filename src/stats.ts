import type { WorkoutHistory } from "./types";
export const e1rm=(weight:number,reps:number)=>weight*(1+reps/30);
export const volume=(w:WorkoutHistory)=>w.exercises.reduce((a,e)=>a+e.sets.reduce((s,x)=>s+((x.weight||0)*(x.reps||0)),0),0);
export function bestE1rm(workouts:WorkoutHistory[], exerciseName:string){
 let best=0;
 for(const w of workouts) for(const e of w.exercises) if(e.name===exerciseName)
  for(const s of e.sets) if(s.weight&&s.reps) best=Math.max(best,e1rm(s.weight,s.reps));
 return best;
}
export function actual1rm(workouts:WorkoutHistory[], exerciseName:string){
 let best=0;
 for(const w of workouts) for(const e of w.exercises) if(e.name===exerciseName)
  for(const s of e.sets) if(s.weight&&s.reps===1) best=Math.max(best,s.weight);
 return best;
}
