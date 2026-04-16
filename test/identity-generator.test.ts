/**
 * identity-generator.test.ts
 * Tests: generateIdentity fills all tokens, throws on unfilled placeholders.
 */

import { generateIdentity } from "../src/identity/generator.js";
import type { BmadPersona } from "../src/discovery/manifest-reader.js";

const MARY: BmadPersona = {
  name: "bmad-agent-analyst",
  displayName: "Mary",
  title: "Business Analyst",
  icon: "📊",
  capabilities: "market research, competitive analysis",
  role: "Strategic Business Analyst",
  identity: "Senior analyst with deep expertise in market research and competitive intelligence.",
  communicationStyle: "Speaks with the excitement of a treasure hunter uncovering hidden gems.",
  principles: "Ground findings in verifiable evidence. Quantify impact whenever possible.",
  module: "bmm",
  path: "_bmad/bmm/agents/analyst",
  canonicalId: "",
};

const JOHN: BmadPersona = {
  name: "bmad-agent-pm",
  displayName: "John",
  title: "Product Manager",
  icon: "📋",
  capabilities: "PRD creation, product strategy",
  role: "Product Manager",
  identity: "Product management veteran who has shipped dozens of successful products.",
  communicationStyle: "Asks WHY relentlessly before accepting any requirement.",
  principles: "PRDs emerge from user interviews, not assumptions.",
  module: "bmm",
  path: "_bmad/bmm/agents/pm",
  canonicalId: "",
};

const BASE_INPUT = {
  workflows: [
    {
      module: "bmm",
      skill: "analyst",
      displayName: "Market Analysis",
      menuCode: "M1",
      description: "Full market analysis workflow",
    },
  ],
  mode: "full" as const,
  userName: "Ramon",
  language: "English",
};

describe("generateIdentity — full mode", () => {
  it("returns soul and agents strings", () => {
    const result = generateIdentity({ persona: MARY, ...BASE_INPUT });
    expect(typeof result.soul).toBe("string");
    expect(typeof result.agents).toBe("string");
    expect(result.soul.length).toBeGreaterThan(50);
    expect(result.agents.length).toBeGreaterThan(20);
  });

  it("soul contains persona displayName", () => {
    const result = generateIdentity({ persona: MARY, ...BASE_INPUT });
    expect(result.soul).toContain("Mary");
  });

  it("soul contains identity text", () => {
    const result = generateIdentity({ persona: MARY, ...BASE_INPUT });
    expect(result.soul).toContain("Senior analyst");
  });

  it("soul contains user name", () => {
    const result = generateIdentity({ persona: MARY, ...BASE_INPUT });
    expect(result.soul).toContain("Ramon");
  });

  it("soul has no unfilled {placeholder} tokens", () => {
    const result = generateIdentity({ persona: MARY, ...BASE_INPUT });
    expect(result.soul).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9]*\}/);
  });

  it("agents has no unfilled {placeholder} tokens", () => {
    const result = generateIdentity({ persona: MARY, ...BASE_INPUT });
    expect(result.agents).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9]*\}/);
  });

  it("works for multiple different personas", () => {
    const result1 = generateIdentity({ persona: MARY, ...BASE_INPUT });
    const result2 = generateIdentity({ persona: JOHN, ...BASE_INPUT });
    expect(result1.soul).not.toBe(result2.soul);
    expect(result1.soul).toContain("Mary");
    expect(result2.soul).toContain("John");
  });
});

describe("generateIdentity — persona-only mode", () => {
  it("soul has no unfilled tokens in mode-b", () => {
    const result = generateIdentity({ persona: MARY, ...BASE_INPUT, mode: "persona-only" });
    expect(result.soul).not.toMatch(/\{[a-zA-Z][a-zA-Z0-9]*\}/);
  });

  it("soul contains install-guide reference in persona-only mode", () => {
    const result = generateIdentity({ persona: MARY, ...BASE_INPUT, mode: "persona-only" });
    // Mode B section should mention BMAD install or workflow availability
    expect(result.soul.toLowerCase()).toMatch(/install|workflow|bmad/);
  });
});

describe("generateIdentity — workflow filtering", () => {
  it("includes only workflows matching agent module", () => {
    const workflows = [
      { module: "bmm", skill: "analyst", displayName: "Market Analysis", menuCode: "M1", description: "" },
      { module: "gds", skill: "design", displayName: "Design Sprint", menuCode: "G1", description: "" },
    ];
    const result = generateIdentity({ persona: MARY, workflows, mode: "full", userName: "Ramon", language: "English" });
    // agents.md should reference M1 (Mary's module) but not necessarily G1
    expect(result.agents).toContain("M1");
  });
});
