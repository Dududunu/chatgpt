import { describe,expect,it } from "vitest";
import { adjustRestTimer, isRestNotificationDue, normalizeSetForCompletion, shouldStartRest, toFiniteNumber, toggleRestPause } from "./workoutLogic";
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
