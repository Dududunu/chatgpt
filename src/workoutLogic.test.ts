import { describe,expect,it } from "vitest";
import { adjustRestTimer, currentExerciseIndex, firstIncompleteSetIndex, isRestNotificationDue, navigateWorkoutExercise, nextExerciseAfterCompletedSet, normalizeSetForCompletion, restoreActiveWorkout, shouldStartRest, toFiniteNumber, toggleRestPause } from "./workoutLogic";
import type { ActiveWorkout, ExerciseTemplate, RestState } from "./types";

const normal:ExerciseTemplate={id:"x",name:"X",sets:2,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:120};
const rest:RestState={exerciseName:"X",nextSet:2,startedAt:0,endsAt:30_000};

describe("numeric workout input",()=>{
 it("accepts Polish decimal comma without losing precision",()=>{
  expect(toFiniteNumber("27,5")).toBe(27.5);
  expect(toFiniteNumber("27.5")).toBe(27.5);
 });
 it("allows zero added weight for bodyweight movements",()=>{
  expect(normalizeSetForCompletion({id:"s",setNo:1,weight:"0",reps:"8",rir:"2",completedAt:null},normal))
   .toEqual({ok:true,weight:0,reps:8,rir:2});
 });
 it("rejects fractional reps for normal exercises",()=>{
  expect(normalizeSetForCompletion({id:"s",setNo:1,weight:"30",reps:"7.5",rir:"1",completedAt:null},normal).ok).toBe(false);
 });
 it("rejects non-finite values and RIR outside 0–10",()=>{
  expect(toFiniteNumber(Number.NaN)).toBeNull();
  expect(normalizeSetForCompletion({id:"s",setNo:1,weight:"NaN",reps:"8",rir:"2",completedAt:null},normal).ok).toBe(false);
  expect(normalizeSetForCompletion({id:"s",setNo:1,weight:"1e308",reps:"1e308",rir:"2",completedAt:null},normal).ok).toBe(false);
  expect(normalizeSetForCompletion({id:"s",setNo:1,weight:"30",reps:"8",rir:"11",completedAt:null},normal).ok).toBe(false);
 });
});

describe("rest scheduling",()=>{
 it("does not start rest after the final set of a regular exercise",()=>{
  const workout:ActiveWorkout={id:"w",templateId:"t",name:"T",startedAt:1,exercises:[
   {templateExerciseId:"1",name:"A",target:{...normal,sets:2},sets:[
    {id:"1",setNo:1,weight:10,reps:8,rir:1,completedAt:10},
    {id:"2",setNo:2,weight:null,reps:null,rir:null,completedAt:null}
   ]}
  ]};
  expect(shouldStartRest(workout,0,0)).toBe(true);
  expect(nextExerciseAfterCompletedSet(workout,0,0)).toBe(workout.exercises[0].templateExerciseId);
  workout.exercises[0].sets[1].completedAt=20;
  expect(shouldStartRest(workout,0,1)).toBe(false);
 });
});

describe("superset rest",()=>{
 it("starts rest only after all exercises in the superset round are complete",()=>{
  const target={...normal,superset:"a"};
  const workout:ActiveWorkout={id:"w",templateId:"t",name:"T",startedAt:1,exercises:[
   {templateExerciseId:"1",name:"A",target,sets:[
    {id:"1",setNo:1,weight:10,reps:8,rir:1,completedAt:10},
    {id:"3",setNo:2,weight:10,reps:8,rir:1,completedAt:null}
   ]},
   {templateExerciseId:"2",name:"B",target,sets:[
    {id:"2",setNo:1,weight:10,reps:8,rir:1,completedAt:null},
    {id:"4",setNo:2,weight:10,reps:8,rir:1,completedAt:null}
   ]}
  ]};
  expect(shouldStartRest(workout,0,0)).toBe(false);
  workout.exercises[1].sets[0].completedAt=20;
  expect(shouldStartRest(workout,1,0)).toBe(true);
  workout.exercises[0].sets[1].completedAt=30;
  workout.exercises[1].sets[1].completedAt=40;
  expect(shouldStartRest(workout,1,1)).toBe(false);
 });

 it("alternates A1 → B1 → rest → A2 and advances after the final pair",()=>{
  const target={...normal,superset:"arms"};
  const set=(id:string,no:number,completedAt:number|null=null)=>({id,setNo:no,weight:10,reps:8,rir:1,completedAt});
  const workout:ActiveWorkout={id:"w",templateId:"t",name:"T",startedAt:1,exercises:[
   {templateExerciseId:"A",name:"A",target,sets:[set("a1",1),set("a2",2)]},
   {templateExerciseId:"B",name:"B",target,sets:[set("b1",1),set("b2",2)]},
   {templateExerciseId:"C",name:"C",target:normal,sets:[set("c1",1)]}
  ]};

  workout.exercises[0].sets[0].completedAt=10;
  expect(nextExerciseAfterCompletedSet(workout,0,0)).toBe("B");
  expect(shouldStartRest(workout,0,0)).toBe(false);
  workout.exercises[1].sets[0].completedAt=20;
  expect(nextExerciseAfterCompletedSet(workout,1,0)).toBe("A");
  expect(shouldStartRest(workout,1,0)).toBe(true);
  workout.exercises[0].sets[1].completedAt=30;
  expect(nextExerciseAfterCompletedSet(workout,0,1)).toBe("B");
  workout.exercises[1].sets[1].completedAt=40;
  expect(nextExerciseAfterCompletedSet(workout,1,1)).toBe("C");
  expect(shouldStartRest(workout,1,1)).toBe(false);
 });
});

