export const MAX_REVIEW_WORDS=50;
export const MAX_REVIEW_SENTENCES=4;
export const MAX_WORKOUT_PHOTO_INPUT_BYTES=25*1024*1024;

export type ValidationResult<T>={ok:true;value:T}|{ok:false;error:string};

export function validateWorkoutRating(value:unknown):ValidationResult<number|null>{
 if(value===null||value===undefined||value===0)return {ok:true,value:null};
 if(typeof value!=="number"||!Number.isInteger(value)||value<1||value>5){
  return {ok:false,error:"Ocena musi być liczbą całkowitą od 1 do 5."};
 }
 return {ok:true,value};
}

export function countReviewWords(text:string):number{
 const trimmed=text.trim();
 return trimmed?trimmed.split(/\s+/u).length:0;
}

export function countReviewSentences(text:string):number{
 const trimmed=text.trim();
 if(!trimmed)return 0;
 return (trimmed.match(/[.!?]+[”’"'»)}\]]*(?=\s|$)/gu)??[]).length;
}

export type WorkoutReviewValidation={
 value:string|null;
 wordCount:number;
 sentenceCount:number;
 error:string|null;
};

export function validateWorkoutReview(text:string):WorkoutReviewValidation{
 const value=text.trim();
 const wordCount=countReviewWords(value);
 const sentenceCount=countReviewSentences(value);
 if(wordCount>MAX_REVIEW_WORDS){
  return {value:null,wordCount,sentenceCount,error:`Notatka może mieć maksymalnie ${MAX_REVIEW_WORDS} słów.`};
 }
 if(sentenceCount>MAX_REVIEW_SENTENCES){
  return {value:null,wordCount,sentenceCount,error:`Notatka może mieć maksymalnie ${MAX_REVIEW_SENTENCES} zdania.`};
 }
 return {value:value||null,wordCount,sentenceCount,error:null};
}

export type WorkoutPhotoInput=Pick<Blob,"size"|"type"|"arrayBuffer">;
export type WorkoutPhotoSourceMime="image/jpeg"|"image/png"|"image/webp"|"image/heic"|"image/heif";

function bytesStartWith(bytes:Uint8Array,signature:number[]):boolean{
 return signature.every((value,index)=>bytes[index]===value);
}

export async function validateWorkoutPhotoInput(file:WorkoutPhotoInput):Promise<ValidationResult<WorkoutPhotoSourceMime>>{
 if(file.size<=0)return {ok:false,error:"Wybrany plik jest pusty."};
 if(file.size>MAX_WORKOUT_PHOTO_INPUT_BYTES)return {ok:false,error:"Zdjęcie może mieć maksymalnie 25 MB."};
 const mime=file.type.toLowerCase() as WorkoutPhotoSourceMime;
 const allowed=new Set<WorkoutPhotoSourceMime>(["image/jpeg","image/png","image/webp","image/heic","image/heif"]);
 if(!allowed.has(mime))return {ok:false,error:"Wybierz zdjęcie w formacie JPEG, PNG, WebP lub HEIC."};
 const bytes=new Uint8Array(await file.arrayBuffer()).subarray(0,16);
 const jpeg=bytesStartWith(bytes,[0xff,0xd8,0xff]);
 const png=bytesStartWith(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
 const webp=bytesStartWith(bytes,[0x52,0x49,0x46,0x46])&&String.fromCharCode(...bytes.subarray(8,12))==="WEBP";
 const heifContainer=String.fromCharCode(...bytes.subarray(4,8))==="ftyp";
 const heifBrand=String.fromCharCode(...bytes.subarray(8,12));
 const heif=["heic","heix","hevc","hevx","mif1","msf1"].includes(heifBrand);
 const matches=mime==="image/jpeg"?jpeg:mime==="image/png"?png:mime==="image/webp"?webp:(heifContainer&&heif);
 if(!matches)return {ok:false,error:"Zawartość pliku nie odpowiada deklarowanemu formatowi zdjęcia."};
 return {ok:true,value:mime};
}

export function scaledPhotoDimensions(width:number,height:number,maxSide=1600):{width:number;height:number}{
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Number.isFinite(maxSide)||maxSide<=0){
  throw new Error("Nieprawidłowe wymiary zdjęcia.");
 }
 const scale=Math.min(1,maxSide/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

export function workoutPhotoQueueId(userId:string,workoutId:string):string{
 return `${userId}:${workoutId}`;
}

export function isWorkoutPhotoPathOwnedBy(path:string,userId:string,workoutId:string):boolean{
 const parts=path.split("/");
 if(parts.length!==3||parts[0]!==userId||parts[1]!==workoutId)return false;
 return /^photo-[\w-]+\.(?:webp|jpe?g)$/i.test(parts[2]);
}
