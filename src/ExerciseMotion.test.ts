import { describe,expect,it } from "vitest";
import { defaultTemplates } from "./seed";
import { getExerciseMotionSpec } from "./ExerciseMotion";

describe("exercise movement media",()=>{
 it("has a local animated SVG mapping and short technique cues for every planned movement",()=>{
  const ids=defaultTemplates.flatMap(template=>template.exercises.map(exercise=>exercise.id));
  expect(ids).toHaveLength(25);
  for(const id of ids){
   const spec=getExerciseMotionSpec(id);
   expect(spec,`missing movement for ${id}`).not.toBeNull();
   expect(spec?.technique.length).toBeGreaterThanOrEqual(3);
   expect(spec?.technique.length).toBeLessThanOrEqual(5);
  }
 });

 it("returns the no-preview fallback for an unmapped future exercise",()=>{
  expect(getExerciseMotionSpec("unknown-movement")).toBeNull();
 });
});