describe("active exercise navigation and recovery",()=>{
 const workout:ActiveWorkout={id:"w",templateId:"t",name:"T",startedAt:1,currentExerciseId:"B",rest:{...rest,pausedRemaining:15_000},exercises:[
  {templateExerciseId:"A",name:"A",target:normal,sets:[{id:"a",setNo:1,weight:null,reps:null,rir:null,completedAt:null}]},
  {templateExerciseId:"B",name:"B",target:normal,sets:[
   {id:"b1",setNo:1,weight:30,reps:8,rir:2,completedAt:5},
   {id:"b2",setNo:2,weight:"27,5",reps:"8",rir:"1",completedAt:null}
  ]},
  {templateExerciseId:"C",name:"C",target:normal,sets:[{id:"c",setNo:1,weight:null,reps:null,rir:null,completedAt:null}]}
 ]};

 it("navigates one exercise at a time without changing set history",()=>{
  const next=navigateWorkoutExercise(workout,1);
  expect(next.currentExerciseId).toBe("C");
  expect(currentExerciseIndex(next)).toBe(2);
  expect(next.exercises[1].sets[0].completedAt).toBe(5);
  expect(navigateWorkoutExercise(next,1).currentExerciseId).toBe("C");
  expect(navigateWorkoutExercise(workout,-1).currentExerciseId).toBe("A");
 });

 it("restores the stable exercise, completed sets, and paused timer after reload",()=>{
  const restored=restoreActiveWorkout(structuredClone(workout));
  expect(restored.currentExerciseId).toBe("B");
  expect(currentExerciseIndex(restored)).toBe(1);
  expect(restored.exercises[1].sets[0].completedAt).toBe(5);
  expect(restored.exercises[1].sets[1].weight).toBe("27,5");
  expect(restored.rest).toEqual(workout.rest);
 });

 it("keeps the same current exercise if a plan is reordered",()=>{
  const reordered={...workout,exercises:[workout.exercises[2],workout.exercises[0],workout.exercises[1]]};
  expect(currentExerciseIndex(reordered)).toBe(2);
  expect(restoreActiveWorkout(reordered).currentExerciseId).toBe("B");
 });

 it("chooses the first unfinished set and migrates older active records",()=>{
  expect(firstIncompleteSetIndex(workout.exercises[1])).toBe(1);
  const legacy=structuredClone(workout);delete legacy.currentExerciseId;
  expect(restoreActiveWorkout(legacy).currentExerciseId).toBe("A");
 });
});

describe("rest timer controls",()=>{
 it("pauses, adjusts by 30 seconds while paused, then resumes from the saved time",()=>{
  const paused=toggleRestPause(rest,10_000);
  expect(paused.pausedRemaining).toBe(20_000);
  const extended=adjustRestTimer(paused,30,12_000);
  expect(extended.pausedRemaining).toBe(50_000);
  expect(extended.endsAt).toBe(rest.endsAt);
  const shortened=adjustRestTimer(extended,-30,12_000);
  const resumed=toggleRestPause(shortened,20_000);
  expect(resumed.endsAt).toBe(40_000);
  expect(resumed.pausedRemaining).toBeUndefined();
  expect(adjustRestTimer({...rest,notifiedAt:30_000},30,30_000).notifiedAt).toBeUndefined();
 });

 it("clamps a shortened timer at zero and only signals once after expiry",()=>{
  expect(adjustRestTimer({...rest,endsAt:5_000},-30,10_000).endsAt).toBe(10_000);
  expect(isRestNotificationDue(rest,30_000)).toBe(true);
  expect(isRestNotificationDue({...rest,notifiedAt:30_000},31_000)).toBe(false);
  expect(isRestNotificationDue({...rest,pausedRemaining:0},31_000)).toBe(false);
 });
});
