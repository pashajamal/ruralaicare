import { it, expect } from "vitest";
import { scoreRisk } from "@/lib/triage.server";
import { suggestMedicines } from "@/lib/medicine-suggestion.server";
it("cold 7d GREEN + medicine", async () => {
  const structured:any = {symptoms:["cough","cold","runny nose"],duration:"7 days",age:30,vitals:{temp:37,bp:"120/80",pulse:80,spo2:98},history:"none",detected_language:"en"};
  const risk = scoreRisk(structured, "cough and cold for 7 days");
  console.log("TIER:", risk.tier);
  console.log("RULES:", risk.rules);
  expect(risk.tier).toBe("GREEN");
  const s = await suggestMedicines({structured, symptomsText:"cough and cold for 7 days", assessment:"Symptoms are consistent with an uncomplicated upper respiratory infection (common cold); vitals are within normal limits.", conditions:{chronic:[],pregnancy:null}});
  console.log("SUGGESTION:", JSON.stringify(s,null,2));
  expect(s.status).toBe("suggested");
}, 60000);
