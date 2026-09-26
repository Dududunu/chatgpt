import type { RestState } from "./types";

export function restSessionKey(workoutId:string,rest:RestState):string{
 return `${workoutId}:${rest.kind??"rest"}:${rest.startedAt}:${rest.endsAt}`;
}

export function shouldShowFullscreenTimer(workoutId:string|null,rest:RestState|null|undefined,dismissedKey:string|null):boolean{
 return Boolean(workoutId&&rest&&restSessionKey(workoutId,rest)!==dismissedKey);
}

export function remainingRestMs(rest:RestState,now:number):number{
 return rest.pausedRemaining!==undefined?Math.max(0,rest.pausedRemaining):Math.max(0,rest.endsAt-now);
}

export function restProgress(rest:RestState,now:number):number{
 const total=Math.max(1,rest.endsAt-rest.startedAt);
 return Math.min(1,Math.max(0,1-remainingRestMs(rest,now)/total));
}

export function createManualRest(seconds:number,now:number):RestState{
 return {kind:"manual",exerciseName:"Timer ręczny",nextSet:0,startedAt:now,endsAt:now+seconds*1000};
}
