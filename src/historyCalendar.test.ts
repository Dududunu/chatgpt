import { describe,expect,it } from "vitest";
import type { BodyEntry,WorkoutHistory } from "./types";
import { calendarMonthCells,groupWorkoutsByDay,measurementsForCalendarDay,moveCalendarMonth,workoutsForCalendarDay } from "./historyCalendar";

const workout=(id:string,year:number,month:number,day:number):WorkoutHistory=>({id,templateId:"t",name:id,startedAt:new Date(year,month,day,10).getTime(),endedAt:new Date(year,month,day,11).getTime(),exercises:[]});

describe("history calendar",()=>{
 it("groups workouts by local calendar day",()=>{
  const grouped=groupWorkoutsByDay([workout("a",2026,8,26),workout("b",2026,8,26),workout("c",2026,8,27)]);
  expect(grouped.size).toBe(2);expect([...grouped.values()][0]).toHaveLength(2);
 });
 it("moves between months and across a year boundary",()=>{
  expect(moveCalendarMonth(new Date(2026,0,10),-1)).toEqual(new Date(2025,11,1));
  expect(moveCalendarMonth(new Date(2026,11,10),1)).toEqual(new Date(2027,0,1));
 });
 it("marks workout and weight days independently and supports multiple sessions",()=>{
  const sessions=[workout("a",2026,8,26),workout("b",2026,8,26)];
  const body:BodyEntry[]=[{id:"m",date:new Date(2026,8,26,8).getTime(),weight:70}];
  const cell=calendarMonthCells(new Date(2026,8,1),sessions,body).find(item=>item.day===26);
  expect(cell?.hasWorkout).toBe(true);expect(cell?.hasMeasurement).toBe(true);
 });
 it("shows every workout and body measurement after selecting a calendar day",()=>{
  const sessions=[workout("a",2026,8,26),workout("b",2026,8,26),workout("c",2026,8,27)];
  const body:BodyEntry[]=[{id:"same-day",date:new Date(2026,8,26,8).getTime(),weight:70},{id:"other-day",date:new Date(2026,8,27,8).getTime(),weight:71}];
  const day="2026-09-26";
  expect(workoutsForCalendarDay(day,groupWorkoutsByDay(sessions)).map(item=>item.id)).toEqual(["a","b"]);
  expect(measurementsForCalendarDay(day,body).map(item=>item.id)).toEqual(["same-day"]);
 });
 it("starts the month on Monday and includes complete week rows",()=>{
  const cells=calendarMonthCells(new Date(2026,8,1),[],[]);
  expect(cells[0].day).toBe(0);expect(cells.length%7).toBe(0);expect(cells.filter(cell=>cell.inMonth)).toHaveLength(30);
 });
});
