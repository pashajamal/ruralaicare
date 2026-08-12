# Care Pathway AI

Build a web app called "AI Virtual Clinic" — a tool that helps a rural health worker record patient information, get an AI-assisted risk-triage assessment, and route it to a doctor for review before anything is finalized. This is a text-only MVP (no voice input for now).

## Style

Clean, minimal, professional medical/healthcare UI — calm and trustworthy, not a flashy AI-chatbot look. Off-white/light gray background, deep teal or medical blue as the primary accent, rounded cards with soft shadows, generous whitespace, clear readable typography. Should feel like a modern hospital EHR (think Practo, Ada Health) rather than a generic SaaS landing page.

## Pages / navigation

Left sidebar with: New Patient Intake, Patient Queue, Patient History, Settings. Top header shows a small "AI Suggestion vs Doctor Decision" trust badge to reinforce the safety framing throughout.

## Page 1 — New Patient Intake

A form where the health worker enters, all as text:

- Patient name, Age

- Preferred language dropdown (English, Hindi, Bangla, Arabic)

- Symptoms description (large text area)

- Duration of symptoms

- Basic medical history (text area)

- Vitals: Temperature (°C), Blood Pressure, Pulse rate, SpO2 (%) — four side-by-side numeric fields

- Optional image upload (dashed drop zone) labeled "Upload wound photo or prescription"

- A prominent "Submit for AI Assessment" button

On submit, save the record to the database and trigger the triage pipeline (see below), then navigate to the Review screen for that patient.

## Page 2 — AI Review Screen (core feature — the safety split must be visually obvious)

At the top: a large horizontal risk-tier banner, color-coded (red / amber / green) with bold text like "RISK TIER: YELLOW — Remote Doctor Consult Recommended" and a short explanation.

Below it: an "Explainability" strip — small chip/tag elements listing exactly which rule(s) triggered the tier (e.g., "SpO2 90% — below safe threshold", "Fever 39.2°C for 3+ days").

Then two side-by-side panels:

- LEFT, amber background, header "AI SUGGESTION — Pending Doctor Review" (small sparkle/robot icon): structured patient summary, a cautiously-worded preliminary assessment (never phrase as a definitive diagnosis — use "consistent with" / "may indicate"), a numbered first-aid protocol list (only shown for GREEN tier), and a drug-safety note (only shown for GREEN tier, skip entirely for RED).

- RIGHT, green background, header "DOCTOR DECISION" (stethoscope icon): radio options (Approve / Modify / Override), a notes text area, and a "Finalize Decision" button. Nothing is marked finalized in the database until this is submitted.

- If risk tier is RED: hide the first-aid and drug-safety sections entirely, and instead show only a clear referral message: "Refer to hospital / nearest doctor immediately" with the triggering reason(s).

## Page 3 — Patient History

A searchable table of past visits: Patient Name, Age, Date, Risk Tier (colored pill), Status (Pending Review / Finalized), and a "View" button per row. Filter chips at the top for All / Red / Yellow / Green.

## Backend logic (implement as Supabase Edge Functions)

Create an edge function `triage` that runs this pipeline when a new intake is submitted:

1. **Structuring step**: Call the Gemini API (gemini-2.5-flash) with the raw form text to extract structured JSON: { symptoms: [], duration, age, vitals: {temp, bp, pulse, spo2}, history, detected_language }. Also generate a short confirmation response in the same language the health worker typed in (handle multilingual natively in this one call — no separate translation API).

2. **Reasoning step**: Call Gemini again with the structured JSON plus a few hardcoded few-shot examples (symptom pattern → likely condition category) to produce a preliminary assessment, phrased cautiously, never as a diagnosis. This step must NOT decide the risk tier.

3. **Risk-scoring step**: Pure deterministic code, NOT an LLM call. Hardcoded rules, e.g.:

   - SpO2 < 92 → RED

   - Temp > 39.5 AND age > 60 → RED

   - Symptom text contains "chest pain" or "difficulty breathing" → RED

   - Symptoms persisting > 3 days OR moderate severity → YELLOW

   - Otherwise → GREEN

   Return the tier plus exactly which rule(s) fired.

4. **Protocol step** (GREEN only): Look up a matching first-aid protocol from a small fixed set of protocol records stored in the database (seed 5-6 rows: minor wound cleaning, mild fever management, minor burns, dehydration, minor cuts/bandaging). Return the protocol text as-is — never let the LLM generate first-aid steps freely.

5. **Drug-safety step** (GREEN only, and only if the protocol suggests an OTC medicine): Call the OpenFDA API (https://api.fda.gov/drug/label.json?search=openfda.brand_name:"MEDICINE_NAME") to fetch contraindications/age warnings, and include this in the output. Skip entirely for RED.

6. **Hard-stop rule**: If tier is RED, skip steps 4 and 5 completely — output only the risk tier, triggering reason(s), and referral message.

Store the final assessment JSON on the patient record, with a `status` field defaulting to "pending_review" until the doctor finalizes it on the Review screen.

## Image handling

If an image was uploaded, send it to Gemini's multimodal vision call with a prompt asking for either an observational wound description (location, appearance — not a diagnosis) or extracted text if it looks like a prescription/document. Store the result as an extra field on the patient record before running the triage pipeline.

## Data model (Supabase tables)

- `patients`: id, name, age, preferred_language, created_at

- `visits`: id, patient_id, symptoms_text, duration, history_text, vitals (jsonb), image_url, structured_summary (jsonb), preliminary_assessment (text), risk_tier (text), triggering_rules (jsonb), protocol_text (text, nullable), drug_safety_info (jsonb, nullable), status (text: pending_review/finalized), doctor_decision (text, nullable), doctor_notes (text, nullable), created_at

- `first_aid_protocols`: id, condition_name, protocol_text

Store the GEMINI_API_KEY as a Supabase secret, called only from the edge function — never expose it client-side.

Start by scaffolding the three pages and the database schema, then wire up the intake form to actually call the triage edge function.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ruralaicare.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/11ff989a-bcb2-4f32-8a40-0850e67843d5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
