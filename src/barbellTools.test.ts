import { describe,expect,it } from "vitest";
import { calculatePlates,DEFAULT_PLATES,generateWarmupSets,isBarbellExercise } from "./barbellTools";

describe("plate calculator",()=>{
 it("loads a standard 60 kg target on a 20 kg bar",()=>{
  expect(calculatePlates(60,20,DEFAULT_PLATES)).toMatchObject({exact:true,nearest:{weight:60,platesPerSide:[20]}});
 });
 it("finds a symmetric exact 87.5 kg load",()=>{
  const stack=calculatePlates(87.5,20,DEFAULT_PLATES)?.nearest;
  expect(stack?.platesPerSide.reduce((sum,plate)=>sum+plate,0)).toBe(33.75);
  expect(stack?.platesPerSide).toHaveLength(4);
 });
 it("reports the nearest achievable loads when an exact target is impossible",()=>{
  expect(calculatePlates(70,20,[20])).toMatchObject({exact:false,nearest:{weight:60},below:{weight:60},above:{weight:100}});
 });
 it("supports custom plates and bar weight",()=>{
  expect(calculatePlates(30,15,[5,2.5])).toMatchObject({exact:true,nearest:{weight:30,platesPerSide:[5,2.5]}});
 });
 it("does not throw for an empty or impossible configuration",()=>{
  expect(calculatePlates(10,20,[])).toMatchObject({exact:false,nearest:{weight:20,platesPerSide:[]},above:{weight:20}});
  expect(calculatePlates(Number.NaN,20,DEFAULT_PLATES)).toBeNull();
 });
});

describe("barbell warm-ups",()=>{
 it("generates a short ramp from the first working weight",()=>{
  const sets=generateWarmupSets(90,20,2.5,()=>"warm");
  expect(sets.map(set=>[set.weight,set.reps])).toEqual([[20,10],[40,6],[60,4],[75,2]]);
  expect(sets.every(set=>set.type==="warmup"&&!set.completedAt&&set.warmupGenerated)).toBe(true);
 });
 it("uses fewer warm-ups for light targets and none when the target is at bar weight",()=>{
  expect(generateWarmupSets(25,20,2.5,()=>"warm").map(set=>set.weight)).toEqual([20]);
  expect(generateWarmupSets(20,20,2.5,()=>"warm")).toEqual([]);
 });
 it("offers plates by default only for barbell work",()=>{
  expect(isBarbellExercise("Przysiad ze sztangą")).toBe(true);
  expect(isBarbellExercise("Wyciskanie hantli")).toBe(false);
  expect(isBarbellExercise("Leg press")).toBe(false);
  expect(isBarbellExercise("Wyciskanie hantli","",true)).toBe(true);
 });
});
