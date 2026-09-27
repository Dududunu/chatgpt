import type { ActiveWorkout, WorkoutTemplate } from "./types";

export type UndoSnapshot={workout:ActiveWorkout;template?:WorkoutTemplate};

export function createUndoSnapshot(workout:ActiveWorkout,template?:WorkoutTemplate):UndoSnapshot{
 return {workout:structuredClone(workout),...(template?{template:structuredClone(template)}:{})};
}

export function restoreUndoSnapshot(snapshot:UndoSnapshot,updatedAt:number):ActiveWorkout{
 return {...structuredClone(snapshot.workout),updatedAt};
}
