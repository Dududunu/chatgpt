import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it,vi } from "vitest";
import { WorkoutReviewEditor } from "./WorkoutReviewEditor";
import type { WorkoutHistory } from "./types";

const workout:WorkoutHistory={id:"workout-1",templateId:"upper",name:"UPPER 1",startedAt:100,endedAt:200,exercises:[]};
const props={workout,userId:"user-a",syncStatus:"synced",onSaveReview:vi.fn(async()=>{}),onRetry:vi.fn(async()=>{}),notify:vi.fn()};

describe("workout review controls",()=>{
 it("offers an optional star rating, bounded note, and photo fallback in the summary",()=>{
  const html=renderToStaticMarkup(createElement(WorkoutReviewEditor,props));
  expect(html).toContain("JAK POSZEDŁ TRENING?");
  expect(html.match(/aria-label="[1-5] (?:gwiazdka|gwiazdki)"/g)).toHaveLength(5);
  expect(html).toContain("0 / 50 słów");
  expect(html).toContain('accept="image/*"');
  expect(html).toContain("Brak dodanego zdjęcia");
 });

 it("does not render empty review sections in workout history",()=>{
  expect(renderToStaticMarkup(createElement(WorkoutReviewEditor,{...props,readOnly:true}))).toBe("");
 });

 it("shows the saved rating and note without exposing empty photo or edit controls",()=>{
  const saved={...workout,rating:4,reviewText:"Mocna sesja."};
  const html=renderToStaticMarkup(createElement(WorkoutReviewEditor,{...props,workout:saved,readOnly:true}));
  expect(html).toContain("4 z 5 gwiazdek");
  expect(html).toContain("Mocna sesja.");
  expect(html).not.toContain("DODAJ ZDJĘCIE");
 });

 it("uses a non-broken placeholder when a saved photo cannot be loaded",()=>{
  const saved={...workout,rating:4,photoPath:"user-a/workout-1/photo-1.webp"};
  const html=renderToStaticMarkup(createElement(WorkoutReviewEditor,{...props,workout:saved,readOnly:true}));
  expect(html).toContain("Wczytywanie zdjęcia");
  expect(html).not.toContain("<img");
 });
});
