import type { Confidence, WaitingDetection } from "./types";

const BLOCKING_PATTERNS = [
  /\bbefore (?:i|we) can (?:continue|proceed)\b/i,
  /\bi need (?:you to|the|your)\b/i,
  /\b(?:please|kindly) (?:upload|attach|paste|provide|share|confirm|choose|select|send|enter)\b/i,
  /\bconfirm (?:that|whether|if)\b/i
];
const APPROVAL_PATTERNS = [
  /\bdo you (?:approve|authorize|consent)\b/i,
  /\bshould i (?:proceed|continue|apply|delete|remove|run)\b/i,
  /\bmay i (?:proceed|continue|apply|delete|remove|run)\b/i
];
const INPUT_PATTERNS = [
  /\bcan you (?:provide|share|paste|upload|attach|confirm|tell me)\b/i,
  /\bwhich (?:option|approach|file|environment|version|path)\b.*\b(?:prefer|choose|use|want)\b/i,
  /\bwould you like me to continue with\b/i,
  /\bwhat (?:is|are) (?:the|your) (?:repository|repo|file|project|path|value|preference)\b/i
];
const OPTIONAL_OFFERS = [
  /\bif you(?:'d| would) like,? i can\b/i,
  /\blet me know if you(?:'d| would) like\b/i,
  /\bwould you like (?:a|an|some|more) (?:example|examples|details|summary)\b/i
];
const RHETORICAL = [
  /^(?:why|what|how) (?:is|are|does|do|can) .+\?$/i,
  /\bthe question is\b/i,
  /\bwhat does this mean\?\s*(?:it|this)\b/i
];

function stripExcludedText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*\?[^`\n]*`/g, "")
    .split(/\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !/^(>|["“])/.test(trimmed) &&
        !/^#{1,6}\s/.test(trimmed) &&
        !/^\[[^\]]+\]:/.test(trimmed)
      );
    })
    .join("\n");
}

export function detectWaitingForUser(text: string, hasRenderedChoices = false): WaitingDetection {
  const cleaned = stripExcludedText(text);
  const paragraphs = cleaned.split(/\n\s*\n/).filter(Boolean);
  const terminal = paragraphs.slice(-2).join("\n").trim();
  const reasons: string[] = [];
  let score = 0;

  if (!terminal) return { waiting: false, confidence: "low", reasons: [] };
  if (OPTIONAL_OFFERS.some((pattern) => pattern.test(terminal))) {
    return { waiting: false, confidence: "low", reasons: ["generic optional offer"] };
  }
  if (RHETORICAL.some((pattern) => pattern.test(terminal))) {
    return { waiting: false, confidence: "low", reasons: ["rhetorical or explanatory question"] };
  }
  if (BLOCKING_PATTERNS.some((pattern) => pattern.test(terminal))) {
    score += 3;
    reasons.push("explicit blocking or input request");
  }
  if (APPROVAL_PATTERNS.some((pattern) => pattern.test(terminal))) {
    score += 3;
    reasons.push("approval or confirmation requested");
  }
  if (INPUT_PATTERNS.some((pattern) => pattern.test(terminal))) {
    score += 2;
    reasons.push("direct user input requested");
  }
  if (/\byou\b/i.test(terminal) && /[?]\s*$/.test(terminal)) {
    score += 1;
    reasons.push("terminal second-person question");
  }
  if (hasRenderedChoices) {
    score += 2;
    reasons.push("rendered choices detected");
  }

  const confidence: Confidence = score >= 4 ? "high" : score >= 2 ? "medium" : "low";
  return { waiting: score >= 2, confidence, reasons };
}
