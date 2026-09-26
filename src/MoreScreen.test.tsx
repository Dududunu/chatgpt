import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it,vi } from "vitest";
import { MoreScreen } from "./MoreScreen";
import type { Settings } from "./types";

const settings:Settings={id:"main",defaultRestSec:120,autoRest:true,sound:false,vibration:false,theme:"dark",showExerciseImages:true};
const common={settings,body:[],accountEmail:"tester@example.invalid",onSyncNow:vi.fn(async()=>{}),onSignOut:vi.fn(async()=>{}),onSaveSettings:vi.fn(async()=>{}),onAddBody:vi.fn(async()=>{}),exportJson:vi.fn(async()=>{}),importJson:vi.fn(async()=>{}),exportCsv:vi.fn(async()=>{}),notify:vi.fn()};

describe("account and settings screen",()=>{
 it("explains offline sync in plain language and keeps sign-out visible",()=>{
  const html=renderToStaticMarkup(createElement(MoreScreen,{...common,syncStatus:"offline"}));
  expect(html).toContain("tester@example.invalid");
  expect(html).toContain("zmiany zapiszą się po odzyskaniu internetu");
  expect(html).toContain("Wyloguj");
  expect(html).not.toContain("IndexedDB");
  expect(html).not.toContain("Supabase");
 });

 it("shows the saved exercise-image preference as a settings control",()=>{
  const html=renderToStaticMarkup(createElement(MoreScreen,{...common,syncStatus:"synced"}));
  expect(html).toContain("Pokaż grafiki ćwiczeń");
  expect(html).toContain("Zsynchronizowano");
 });
});
