import {describe,expect,it} from "vitest";
import {defaultTemplates} from "./seed";
import {getExerciseTechnique} from "./exerciseTechnique";

describe("exercise technique cues",()=>{
 it("keeps short technique instructions for every planned movement",()=>{
  const ids=defaultTemplates.flatMap(template=>template.exercises.map(exercise=>exercise.id));
  expect(ids).toHaveLength(25);
  for(const id of ids){
   const points=getExerciseTechnique(id);
   expect(points,`missing technique cues for ${id}`).not.toBeNull();
   expect(points?.length).toBeGreaterThanOrEqual(3);
   expect(points?.length).toBeLessThanOrEqual(5);
  }
 });
 it("returns no technique list for an unmapped custom movement",()=>{
  expect(getExerciseTechnique("unknown-movement")).toBeNull();
 });
});
