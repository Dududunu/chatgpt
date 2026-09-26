import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it,vi } from "vitest";
import { WorkoutSummaryScreen } from "./WorkoutSummaryScreen";
import type { WorkoutHistory } from "./types";

function workout(id:string,start:number,weight:number):WorkoutHistory{return {id,templateId:"upper",name:"UPPER 1",startedAt:start,endedAt:start+3_600_000,exercises:[{templateExerciseId:"bench",name:"Bench",target:{id:"bench",name:"Bench",sets:1,repMin:6,repMax:8,rir:"2",tempo:"2110",restSec:120},sets:[{id:`${id}-set`,setNo:1,weight,reps:8,rir:2,completedAt:start+100}]}]}}
const common={history:[],templates:[],onDone:vi.fn(),onHistory:vi.fn(),onSavePlanChanges:vi.fn(async()=>{}),notify:vi.fn()};

describe("workout completion summary",()=>{
 it("shows duration, working volume and a real PR only against past history",()=>{
  const previous=workout("old",100,70),current=workout("new",1_000,80);
  const html=renderToStaticMarkup(createElement(WorkoutSummaryScreen,{...common,workout:current,history:[previous]}));
  expect(html).toContain("Trening zakończony");expect(html).toContain("Vs poprzednio");expect(html).toContain("Nowe PR");expect(html).toContain("e1RM");
 });
 it("does not call a first known lift a personal record",()=>{
  const html=renderToStaticMarkup(createElement(WorkoutSummaryScreen,{...common,workout:workout("first",100,80)}));
  expect(html).toContain("Brak nowego rekordu");expect(html).not.toContain("Nowe PR");
 });
});
