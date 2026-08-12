import { describe, it, expect } from "vitest";
import { scoreRisk } from "@/lib/triage.server";
const base = (o:any)=>({symptoms:o.s,duration:o.d,age:o.age??30,vitals:o.v,history:"",detected_language:"en"} as any);
describe("risk", ()=>{
 it("cold 7d normal vitals => GREEN", ()=>{
  const r = scoreRisk(base({s:["cough","cold"],d:"7 days",v:{temp:37,bp:"120/80",pulse:80,spo2:98}}), "cough and cold");
  console.log(JSON.stringify(r,null,2)); expect(r.tier).toBe("GREEN");
 });
 it("fever 5d => YELLOW", ()=>{
  const r = scoreRisk(base({s:["fever"],d:"5 days",v:{temp:38.2,bp:"120/80",pulse:88,spo2:97}}), "fever since 5 days");
  console.log(JSON.stringify(r,null,2)); expect(r.tier).toBe("YELLOW");
 });
 it("RED intact", ()=>{
  expect(scoreRisk(base({s:["cough"],d:"1 day",v:{temp:37,bp:"120/80",pulse:80,spo2:90}}),"cough").tier).toBe("RED");
  expect(scoreRisk(base({s:["chest pain"],d:"1 day",v:{temp:37,bp:"120/80",pulse:80,spo2:98}}),"chest pain").tier).toBe("RED");
  expect(scoreRisk(base({s:["fever"],d:"1 day",age:70,v:{temp:39.8,bp:"120/80",pulse:80,spo2:98}}),"fever").tier).toBe("RED");
 });
 it("worsening 7d => YELLOW", ()=>{
  const r = scoreRisk(base({s:["cough"],d:"7 days",v:{temp:37,bp:"120/80",pulse:80,spo2:98}}), "cough getting worse");
  console.log(JSON.stringify(r,null,2)); expect(r.tier).toBe("YELLOW");
 });
});
