import { describe,expect,it } from "vitest";
import { addTemplateExercise,createWorkoutSnapshot,createWorkoutTemplate,duplicateWorkoutTemplate,moveTemplateExercise,prefillPreviousWeights,removeTemplateExercise,replaceTemplateExercise,updateTemplateExercise,validateWorkoutTemplate } from "./planLogic";
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

 it("changes a plan exercise only through the explicit replacement helper and preserves its stable ID",()=>{
  const before=structuredClone(template),target={...exercise("dumbbell","Wyciskanie hantli"),sets:3};
  const after=replaceTemplateExercise(template,"press",target);
  expect(after.exercises[0]).toMatchObject({id:"press",name:"Wyciskanie hantli",sets:3});
  expect(before.exercises[0]).toMatchObject({id:"press",name:"press"});
  expect(template.exercises[0]).toMatchObject({id:"press",name:"press"});
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

 it("prefills only the previous loads and never completes the new sets",()=>{
  const current=createWorkoutSnapshot({...template,exercises:[exercise("press","press")]},200,()=>"new");
  const previous={id:"old",templateId:"upper",name:"UPPER 1",startedAt:100,endedAt:150,exercises:[{templateExerciseId:"press",name:"press",target:exercise("press","press"),sets:[{id:"p1",setNo:1,weight:"80",reps:8,rir:2,completedAt:120},{id:"p2",setNo:2,weight:"82.5",reps:6,rir:2,completedAt:130}]}]};
  const filled=prefillPreviousWeights(current,previous,true);
  expect(filled.exercises[0].sets.map(set=>set.weight)).toEqual([80,82.5]);
  expect(filled.exercises[0].sets.every(set=>set.completedAt===null&&set.reps===null)).toBe(true);
 });

 it("uses the replacement session entry instead of its archived replaced entry",()=>{
  const current=createWorkoutSnapshot({...template,exercises:[exercise("press","press")]},200,()=>"new");
  const previous={id:"old",templateId:"upper",name:"UPPER 1",startedAt:100,endedAt:150,exercises:[
   {templateExerciseId:"press",name:"press",target:exercise("press","press"),status:"replaced" as const,sets:[{id:"old",setNo:1,weight:60,reps:8,rir:2,completedAt:120}]},
   {templateExerciseId:"press",name:"Wyciskanie hantli",target:exercise("press","Wyciskanie hantli"),sets:[{id:"newer",setNo:1,weight:30,reps:10,rir:2,completedAt:130}]}
  ]};
  expect(prefillPreviousWeights(current,previous,true).exercises[0].sets[0].weight).toBe(30);
 });
});
