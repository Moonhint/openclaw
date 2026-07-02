import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import {
  resolveEffectiveAgentSkillFilter,
  resolveEffectiveAgentSkillRules,
} from "./agent-filter.js";

describe("resolveEffectiveAgentSkillRules", () => {
  it("merges global, provider, and model-scoped defaults for the active model", () => {
    const cfg = {
      agents: {
        defaults: {
          skills: ["global-a"],
          skillsByProvider: {
            ollama: ["provider-a", "global-a"],
          },
          skillsByModel: {
            "ollama/qwen3.5:4b-32k": ["model-a", "provider-a"],
          },
        },
      },
    } as OpenClawConfig;

    expect(
      resolveEffectiveAgentSkillRules(cfg, "main", {
        provider: "ollama",
        model: "qwen3.5:4b-32k",
      }),
    ).toEqual({
      global: ["global-a"],
      provider: ["provider-a", "global-a"],
      providerKey: "ollama",
      model: ["model-a", "provider-a"],
      modelKey: "ollama/qwen3.5:4b-32k",
      effective: ["global-a", "provider-a", "model-a"],
    });
  });

  it("excludes provider and model-scoped skills for other models", () => {
    const cfg = {
      agents: {
        defaults: {
          skills: ["global-a"],
          skillsByProvider: {
            ollama: ["provider-a"],
          },
          skillsByModel: {
            "ollama/qwen3.5:4b-32k": ["model-a"],
          },
        },
      },
    } as OpenClawConfig;

    expect(
      resolveEffectiveAgentSkillFilter(cfg, "main", {
        provider: "openai",
        model: "gpt-5.5",
      }),
    ).toEqual(["global-a"]);
  });

  it("keeps explicit per-agent skills as a replacement for default rules", () => {
    const cfg = {
      agents: {
        defaults: {
          skills: ["global-a"],
          skillsByProvider: {
            ollama: ["provider-a"],
          },
        },
        list: [{ id: "main", skills: ["agent-a"] }],
      },
    } as OpenClawConfig;

    expect(
      resolveEffectiveAgentSkillRules(cfg, "main", {
        provider: "ollama",
        model: "qwen3.5:4b-32k",
      })?.effective,
    ).toEqual(["agent-a"]);
  });
});
