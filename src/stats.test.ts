import { describe,expect,it } from "vitest";
import { e1rm } from "./stats";
describe("e1rm",()=>{it("uses Epley formula",()=>expect(e1rm(90,1)).toBeCloseTo(93,5));});
