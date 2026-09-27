import { describe,expect,it } from "vitest";
import { createUndoSnapshot,restoreUndoSnapshot } from "./undoLogic";
import type { ActiveWorkout,WorkoutTemplate } from "./types";

const before:ActiveWorkout={id:"workout",templateId:"upper",name:"Upper 1",startedAt:10,currentExerciseId:"bench",rest:null,exercises:[{templateExerciseId:"bench",name:"Bench press",target:{id:"bench",name:"Bench press",sets:2,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:120},sets:[{id:"s1",setNo:1,weight:"80",reps:"8",rir:null,completedAt:null},{id:"s2",setNo:2,weight:null,reps:null,rir:null,completedAt:null}]}]};

describe("workout undo recovery",()=>{
 it("undoes a completed set and removes the timer opened by that completion",()=>{
  const snapshot=createUndoSnapshot(before);
  const changed=structuredClone(before);changed.exercises[0].sets[0].completedAt=50;changed.rest={kind:"rest",exerciseName:"Bench press",nextSet:2,startedAt:50,endsAt:170};
  const restored=restoreUndoSnapshot(snapshot,60);
  expect(changed.rest?.endsAt).toBe(170);
  expect(restored.rest).toBeNull();expect(restored.exercises[0].sets[0]).toMatchObject({weight:"80",reps:"8",completedAt:null});
 });
 it("restores deleted sets and skipped exercise state without losing entered values",()=>{
  const snapshot=createUndoSnapshot(before);
  const changed=structuredClone(before);changed.exercises[0].sets.splice(0,1);changed.exercises[0].status="skipped";
  const restored=restoreUndoSnapshot(snapshot,70);
  expect(changed.exercises[0].sets).toHaveLength(1);expect(changed.exercises[0].status).toBe("skipped");
  expect(restored.exercises[0].sets).toHaveLength(2);expect(restored.exercises[0].sets[0]).toMatchObject({weight:"80",reps:"8"});expect(restored.exercises[0].status).toBeUndefined();
 });
 it("carries the pre-swap plan for undo only when the user chose to save the replacement",()=>{
  const template:WorkoutTemplate={id:"upper",name:"Upper",exercises:[{id:"bench",name:"Bench press",sets:2,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:120}]};
  expect(createUndoSnapshot(before).template).toBeUndefined();
  const snapshot=createUndoSnapshot(before,template);
  template.exercises[0].name="Changed";
  expect(restoreUndoSnapshot(snapshot,80).exercises[0].name).toBe("Bench press");
  expect(snapshot.template?.exercises[0].name).toBe("Bench press");
 });
});
