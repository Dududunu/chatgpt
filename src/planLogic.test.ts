import { describe,expect,it } from "vitest";
import { addTemplateExercise,createWorkoutSnapshot,createWorkoutTemplate,duplicateWorkoutTemplate,moveTemplateExercise,removeTemplateExercise,updateTemplateExercise,validateWorkoutTemplate } from "./planLogic";
import type { ExerciseTemplate,WorkoutTemplate } from "./types";

const exercise=(id:string,name=id):ExerciseTemplate=>({id,name,sets:2,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:120});
const template:WorkoutTemplate={id:"upper",name:"UPPER 1",exercises:[exercise("press"),exercise("row")]};

describe("editable plans",()=>{
 it("creates, duplicates, adds, edits, reorders, and removes without mutating the source",()=>{
  const created=createWorkoutTemplate("  PUSH  ","push",1);
  expect(created).toEqual({id:"push",name:"PUSH",exercises:[],createdAt:1});
  const duplicate=duplicateWorkoutTemplate(template,"upper-copy","UPPER COPY");
  const added=addTemplateExercise(duplicate,exercise("fly"));
  const edited=updateTemplateExercise(added,"fly",{sets:3,restSec:90});
  const reordered=moveTemplateExercise(edited,"fly",0);
  const removed=removeTemplateExercise(reordered,"row");
  expect(removed.exercises.map(item=>item.id)).toEqual(["fly","press"]);
  expect(removed.exercises[0]).toMatchObject({sets:3,restSec:90});
  expect(template.exercises.map(item=>item.id)).toEqual(["press","row"]);
 });

 it("keeps a started workout and its historical target independent of future plan edits",()=>{
  let id=0;
  const snapshot=createWorkoutSnapshot(template,123,()=>`id-${++id}`);
  const changed=updateTemplateExercise({...template,name:"PUSH"},"press",{name:"Changed press",sets:4});
  expect(snapshot.name).toBe("UPPER 1");
  expect(snapshot.exercises[0].name).toBe("press");
  expect(snapshot.exercises[0].target.sets).toBe(2);
  expect(snapshot.exercises[0].sets.map(set=>set.id)).toEqual(["id-2","id-3"]);
  expect(changed.exercises[0].sets).toBe(4);
 });

 it("rejects invalid rep ranges, RIR, and rests while allowing an empty new template",()=>{
  expect(validateWorkoutTemplate(createWorkoutTemplate("PUSH","push",1))).toBeNull();
  expect(validateWorkoutTemplate({...template,exercises:[{...exercise("x"),repMin:10,repMax:8}]})).toContain("zakres powtórzeń");
  expect(validateWorkoutTemplate({...template,exercises:[{...exercise("x"),rir:"11"}]})).toContain("RIR");
  expect(validateWorkoutTemplate({...template,exercises:[{...exercise("x"),restSec:-1}]})).toContain("przerwa");
 });

 it("does not add the same exercise twice and ignores unknown drag IDs",()=>{
  const same=addTemplateExercise(template,exercise("press","duplicate"));
  expect(same.exercises).toHaveLength(2);
  expect(moveTemplateExercise(template,"missing",0)).toBe(template);
 });
});
