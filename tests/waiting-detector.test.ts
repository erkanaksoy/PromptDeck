import { describe, expect, it } from "vitest";
import { detectWaitingForUser } from "../src/shared/waiting-detector";

describe("waiting-for-user heuristic", () => {
  it.each([
    ["approval", "I have prepared the change.\n\nDo you approve this change?"],
    ["confirmation", "Please confirm whether I should continue."],
    ["file upload", "Before I can continue, please upload the file."],
    ["logs", "Can you provide the error log?"],
    ["option", "Which option do you prefer? A or B?"]
  ])("detects explicit %s requests", (_name, text) => {
    const result = detectWaitingForUser(text);
    expect(result.waiting).toBe(true);
    expect(["medium", "high"]).toContain(result.confidence);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it.each([
    ["rhetorical", "What is dependency injection?"],
    ["quoted question", '> "Should I proceed?"'],
    ["code question", "```ts\nconst answer = value ? one : two;\n```"],
    ["optional offer", "If you'd like, I can provide more examples."],
    ["plain explanation", "The build is complete and all checks pass."]
  ])("does not detect %s", (_name, text) => {
    expect(detectWaitingForUser(text).waiting).toBe(false);
  });
});
