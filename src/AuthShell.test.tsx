import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it,vi } from "vitest";
import { AuthScreen } from "./AuthShell";
import { authErrorMessage,signOutWithSync,syncStatusMessage } from "./authMessages";

describe("account experience",()=>{
 it("renders a clear login form",()=>{
  const html=renderToStaticMarkup(createElement(AuthScreen));
  expect(html).toContain("Twój trening. Twój progres.");
  expect(html).toContain("Zaloguj się");
  expect(html).toContain('type="email"');
  expect(html).toContain('autoComplete="current-password"');
 });

 it("renders the signup form without exposing account implementation details",()=>{
  const html=renderToStaticMarkup(createElement(AuthScreen,{initialMode:"signup"}));
  expect(html).toContain("Utwórz konto");
  expect(html).toContain("Zapisz plan, historię i progres");
  expect(html).not.toContain("Supabase");
 });

 it("turns provider login errors into a simple message",()=>{
  expect(authErrorMessage(new Error("Invalid login credentials"))).toBe("Nieprawidłowy email lub hasło.");
  expect(authErrorMessage(new Error("Email not confirmed"))).toBe("Potwierdź adres email i spróbuj ponownie.");
  expect(authErrorMessage(new Error("fetch failed"))).toContain("Brak połączenia");
 });

 it("shows human sync labels for each account state",()=>{
  expect(syncStatusMessage("synced")).toBe("Zsynchronizowano");
  expect(syncStatusMessage("syncing")).toBe("Synchronizacja…");
  expect(syncStatusMessage("offline")).toContain("zmiany zapiszą się po odzyskaniu internetu");
  expect(syncStatusMessage("error")).toContain("Spróbuj ponownie");
 });

 it("syncs before sign-out when online and keeps sign-out available offline",async()=>{
  const sync=vi.fn(async()=>undefined),signOut=vi.fn(async()=>undefined);
  await signOutWithSync(true,sync,signOut);
  expect(sync).toHaveBeenCalledOnce();expect(signOut).toHaveBeenCalledOnce();
  sync.mockClear();signOut.mockClear();
  await signOutWithSync(false,sync,signOut);
  expect(sync).not.toHaveBeenCalled();expect(signOut).toHaveBeenCalledOnce();
 });

 it("still signs out when the optional online sync fails",async()=>{
  const signOut=vi.fn(async()=>undefined);
  await signOutWithSync(true,async()=>{throw new Error("offline during sync")},signOut);
  expect(signOut).toHaveBeenCalledOnce();
 });
});
