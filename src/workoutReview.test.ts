import { describe,expect,it } from "vitest";
import {
 MAX_REVIEW_SENTENCES,
 MAX_REVIEW_WORDS,
 MAX_WORKOUT_PHOTO_INPUT_BYTES,
 countReviewSentences,
 countReviewWords,
 isWorkoutPhotoPathOwnedBy,
 scaledPhotoDimensions,
 validateWorkoutPhotoInput,
 validateWorkoutRating,
 validateWorkoutReview,
 workoutPhotoQueueId,
} from "./workoutReview";

function imageFile(bytes:number[],type:string,size=bytes.length):Blob{
 const file=new Blob([new Uint8Array(bytes)],{type});
 Object.defineProperty(file,"size",{value:size});
 return file;
}

describe("post-workout rating",()=>{
 it("stores no rating as null and accepts integer values from one through five",()=>{
  expect(validateWorkoutRating(null)).toEqual({ok:true,value:null});
  expect(validateWorkoutRating(0)).toEqual({ok:true,value:null});
  for(const rating of [1,2,3,4,5])expect(validateWorkoutRating(rating)).toEqual({ok:true,value:rating});
 });
 it.each([-1,6,1.5,"4"])("rejects invalid rating %s",rating=>{
  expect(validateWorkoutRating(rating).ok).toBe(false);
 });
});

describe("post-workout review",()=>{
 it("trims whitespace and treats an empty note as null",()=>{
  expect(validateWorkoutReview("  \n ")).toMatchObject({value:null,wordCount:0,sentenceCount:0,error:null});
  expect(validateWorkoutReview("  Dobry trening.  ").value).toBe("Dobry trening.");
  expect(countReviewWords("  Jedno   słowo ")).toBe(2);
 });
 it("accepts exactly fifty words and rejects the fifty-first",()=>{
  const fifty=Array.from({length:MAX_REVIEW_WORDS},(_,index)=>`wyraz${index+1}`).join(" ");
  expect(validateWorkoutReview(fifty).error).toBeNull();
  expect(validateWorkoutReview(`${fifty} jeszcze`).error).toMatch(/50 słów/);
 });
 it("accepts four sentences and rejects a fifth",()=>{
  const four="Pierwsze. Drugie! Trzecie? Czwarte!!!";
  expect(countReviewSentences(four)).toBe(MAX_REVIEW_SENTENCES);
  expect(validateWorkoutReview(four).error).toBeNull();
  expect(validateWorkoutReview(`${four} Piąte.`).error).toMatch(/4 zdania/);
 });
 it("counts repeated and mixed punctuation as one sentence ending",()=>{
  expect(countReviewSentences("Mocny trening!!! Dobra forma?! Koniec…" )).toBe(2);
  expect(countReviewSentences("Dobrze! ”Następna seria.”")).toBe(2);
 });
});

describe("workout photo validation",()=>{
 it.each([
  ["image/jpeg",[0xff,0xd8,0xff,0x00]],
  ["image/png",[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]],
  ["image/webp",[0x52,0x49,0x46,0x46,0x00,0x00,0x00,0x00,0x57,0x45,0x42,0x50]],
  ["image/heic",[0x00,0x00,0x00,0x18,0x66,0x74,0x79,0x70,0x68,0x65,0x69,0x63]],
 ])("accepts real %s data",async(type,bytes)=>{
  const result=await validateWorkoutPhotoInput(imageFile(bytes,type));
  expect(result).toEqual({ok:true,value:type});
 });
 it("rejects unsupported MIME types and mismatched file signatures",async()=>{
  expect((await validateWorkoutPhotoInput(imageFile([0,1,2,3],"image/svg+xml"))).ok).toBe(false);
  expect((await validateWorkoutPhotoInput(imageFile([0xff,0xd8,0xff],"image/png"))).ok).toBe(false);
 });
 it("rejects empty and larger-than-25-MB files before decoding",async()=>{
  expect((await validateWorkoutPhotoInput(imageFile([0],"image/jpeg",0))).ok).toBe(false);
  const tooLarge=imageFile([0xff,0xd8,0xff],"image/jpeg",MAX_WORKOUT_PHOTO_INPUT_BYTES+1);
  expect((await validateWorkoutPhotoInput(tooLarge)).ok).toBe(false);
 });
 it("scales only images with a side above 1600 pixels",()=>{
  expect(scaledPhotoDimensions(4000,2000)).toEqual({width:1600,height:800});
  expect(scaledPhotoDimensions(900,1200)).toEqual({width:900,height:1200});
  expect(()=>scaledPhotoDimensions(Number.NaN,100)).toThrow();
 });
});

describe("private workout photo identity",()=>{
 it("uses one stable queue key per user and workout",()=>{
  expect(workoutPhotoQueueId("user-a","workout-1")).toBe("user-a:workout-1");
 });
 it("accepts only a correctly scoped single photo object path",()=>{
  expect(isWorkoutPhotoPathOwnedBy("user-a/workout-1/photo-123.webp","user-a","workout-1")).toBe(true);
  expect(isWorkoutPhotoPathOwnedBy("user-b/workout-1/photo-123.webp","user-a","workout-1")).toBe(false);
  expect(isWorkoutPhotoPathOwnedBy("user-a/workout-2/photo-123.webp","user-a","workout-1")).toBe(false);
  expect(isWorkoutPhotoPathOwnedBy("user-a/workout-1/photo-123.svg","user-a","workout-1")).toBe(false);
 });
});
