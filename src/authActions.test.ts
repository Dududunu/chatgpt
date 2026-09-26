import { describe,expect,it,vi } from "vitest";
import { changePassword,deleteAccountFlow,loginWithPassword,requestPasswordReset,signupWithDisplayName,updatePassword } from "./authActions";

describe("auth account actions",()=>{
 it("requires and stores the trimmed signup name as profile metadata",async()=>{
  const signUp=vi.fn(async()=>({data:{session:null},error:null}));
  await expect(signupWithDisplayName(" ","a@b.test","12345678","https://gym.test",signUp)).rejects.toThrow("Wpisz imię");
  expect(signUp).not.toHaveBeenCalled();
  await signupWithDisplayName("  Dominik "," a@b.test ","12345678","https://gym.test",signUp);
  expect(signUp).toHaveBeenCalledWith({email:"a@b.test",password:"12345678",options:{emailRedirectTo:"https://gym.test",data:{display_name:"Dominik"}}});
 });
 it("passes email/password through the login action",async()=>{
  const signIn=vi.fn(async()=>({data:{},error:null}));
  await loginWithPassword(" user@x.test ","pass",signIn);
  expect(signIn).toHaveBeenCalledWith({email:"user@x.test",password:"pass"});
 });
 it("requests password reset using the configured app redirect",async()=>{
  const request=vi.fn(async()=>({error:null}));
  await requestPasswordReset(" user@x.test ","https://gym.test",request);
  expect(request).toHaveBeenCalledWith("user@x.test",{redirectTo:"https://gym.test"});
 });
 it("validates and updates a recovery password",async()=>{
  const update=vi.fn(async()=>({error:null}));
  await expect(updatePassword("short",update)).rejects.toThrow("8 znaków");
  await updatePassword("long-enough",update);
  expect(update).toHaveBeenCalledWith({password:"long-enough"});
 });
 it("reauthenticates before changing an account password",async()=>{
  const order:string[]=[],signIn=vi.fn(async()=>{order.push("reauth");return {data:{},error:null}}),update=vi.fn(async()=>{order.push("update");return {error:null}});
  await changePassword("a@b.test","old","new-password",signIn,update);
  expect(order).toEqual(["reauth","update"]);
 });
 it("deletes remote data before clearing local state and signing out",async()=>{
  const order:string[]=[],remote=vi.fn(async()=>{order.push("remote")}),local=vi.fn(async()=>{order.push("local")}),signOut=vi.fn(async()=>{order.push("signout")});
  await expect(deleteAccountFlow("nie",remote,local,signOut)).rejects.toThrow("USUŃ");
  expect(order).toEqual([]);
  await deleteAccountFlow("USUŃ",remote,local,signOut);
  expect(order).toEqual(["remote","local","signout"]);
 });
 it("does not clear local data if account deletion fails",async()=>{
  const local=vi.fn(async()=>{}),signOut=vi.fn(async()=>{});
  await expect(deleteAccountFlow("USUŃ",async()=>{throw new Error("network")},local,signOut)).rejects.toThrow("network");
  expect(local).not.toHaveBeenCalled();expect(signOut).not.toHaveBeenCalled();
 });
});
