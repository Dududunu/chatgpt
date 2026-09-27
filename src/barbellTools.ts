import type { SetLog } from "./types";

export const DEFAULT_PLATES=[25,20,15,10,5,2.5,1.25,0.5];

export type PlateStack={weight:number;platesPerSide:number[]};
export type PlateCalculation={targetWeight:number;barWeight:number;exact:boolean;nearest:PlateStack;below:PlateStack|null;above:PlateStack|null};

const cents=(value:number)=>Math.round(value*100);
const kg=(value:number)=>Number((value/100).toFixed(2));

/** Finds the closest symmetric loading with the fewest plates on each side. */
export function calculatePlates(targetWeight:number,barWeight:number,availablePlates:number[]):PlateCalculation|null{
 if(!Number.isFinite(targetWeight)||!Number.isFinite(barWeight)||targetWeight<0||barWeight<0)return null;
 const plates=[...new Set(availablePlates.filter(value=>Number.isFinite(value)&&value>0).map(cents))].sort((a,b)=>b-a);
 const delta=cents(targetWeight)-cents(barWeight);
 const targetSide=Math.max(0,Math.ceil(delta/2));
 const maxPlate=plates[0]??0;
 const limit=Math.min(50000,Math.max(0,targetSide+maxPlate));
 let bestCount=new Int16Array(limit+1);bestCount.fill(32767);bestCount[0]=0;
 const choices:Uint8Array[]=[];
 for(const plate of plates){
  const next=bestCount.slice();
  const chosen=new Uint8Array(limit+1);
  for(let load=0;load<=limit;load++){
   if(bestCount[load]===32767)continue;
   for(let count=1;count<=10;count++){
    const total=load+plate*count;if(total>limit)break;
    const candidate=bestCount[load]+count;
    if(candidate<next[total]){next[total]=candidate;chosen[total]=count;}
   }
  }
  bestCount=next;choices.push(chosen);
 }
 const stacks:PlateStack[]=[];
 for(let load=0;load<=limit;load++)if(bestCount[load]!==32767){
  let rest=load;const selected:number[]=[];
  for(let index=plates.length-1;index>=0;index--){
   const count=choices[index][rest];
   for(let i=0;i<count;i++)selected.push(kg(plates[index]));
   rest-=plates[index]*count;
  }
  stacks.push({weight:kg(cents(barWeight)+2*load),platesPerSide:selected.sort((a,b)=>b-a)});
 }
 const exact=stacks.find(stack=>cents(stack.weight)===cents(targetWeight));
 const below=stacks.filter(stack=>stack.weight<targetWeight).sort((a,b)=>b.weight-a.weight||a.platesPerSide.length-b.platesPerSide.length)[0]??null;
 const above=stacks.filter(stack=>stack.weight>targetWeight).sort((a,b)=>a.weight-b.weight||a.platesPerSide.length-b.platesPerSide.length)[0]??null;
 const nearest=exact??[below,above].filter((item):item is PlateStack=>Boolean(item)).sort((a,b)=>Math.abs(a.weight-targetWeight)-Math.abs(b.weight-targetWeight)||a.platesPerSide.length-b.platesPerSide.length||a.weight-b.weight)[0];
 if(!nearest)return null;
 return {targetWeight,barWeight,exact:Boolean(exact),nearest,below,above};
}

export function isBarbellExercise(name:string,equipment?:string,explicit?:boolean):boolean{
 if(explicit!==undefined)return explicit;
 if(equipment){
  const normalized=equipment.toLocaleLowerCase("pl-PL");
  if(/hantel|dumbbell|maszyn|machine|wyciąg|cable|body|masa ciała/.test(normalized))return false;
  if(/sztang|barbell|gryf/.test(normalized))return true;
 }
 return /sztang|barbell|ze sztang|gryfem/i.test(name);
}

export function roundToIncrement(weight:number,increment:number):number{
 const step=Number.isFinite(increment)&&increment>0?increment:2.5;
 return Number((Math.round(weight/step)*step).toFixed(2));
}

/** A small deterministic ramp; generated sets are explicitly typed as warm-ups. */
export function generateWarmupSets(targetWeight:number,barWeight:number,increment:number,idFactory:()=>string):SetLog[]{
 if(!Number.isFinite(targetWeight)||targetWeight<=0||!Number.isFinite(barWeight)||barWeight<=0||targetWeight<=barWeight)return [];
 const ratio=targetWeight/barWeight;
 const ramp=ratio>=3?[[barWeight,10],[targetWeight*.45,6],[targetWeight*.67,4],[targetWeight*.83,2]] as const
  :ratio>=1.75?[[barWeight,8],[targetWeight*.62,5],[targetWeight*.82,2]] as const
  :[[barWeight,6],[targetWeight*.84,3]] as const;
 const seen=new Set<number>();const values:number[]=[];
 for(const [candidate] of ramp){
  const weight=roundToIncrement(candidate,increment);
  if(weight<targetWeight&&weight>0&&!seen.has(weight)){values.push(weight);seen.add(weight)}
 }
 return values.map((weight,index)=>({id:idFactory(),setNo:index+1,weight,reps:ramp.find(([candidate])=>roundToIncrement(candidate,increment)===weight)?.[1]??3,rir:null,completedAt:null,type:"warmup",warmupGenerated:true}));
}
