import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {ExerciseImage} from "./ExerciseImage";
import {exerciseImagePrecachePaths,exerciseImageSpecs,resolveExerciseImage} from "./exerciseImages";
import {defaultTemplates} from "./seed";

describe("static exercise atlas images",()=>{
 it("maps each bundled exercise to a local lazy-loaded WebP and technique cues",()=>{
  const ids=defaultTemplates.flatMap(template=>template.exercises.map(exercise=>exercise.id));
  expect(ids).toHaveLength(25);
  expect(Object.keys(exerciseImageSpecs)).toHaveLength(25);
  for(const id of ids){
   const spec=exerciseImageSpecs[id];
   expect(spec,`missing image mapping for ${id}`).toBeDefined();
   expect(spec.imagePath).toBe(`./exercise-images/${id}.webp`);
   expect(spec.mainMuscles.length).toBeGreaterThan(0);
  }
  const html=renderToStaticMarkup(createElement(ExerciseImage,{exerciseId:"incline-db"}));
  expect(html).toContain('src="./exercise-images/incline-db.webp"');
  expect(html).toContain('loading="lazy"');
  expect(html).toContain("Technika");
 });

 it("renders a clear fallback for missing mappings and failed image loads",()=>{
  expect(resolveExerciseImage("custom-exercise").kind).toBe("fallback");
  expect(resolveExerciseImage("incline-db",true).kind).toBe("fallback");
  const html=renderToStaticMarkup(createElement(ExerciseImage,{exerciseId:"custom-exercise"}));
  expect(html).toContain("Brak podglądu ćwiczenia");
  expect(html).not.toContain("<img");
 });

 it("exposes every local image path to the service worker precache manifest",()=>{
  expect(exerciseImagePrecachePaths).toHaveLength(25);
  expect([...exerciseImagePrecachePaths].sort()).toEqual(Object.keys(exerciseImageSpecs).map(id=>`./exercise-images/${id}.webp`).sort());
 });
});
