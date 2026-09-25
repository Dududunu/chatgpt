import { describe,expect,it } from "vitest";
import { normalizeSetForCompletion, shouldStartRest, toFiniteNumber } from "./workoutLogic";
import type { ActiveWorkout, ExerciseTemplate } from "./types";

const normal:ExerciseTemplate={id:"x",name:"X",sets:2,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:120};

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
});

describe("superset rest",()=>{
 it("starts rest only after all exercises in the superset round are complete",()=>{
  const target={...normal,superset:"a"};
  const workout:ActiveWorkout={id:"w",templateId:"t",name:"T",startedAt:1,exercises:[
   {templateExerciseId:"1",name:"A",target,sets:[{id:"1",setNo:1,weight:10,reps:8,rir:1,completedAt:10}]},
   {templateExerciseId:"2",name:"B",target,sets:[{id:"2",setNo:1,weight:10,reps:8,rir:1,completedAt:null}]}
  ]};
  expect(shouldStartRest(workout,0,0)).toBe(false);
  workout.exercises[1].sets[0].completedAt=20;
  expect(shouldStartRest(workout,1,0)).toBe(true);
 });
});
