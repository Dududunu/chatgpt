import type { BodyEntry,WorkoutHistory } from "./types";

export function localDateKey(timestamp:number):string{
 const date=new Date(timestamp);
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export function groupWorkoutsByDay(workouts:WorkoutHistory[]):Map<string,WorkoutHistory[]>{
 const grouped=new Map<string,WorkoutHistory[]>();
 for(const workout of workouts){const key=localDateKey(workout.startedAt);grouped.set(key,[...(grouped.get(key)??[]),workout])}
 for(const rows of grouped.values())rows.sort((a,b)=>a.startedAt-b.startedAt);
 return grouped;
}

export function workoutsForCalendarDay(dayKey:string,workoutsByDay:Map<string,WorkoutHistory[]>):WorkoutHistory[]{
 return workoutsByDay.get(dayKey)??[];
}

export function measurementsForCalendarDay(dayKey:string,entries:BodyEntry[]):BodyEntry[]{
 return entries.filter(entry=>localDateKey(entry.date)===dayKey);
}

export function groupBodyByDay(entries:BodyEntry[]):Set<string>{return new Set(entries.filter(entry=>entry.weight!=null).map(entry=>localDateKey(entry.date)))}

export function moveCalendarMonth(month:Date,delta:-1|1):Date{return new Date(month.getFullYear(),month.getMonth()+delta,1)}

export type CalendarCell={key:string;day:number;date:number;inMonth:boolean;hasWorkout:boolean;hasMeasurement:boolean};

export function calendarMonthCells(month:Date,workouts:WorkoutHistory[],body:BodyEntry[]):CalendarCell[]{
 const first=new Date(month.getFullYear(),month.getMonth(),1);
 const daysInMonth=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const leading=(first.getDay()+6)%7;
 const workoutDays=groupWorkoutsByDay(workouts),bodyDays=groupBodyByDay(body);
 const cells:CalendarCell[]=[];
 for(let day=1-leading;day<=daysInMonth;day++){
  if(day<1){cells.push({key:`blank-${day}`,day:0,date:0,inMonth:false,hasWorkout:false,hasMeasurement:false});continue}
  const timestamp=new Date(month.getFullYear(),month.getMonth(),day).getTime(),key=localDateKey(timestamp);
  cells.push({key,day,date:timestamp,inMonth:true,hasWorkout:(workoutDays.get(key)?.length??0)>0,hasMeasurement:bodyDays.has(key)});
 }
 while(cells.length%7!==0)cells.push({key:`end-${cells.length}`,day:0,date:0,inMonth:false,hasWorkout:false,hasMeasurement:false});
 return cells;
}
