import { describe,expect,it } from "vitest";
import type { ExerciseLog,ExerciseTemplate,SetLog } from "./types";
import { progressionSuggestion } from "./progression";

const target:ExerciseTemplate={id:"bench",name:"Bench",sets:3,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:120,minIncrement:2.5};
function workout(reps:number[],rir:(number|null)[]=(reps.map(()=>2)),types:(SetLog["type"])[]=[]):ExerciseLog{
 return {templateExerciseId:"bench",name:"Bench",target,sets:reps.map((count,index)=>({id:String(index),setNo:index+1,weight:80,reps:count,rir:rir[index]??null,completedAt:100,type:types[index]}))};
}

describe("data-based progression",()=>{
 it("adds the configured increment after 8/8/8 with target RIR",()=>{
  expect(progressionSuggestion(workout([8,8,8]),target)).toEqual({kind:"increase",currentWeight:80,targetWeight:82.5,increment:2.5});
 });
 it("repeats the current load when rep range was missed",()=>{
  expect(progressionSuggestion(workout([8,7,6]),target)?.kind).toBe("repeat");
 });
 it("uses reps alone when no RIR was entered",()=>{
  expect(progressionSuggestion(workout([8,8,8],[null,null,null]),target)?.kind).toBe("increase");
 });
 it("does not count warm-up sets toward progress",()=>{
  const previous=workout([8,8,8,12],[2,2,2,5],[undefined,undefined,undefined,"warmup"]);
  expect(progressionSuggestion(previous,target)?.kind).toBe("increase");
 });
 it("does not progress from drop sets or incomplete working sets",()=>{
  expect(progressionSuggestion(workout([8,8,8],[2,2,2],[undefined,"drop",undefined]),target)?.kind).toBe("repeat");
  const incomplete=workout([8,8,8]);incomplete.sets[1].completedAt=null;
  expect(progressionSuggestion(incomplete,target)).toBeNull();
 });
 it("treats a failure set as zero RIR without changing its saved field",()=>{
  const previous=workout([8,8,8],[2,2,2]);previous.sets[2].toFailure=true;previous.sets[2].rir=2;
  expect(progressionSuggestion(previous,target)?.kind).toBe("repeat");
  expect(previous.sets[2].rir).toBe(2);
 });
});
