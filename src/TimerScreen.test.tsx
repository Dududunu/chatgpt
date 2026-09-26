import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it } from "vitest";
import { TimerScreen } from "./TimerScreen";
import type { ActiveWorkout,RestState } from "./types";

const active:ActiveWorkout={id:"w",templateId:"t",name:"UPPER 1",startedAt:0,currentExerciseId:"bench",exercises:[
 {templateExerciseId:"bench",name:"Bench Press",target:{id:"bench",name:"Bench Press",sets:3,repMin:5,repMax:8,rir:"2",tempo:"2110",restSec:120},sets:[
  {id:"1",setNo:1,weight:80,reps:5,rir:2,completedAt:1},
  {id:"2",setNo:2,weight:null,reps:null,rir:null,completedAt:null}
 ]}
]};
const rest:RestState={exerciseName:"Bench Press",nextExerciseId:"bench",nextSet:2,startedAt:0,endsAt:60_000};
const actions={onClose:()=>{},onAdjust:()=>{},onPause:()=>{},onSkip:()=>{}};

describe("rest timer screen",()=>{
 it("renders the timer, next set, previous result, and controls",()=>{
  const html=renderToStaticMarkup(createElement(TimerScreen,{rest,remaining:43_000,now:17_000,active,...actions}));
  expect(html).toContain("00:43");
  expect(html).toContain("Bench Press · seria 2");
  expect(html).toContain("Ostatnio: 80 × 5");
  expect(html).toContain("80 kg × 6");
  expect(html).toContain("propozycja na podstawie poprzedniej serii");
  expect(html).toContain("−30 sek.");
  expect(html).toContain("+30 sek.");
  expect(html).toContain("Pomiń przerwę");
 });
 it("renders a manual timer without implying a workout set",()=>{
  const html=renderToStaticMarkup(createElement(TimerScreen,{rest:{...rest,kind:"manual",exerciseName:"Timer"},remaining:90_000,now:0,active,...actions}));
  expect(html).toContain("Timer ręczny");
  expect(html).not.toContain("NASTĘPNIE");
 });
 it("keeps the full screen visible after expiry until the user returns",()=>{
  const html=renderToStaticMarkup(createElement(TimerScreen,{rest,remaining:0,now:60_000,active,...actions}));
  expect(html).toContain("PRZERWA ZAKOŃCZONA");
  expect(html).toContain("Wróć do serii");
  expect(html).not.toContain("Pomiń przerwę");
  expect(html).toContain("disabled=\"\"");
 });
});
