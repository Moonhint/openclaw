// Agent skill filter helpers select skills that apply to a configured agent.
import type { OpenClawConfig } from "../../config/types.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { normalizeSkillFilter } from "./filter.js";

type AgentSkillsLimits = {
  maxSkillsPromptChars?: number;
};

export type EffectiveAgentSkillRules = {
  global: string[];
  provider: string[];
  model: string[];
  disabledProvider: string[];
  disabledModel: string[];
  disabled: string[];
  providerKey?: string;
  modelKey?: string;
  disabledProviderKey?: string;
  disabledModelKey?: string;
  effective: string[];
};

function resolveAgentEntry(
  cfg: OpenClawConfig | undefined,
  agentId: string | undefined,
): NonNullable<NonNullable<OpenClawConfig["agents"]>["list"]>[number] | undefined {
  if (!cfg) {
    return undefined;
  }
  const normalizedAgentId = normalizeAgentId(agentId);
  return cfg.agents?.list?.find((entry) => normalizeAgentId(entry.id) === normalizedAgentId);
}

function dedupeSkills(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of normalizeSkillFilter(values) ?? []) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function readScopedSkills(
  map: Record<string, string[]> | undefined,
  keys: readonly string[],
): { key?: string; skills: string[] } {
  if (!map) {
    return { skills: [] };
  }
  for (const key of keys) {
    const raw = map[key];
    if (raw) {
      return { key, skills: dedupeSkills(raw) };
    }
  }
  return { skills: [] };
}

function resolveModelSkillKeys(provider: string | undefined, model: string | undefined): string[] {
  const cleanProvider = provider?.trim();
  const cleanModel = model?.trim();
  if (!cleanModel) {
    return [];
  }
  return cleanProvider ? [`${cleanProvider}/${cleanModel}`, cleanModel] : [cleanModel];
}

export function resolveEffectiveAgentSkillRules(
  cfg: OpenClawConfig | undefined,
  agentId: string | undefined,
  modelIdentity?: { provider?: string; model?: string },
): EffectiveAgentSkillRules | undefined {
  if (!cfg) {
    return undefined;
  }
  const agentEntry = resolveAgentEntry(cfg, agentId);
  if (agentEntry && Object.hasOwn(agentEntry, "skills")) {
    const global = dedupeSkills(agentEntry.skills ?? []);
    const disabledProvider = readScopedSkills(
      cfg.agents?.defaults?.disabledSkillsByProvider,
      [modelIdentity?.provider?.trim() ?? ""].filter(Boolean),
    );
    const disabledModel = readScopedSkills(
      cfg.agents?.defaults?.disabledSkillsByModel,
      resolveModelSkillKeys(modelIdentity?.provider, modelIdentity?.model),
    );
    const disabled = dedupeSkills([...disabledProvider.skills, ...disabledModel.skills]);
    const disabledSet = new Set(disabled);
    return {
      global,
      provider: [],
      model: [],
      disabledProvider: disabledProvider.skills,
      disabledModel: disabledModel.skills,
      disabled,
      ...(disabledProvider.key ? { disabledProviderKey: disabledProvider.key } : {}),
      ...(disabledModel.key ? { disabledModelKey: disabledModel.key } : {}),
      effective: global.filter((skill) => !disabledSet.has(skill)),
    };
  }

  const defaults = cfg.agents?.defaults;
  const global = dedupeSkills(defaults?.skills ?? []);
  const provider = readScopedSkills(
    defaults?.skillsByProvider,
    [modelIdentity?.provider?.trim() ?? ""].filter(Boolean),
  );
  const model = readScopedSkills(
    defaults?.skillsByModel,
    resolveModelSkillKeys(modelIdentity?.provider, modelIdentity?.model),
  );
  const disabledProvider = readScopedSkills(
    defaults?.disabledSkillsByProvider,
    [modelIdentity?.provider?.trim() ?? ""].filter(Boolean),
  );
  const disabledModel = readScopedSkills(
    defaults?.disabledSkillsByModel,
    resolveModelSkillKeys(modelIdentity?.provider, modelIdentity?.model),
  );
  const disabled = dedupeSkills([...disabledProvider.skills, ...disabledModel.skills]);
  const disabledSet = new Set(disabled);

  return {
    global,
    provider: provider.skills,
    model: model.skills,
    disabledProvider: disabledProvider.skills,
    disabledModel: disabledModel.skills,
    disabled,
    ...(provider.key ? { providerKey: provider.key } : {}),
    ...(model.key ? { modelKey: model.key } : {}),
    ...(disabledProvider.key ? { disabledProviderKey: disabledProvider.key } : {}),
    ...(disabledModel.key ? { disabledModelKey: disabledModel.key } : {}),
    effective: dedupeSkills([...global, ...provider.skills, ...model.skills]).filter(
      (skill) => !disabledSet.has(skill),
    ),
  };
}

/**
 * Explicit per-agent skills win when present; otherwise fall back to shared defaults.
 * Unknown agent ids also fall back to defaults so legacy/unresolved callers do not widen access.
 */
export function resolveEffectiveAgentSkillFilter(
  cfg: OpenClawConfig | undefined,
  agentId: string | undefined,
  modelIdentity?: { provider?: string; model?: string },
): string[] | undefined {
  return resolveEffectiveAgentSkillRules(cfg, agentId, modelIdentity)?.effective;
}

export function resolveEffectiveAgentSkillsLimits(
  cfg: OpenClawConfig | undefined,
  agentId: string | undefined,
): AgentSkillsLimits | undefined {
  if (!agentId) {
    return undefined;
  }
  const agentEntry = resolveAgentEntry(cfg, agentId);
  if (!agentEntry || !Object.hasOwn(agentEntry, "skillsLimits")) {
    return undefined;
  }
  const { maxSkillsPromptChars } = agentEntry.skillsLimits ?? {};
  return typeof maxSkillsPromptChars === "number" ? { maxSkillsPromptChars } : undefined;
}
