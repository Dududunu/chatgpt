import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it,vi } from "vitest";
import { PlanScreen } from "./PlanScreen";
import type { WorkoutTemplate } from "./types";

const template:WorkoutTemplate={id:"upper",name:"UPPER 1",exercises:[{id:"bench",name:"Wyciskanie hantli",sets:4,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:180}]};
const common={settings:null,templates:[template],workouts:[],active:null,onSave:vi.fn(async()=>{}),onCreate:vi.fn(async()=>{}),onDelete:vi.fn(async()=>{}),onStart:vi.fn(),onContinue:vi.fn(),notify:vi.fn()};

describe("plan screen",()=>{
 it("shows a compact routine summary and row actions",()=>{
  const html=renderToStaticMarkup(createElement(PlanScreen,common));
  expect(html).toContain("UPPER 1");
  expect(html).toContain("1 ćwiczeń · ~15 min · bez historii");
  expect(html).toContain("Duplikuj");
  expect(html).toContain("Zmień nazwę");
  expect(html).toContain("Usuń");
 });

 it("gives an actionable empty state when no plans exist",()=>{
  const html=renderToStaticMarkup(createElement(PlanScreen,{...common,templates:[]}));
  expect(html).toContain("Dodaj swój pierwszy plan treningowy");
 });
});
