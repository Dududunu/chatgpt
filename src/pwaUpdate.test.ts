import { describe,expect,it } from "vitest";
import { canActivateUpdate,getUpdateNotice,shouldReloadAfterControllerChange } from "./pwaUpdate";

describe("safe PWA updates",()=>{
 it("defers the reload action while a workout is active",()=>{
  expect(getUpdateNotice(true)).toEqual({message:"Nowa wersja będzie gotowa po treningu.",canReload:false});
  expect(canActivateUpdate(true)).toBe(false);
 });

 it("offers a user controlled reload when no workout is active",()=>{
  expect(getUpdateNotice(false)).toEqual({message:"Dostępna jest nowa wersja.",canReload:true});
  expect(canActivateUpdate(false)).toBe(true);
 });

 it("reloads after controller change only after the user requested activation",()=>{
  expect(shouldReloadAfterControllerChange(false)).toBe(false);
  expect(shouldReloadAfterControllerChange(true)).toBe(true);
 });
});
