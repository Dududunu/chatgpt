import { describe,expect,it } from "vitest";
import type { WorkoutHistory } from "./types";
import { bestSetsInWorkout,newPersonalRecords,previousTemplateWorkout,summarizeWorkout } from "./workoutSummary";
import { recentPrCount } from "./stats";

function session(id:string,startedAt:number,weight:number,reps:number):WorkoutHistory{
 return {id,templateId:"upper",name:"Upper",startedAt,endedAt:startedAt+3_600_000,exercises:[{templateExerciseId:"bench",name:"Bench",target:{id:"bench",name:"Bench",sets:1,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:120},sets:[{id:`${id}-1`,setNo:1,weight,reps,rir:2,completedAt:startedAt+100}]}]};
}

describe("finished workout summary",()=>{
 it("compares only the earlier workout using the same template",()=>{
  const previous=session("old",100,70,8),workout=session("new",1_000,75,8),other=session("other-template",500,1,1);other.templateId="lower";
  expect(previousTemplateWorkout(workout,[other,previous])?.id).toBe("old");
  expect(summarizeWorkout(workout,[other,previous]).volumeChange).toBe(40);
 });
 it("shows only a real improvement over an existing exercise record",()=>{
  const first=session("first",100,70,8),better=session("better",200,75,8);
  expect(newPersonalRecords(first,[])).toEqual([]);
  expect(newPersonalRecords(better,[first])).toHaveLength(1);
 });
 it("keeps the progress PR count consistent with the workout summary baseline",()=>{
  const first=session("first",100,70,8);
  expect(recentPrCount([first],0)).toBe(summarizeWorkout(first,[]).prCount);
 });
 it("recognizes improvement from a valid zero-load baseline",()=>{
  const baseline=session("baseline",100,0,8),better=session("better",200,10,8);
  expect(newPersonalRecords(better,[baseline])).toHaveLength(1);
 });
 it("does not report warm-up sets as PRs or training volume",()=>{
  const workout=session("warm",200,90,8);workout.exercises[0].sets[0].type="warmup";
  expect(newPersonalRecords(workout,[session("old",100,60,8)])).toEqual([]);
  expect(summarizeWorkout(workout,[]).volume).toBe(0);
 });
 it("summarizes completed sets, duration, and volume",()=>{
  const workout=session("one",100,50,10),summary=summarizeWorkout(workout,[]);
  expect(summary.completedSets).toBe(1);expect(summary.durationSeconds).toBe(3600);expect(summary.volume).toBe(500);
  expect(summary.previous).toBeNull();expect(summary.volumeChange).toBeNull();
 });
 it("shows the strongest valid working set for each exercise even without a historical PR",()=>{
  const workout=session("one",100,50,10);workout.exercises.push({...workout.exercises[0],templateExerciseId:"row",name:"Row",sets:[{...workout.exercises[0].sets[0],id:"row-set",weight:40,reps:8}]});
  workout.exercises[0].sets.push({...workout.exercises[0].sets[0],id:"warm-up",weight:100,reps:8,type:"warmup"});
  expect(bestSetsInWorkout(workout).map(item=>item.exerciseName)).toEqual(["Bench","Row"]);
 });
 it("excludes skipped exercises and warm-ups from the workout summary",()=>{
  const workout=session("skip",100,90,8);
  workout.exercises[0].sets[0].type="warmup";
  workout.exercises.push({...workout.exercises[0],templateExerciseId:"skipped",name:"Skipped",status:"skipped",sets:[{...workout.exercises[0].sets[0],id:"skipped-set",type:"normal",weight:120}]});
  const summary=summarizeWorkout(workout,[]);
  expect(summary.completedSets).toBe(0);
  expect(summary.volume).toBe(0);
  expect(summary.bestSets).toEqual([]);
 });
});
