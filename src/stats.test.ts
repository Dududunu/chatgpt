import { describe,expect,it } from "vitest";
import { actual1rm,bestE1rm,e1rm,recentPrCount,volume } from "./stats";
import type { ExerciseTemplate,SetLog,WorkoutHistory } from "./types";

const strength:ExerciseTemplate={id:"x",name:"X",sets:4,repMin:1,repMax:12,rir:"2",tempo:"2110",restSec:120};
const timed:ExerciseTemplate={...strength,id:"timed",timed:true};

function set(weight:SetLog["weight"],reps:SetLog["reps"],completedAt:number|null):SetLog{
 return {id:`${weight}-${reps}-${completedAt}`,setNo:1,weight,reps,rir:"2",completedAt};
}

function workout(sets:SetLog[],target=strength):WorkoutHistory{
 return {id:"w",templateId:"t",name:"T",startedAt:1,endedAt:2,exercises:[
  {templateExerciseId:target.id,name:target.name,target,sets}
 ]};
}

describe("strength statistics",()=>{
 it("uses the Epley formula",()=>expect(e1rm(90,1)).toBeCloseTo(93,5));

 it("normalizes decimal commas and excludes drafts and invalid reps from volume",()=>{
  const w=workout([
   set("27,5","8",10),
   set("100","10",null),
   set("30","7.5",10),
   set("NaN","8",10)
  ]);
  expect(volume(w)).toBe(220);
 });

 it("calculates e1RM only from completed valid strength sets",()=>{
  const w=workout([
   set("27,5","8",10),
   set("100","10",null),
   set("30","7.5",10),
   set("NaN","8",10)
  ]);
  expect(bestE1rm([w],"X")).toBeCloseTo(e1rm(27.5,8),5);
 });

 it("calculates actual 1RM only from completed one-rep strength sets",()=>{
  const w=workout([set("90","1",10),set("110","1",null)]);
  expect(actual1rm([w],"X")).toBe(90);
 });

 it("recalculates best e1RM and volume after an edited history record",()=>{
  const history=workout([set("80","5",10)]);
  const before=bestE1rm([history],"X");
  const edited=structuredClone(history);
  edited.exercises[0].sets[0].weight="85,5";
  expect(bestE1rm([edited],"X")).toBeGreaterThan(before);
  expect(volume(edited)).toBe(427.5);
 });

 it("recalculates PRs after an old history record is edited",()=>{
  const earlier=workout([set("80","5",10)]);earlier.startedAt=1_000;earlier.endedAt=2_000;
  const recent=workout([set("90","5",20)]);recent.id="recent";recent.startedAt=10_000;recent.endedAt=11_000;
  expect(recentPrCount([recent,earlier],5_000)).toBe(1);
  const edited=structuredClone(earlier);edited.exercises[0].sets[0].weight="95";
  expect(recentPrCount([recent,edited],5_000)).toBe(0);
 });

 it("counts one PR per exercise per workout even when multiple sets improve",()=>{
  const session=workout([set("80","5",10),set("85","5",11)]);session.startedAt=10_000;
  expect(recentPrCount([session],0)).toBe(1);
 });

 it("does not interpret timed sets as weight volume or e1RM",()=>{
  const w=workout([set("40","30",10)],timed);
  expect(volume(w)).toBe(0);
  expect(bestE1rm([w],"X")).toBe(0);
  expect(actual1rm([w],"X")).toBe(0);
 });
});
