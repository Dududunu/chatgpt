import { describe,expect,it } from "vitest";
import { validateDeleteConfirmation,validateDisplayName,validatePasswordChange } from "./accountLogic";

describe("account validation",()=>{
 it("trims and bounds a required display name",()=>{
  expect(validateDisplayName("  Dominik  ")).toBeNull();
  expect(validateDisplayName(" ")).toContain("Wpisz");
  expect(validateDisplayName("D")).toContain("2 do 30");
  expect(validateDisplayName("a".repeat(31))).toContain("2 do 30");
 });
 it("validates current, repeated, and minimum-length passwords",()=>{
  expect(validatePasswordChange("","long-enough","long-enough")).toContain("obecne");
  expect(validatePasswordChange("old","short","short")).toContain("8 znaków");
  expect(validatePasswordChange("old","long-enough","different")).toContain("takie same");
  expect(validatePasswordChange("old","long-enough","long-enough")).toBeNull();
 });
 it("requires an explicit typed deletion confirmation",()=>{
  expect(validateDeleteConfirmation("usun")).toBe(false);expect(validateDeleteConfirmation("USUŃ")).toBe(true);
 });
});
