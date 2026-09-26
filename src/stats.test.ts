import { describe,expect,it } from "vitest";
import { actual1rm,bestE1rm,e1rm,volume } from "./stats";
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

 it("does not interpret timed sets as weight volume or e1RM",()=>{
  const w=workout([set("40","30",10)],timed);
  expect(volume(w)).toBe(0);
  expect(bestE1rm([w],"X")).toBe(0);
  expect(actual1rm([w],"X")).toBe(0);
 });
});
