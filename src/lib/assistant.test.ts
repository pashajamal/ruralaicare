import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn().mockImplementation((table) => {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => {
      if (table === "patients") {
        return { data: { name: "John Doe", age: 35, preferred_language: "English" } };
      }
      return { data: null };
    }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(async () => {
      if (table === "visits") {
        return {
          data: [
            {
              created_at: "2026-08-12T12:00:00Z",
              symptoms_text: "mild cough and fever",
              duration: "2 days",
              history_text: "none",
              vitals: { temp: 38.2, pulse: 80, spo2: 97, bp: "120/80" },
              risk_tier: "GREEN",
              triggering_rules: ["No red-flag vitals or symptoms detected"],
              preliminary_assessment: "Consistent with common cold.",
              protocol_text: "Mild fever management: rest and fluids.",
              status: "pending_review",
              doctor_decision: null,
              doctor_notes: null,
              image_analysis: null,
              medicine_suggestion: {
                status: "suggested",
                message: "Suggested (from reference database) — Pending Doctor Approval",
                condition: "Common Cold",
                medicines: [
                  { name: "Paracetamol 500mg", detail: "Take 1 tablet every 6 hours", informational: false }
                ]
              },
              drug_safety_info: {
                medicine: "Paracetamol",
                source: "openFDA drug label API",
                warnings: ["Do not exceed 4000mg per day."]
              }
            }
          ]
        };
      }
      return { data: [] };
    }),
  };
});

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

vi.mock("./gemini.server", () => ({
  geminiFetch: vi.fn().mockImplementation(async () => {
    return {
      status: 200,
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "The patient has a mild cough and fever. The suggested medicine from the reference database is Paracetamol 500mg (Take 1 tablet every 6 hours)."
            }
          }
        ]
      }),
    };
  }),
}));

vi.mock("./claude.server", () => ({
  hasAnthropicKey: vi.fn().mockReturnValue(false),
  claudeChat: vi.fn(),
  CLAUDE_MODEL: "claude-3-5-sonnet-20241022",
  CLAUDE_KEY_ERROR: "Anthropic API key not configured or invalid",
}));

import { answerScopedQuestion } from "./assistant.server";

describe("AI Assistant medicine recommendations", () => {
  it("includes suggested medicines from visits inside system context and provides them in the response", async () => {
    const response = await answerScopedQuestion({
      patientId: "some-patient-id-uuid",
      question: "Are there any medicines suggested for this patient?",
      audience: "health_worker",
      language: "English"
    });

    expect(response).toContain("Paracetamol 500mg");
    expect(response).toContain("This is general guidance, not a medical decision");
  });
});
