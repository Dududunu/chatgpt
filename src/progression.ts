import type { ExerciseLog, ExerciseTemplate, SetLog } from "./types";
import { toFiniteNumber } from "./workoutLogic";

export type ProgressionSuggestion={kind:"increase"|"repeat";currentWeight:number;targetWeight:number;increment:number};

function workingSets(sets:SetLog[]):SetLog[]{return sets.filter(set=>set.type!=="warmup"&&set.type!=="drop");}

export function progressionSuggestion(previous:ExerciseLog|undefined,target:ExerciseTemplate,defaultIncrement=2.5):ProgressionSuggestion|null{
 if(!previous||target.timed)return null;
 const sets=workingSets(previous.sets);
 if(!sets.length||sets.some(set=>!set.completedAt))return null;
 const normalized=sets.map(set=>({set,reps:toFiniteNumber(set.reps),weight:toFiniteNumber(set.weight),rir:set.toFailure?0:toFiniteNumber(set.rir)}));
 if(normalized.some(item=>item.reps===null||!Number.isInteger(item.reps)||item.weight===null||item.weight<0))return null;
 const weights=normalized.map(item=>item.weight!);
 const currentWeight=Math.max(...weights);
 const rawIncrement=target.minIncrement??defaultIncrement;
 const increment=Number.isFinite(rawIncrement)&&rawIncrement>0?rawIncrement:2.5;
 const targetRir=Number(target.rir.trim().replace(",","."));
 const rirTarget=Number.isFinite(targetRir)?targetRir:null;
 const reachedReps=normalized.every(item=>item.reps!>=target.repMax);
 const metRir=rirTarget===null||normalized.every(item=>item.rir===null||item.rir>=rirTarget);
 const completedPlannedSets=sets.length>=target.sets;
 return completedPlannedSets&&reachedReps&&metRir
  ?{kind:"increase",currentWeight,targetWeight:roundLoad(currentWeight+increment),increment}
  :{kind:"repeat",currentWeight,targetWeight:currentWeight,increment};
}

function roundLoad(value:number):number{return Number(value.toFixed(2));}
