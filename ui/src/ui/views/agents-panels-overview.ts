// Control UI view renders agents panels overview screen content.
import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  ModelCatalogEntry,
} from "../types.ts";
import {
  buildModelOptions,
  formatBytes,
  normalizeModelValue,
  parseFallbackList,
  resolveAgentConfig,
  resolveAgentRuntimeLabel,
  resolveModelFallbacks,
  resolveModelLabel,
  resolveModelPrimary,
} from "./agents-utils.ts";
import type { AgentsPanel } from "./agents.types.ts";

type ModelAgent = NonNullable<AgentsListResult["agents"][number]["modelAgents"]>[number];

function formatContextTokens(tokens: number | undefined): string {
  return typeof tokens === "number" && Number.isFinite(tokens) ? formatBytes(tokens) : "-";
}

function formatModelAgentRole(modelAgent: ModelAgent): string {
  if (modelAgent.role === "fallback" && modelAgent.roleIndex) {
    return `fallback #${modelAgent.roleIndex}`;
  }
  return modelAgent.role;
}

function renderSkillList(skills: string[]) {
  if (skills.length === 0) {
    return html`<span class="muted">(none)</span>`;
  }
  return html`
    <div class="agent-model-skill-chips">
      ${skills.map((skill) => html`<span class="chip">${skill}</span>`)}
    </div>
  `;
}

function renderModelAgentDetails(modelAgent: ModelAgent) {
  const skills = modelAgent.skills;
  const disabledSkills = skills.disabled ?? [];
  return html`
    <div class="agent-model-agent-detail">
      <div class="agents-overview-grid">
        <div class="agent-kv">
          <div class="label">Runtime</div>
          <div class="mono">${resolveAgentRuntimeLabel(modelAgent.agentRuntime)}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Context</div>
          <div class="mono">${formatContextTokens(modelAgent.contextTokens)}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Thinking default</div>
          <div class="mono">${modelAgent.thinkingDefault ?? "-"}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Effective skills</div>
          <div>${skills.effective.length}</div>
        </div>
      </div>

      <div class="agent-model-skill-groups">
        <div class="agent-model-skill-group">
          <div class="label">Global</div>
          ${renderSkillList(skills.global)}
        </div>
        <div class="agent-model-skill-group">
          <div class="label">Provider${skills.providerKey ? ` · ${skills.providerKey}` : ""}</div>
          ${renderSkillList(skills.provider)}
        </div>
        <div class="agent-model-skill-group">
          <div class="label">Model${skills.modelKey ? ` · ${skills.modelKey}` : ""}</div>
          ${renderSkillList(skills.model)}
        </div>
        <div class="agent-model-skill-group">
          <div class="label">
            Disabled${skills.disabledModelKey
              ? ` · ${skills.disabledModelKey}`
              : skills.disabledProviderKey
                ? ` · ${skills.disabledProviderKey}`
                : ""}
          </div>
          ${renderSkillList(disabledSkills)}
        </div>
        <div class="agent-model-skill-group">
          <div class="label">Effective</div>
          ${renderSkillList(skills.effective)}
        </div>
      </div>
    </div>
  `;
}

function renderModelAgents(modelAgents: ModelAgent[]) {
  if (modelAgents.length === 0) {
    return html`
      <div class="muted" style="margin-top: 10px;">
        No configured models are available for this agent.
      </div>
    `;
  }
  return html`
    <div class="agent-model-agents-list">
      ${modelAgents.map(
        (modelAgent, index) => html`
          <details class="agent-model-agent" ?open=${index === 0}>
            <summary>
              <span class="agent-model-agent-main">
                <span class="agent-model-agent-name mono">${modelAgent.label}</span>
                <span class="agent-model-agent-provider">${modelAgent.provider}</span>
              </span>
              <span class="agent-model-agent-meta">
                <span>${formatModelAgentRole(modelAgent)}</span>
                <span>${resolveAgentRuntimeLabel(modelAgent.agentRuntime)}</span>
                <span>${modelAgent.skills.effective.length} skills</span>
              </span>
            </summary>
            ${renderModelAgentDetails(modelAgent)}
          </details>
        `,
      )}
    </div>
  `;
}

export function renderAgentOverview(params: {
  agent: AgentsListResult["agents"][number];
  basePath: string;
  defaultId: string | null;
  configForm: Record<string, unknown> | null;
  agentFilesList: AgentsFilesListResult | null;
  agentIdentity: AgentIdentityResult | null;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  modelCatalog: ModelCatalogEntry[];
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
}) {
  const {
    agent,
    configForm,
    agentFilesList,
    configLoading,
    configSaving,
    configDirty,
    onConfigReload,
    onConfigSave,
    onModelChange,
    onModelFallbacksChange,
    onSelectPanel,
  } = params;
  const isDefault = Boolean(params.defaultId && agent.id === params.defaultId);
  const config = resolveAgentConfig(configForm, agent.id);
  const agentModel = agent.model;
  const workspaceFromFiles =
    agentFilesList && agentFilesList.agentId === agent.id ? agentFilesList.workspace : null;
  const workspace =
    workspaceFromFiles ||
    config.entry?.workspace ||
    config.defaults?.workspace ||
    agent.workspace ||
    "default";
  const model = config.entry?.model
    ? resolveModelLabel(config.entry?.model)
    : config.defaults?.model
      ? resolveModelLabel(config.defaults?.model)
      : resolveModelLabel(agentModel);
  const runtime = resolveAgentRuntimeLabel(agent.agentRuntime);
  const defaultModel = resolveModelLabel(config.defaults?.model ?? agentModel);
  const entryPrimary = resolveModelPrimary(config.entry?.model);
  const defaultPrimary =
    resolveModelPrimary(config.defaults?.model) ||
    (defaultModel !== "-" ? normalizeModelValue(defaultModel) : null) ||
    (configForm ? null : resolveModelPrimary(agentModel));
  const effectivePrimary = entryPrimary ?? defaultPrimary ?? null;
  const selectedPrimary = isDefault ? effectivePrimary : entryPrimary;
  const modelFallbacks =
    resolveModelFallbacks(config.entry?.model) ??
    resolveModelFallbacks(config.defaults?.model) ??
    (configForm ? null : resolveModelFallbacks(agentModel));
  const fallbackChips = modelFallbacks ?? [];
  const skillFilter = Array.isArray(config.entry?.skills) ? config.entry?.skills : null;
  const skillCount = skillFilter?.length ?? null;
  const disabled = !configForm || configLoading || configSaving;
  const thinkingDefault = agent.thinkingDefault ?? "-";
  const modelAgents = agent.modelAgents ?? [];

  const removeChip = (index: number) => {
    const next = fallbackChips.filter((_, i) => i !== index);
    onModelFallbacksChange(agent.id, next);
  };

  const handleChipKeydown = (e: KeyboardEvent) => {
    const input = e.target as HTMLInputElement;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const parsed = parseFallbackList(input.value);
      if (parsed.length > 0) {
        onModelFallbacksChange(agent.id, [...fallbackChips, ...parsed]);
        input.value = "";
      }
    }
  };

  return html`
    <section class="card">
      <div class="card-title">Overview</div>
      <div class="card-sub">Workspace paths and identity metadata.</div>

      <div class="agents-overview-grid" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">Workspace</div>
          <div>
            <button
              type="button"
              class="workspace-link mono"
              @click=${() => onSelectPanel("files")}
              title="Open Files tab"
            >
              ${workspace}
            </button>
          </div>
        </div>
        <div class="agent-kv">
          <div class="label">Primary Model</div>
          <div class="mono">${model}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Runtime</div>
          <div class="mono">${runtime}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.context.thinkingDefault")}</div>
          <div class="mono">${thinkingDefault}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Skills Filter</div>
          <div>${skillFilter ? `${skillCount} selected` : "all skills"}</div>
        </div>
      </div>

      ${configDirty
        ? html`
            <div class="callout warn" style="margin-top: 16px">
              You have unsaved config changes.
            </div>
          `
        : nothing}

      <div class="agent-model-agents" style="margin-top: 20px;">
        <div class="agent-section-heading">
          <div>
            <div class="label">Model agents</div>
            <div class="muted">Configured model access and linked skills for this agent.</div>
          </div>
        </div>
        ${renderModelAgents(modelAgents)}
      </div>

      <div class="agent-model-select" style="margin-top: 20px;">
        <div class="label">Model Selection</div>
        <div class="agent-model-fields">
          <label class="field">
            <span>Primary model${isDefault ? " (default)" : ""}</span>
            <select
              .value=${selectedPrimary ?? ""}
              ?disabled=${disabled}
              @change=${(e: Event) =>
                onModelChange(agent.id, (e.target as HTMLSelectElement).value || null)}
            >
              ${isDefault
                ? html` <option value="" ?selected=${!selectedPrimary}>Not set</option> `
                : html`
                    <option value="" ?selected=${!selectedPrimary}>
                      ${defaultPrimary ? `Inherit default (${defaultPrimary})` : "Inherit default"}
                    </option>
                  `}
              ${buildModelOptions(
                configForm,
                effectivePrimary ?? undefined,
                params.modelCatalog,
                selectedPrimary,
              )}
            </select>
          </label>
          <div class="field">
            <span>Fallbacks</span>
            <div
              class="agent-chip-input"
              @click=${(e: Event) => {
                const container = e.currentTarget as HTMLElement;
                const input = container.querySelector("input");
                if (input) {
                  input.focus();
                }
              }}
            >
              ${fallbackChips.map(
                (chip, i) => html`
                  <span class="chip">
                    ${chip}
                    <button
                      type="button"
                      class="chip-remove"
                      ?disabled=${disabled}
                      @click=${() => removeChip(i)}
                    >
                      &times;
                    </button>
                  </span>
                `,
              )}
              <input
                ?disabled=${disabled}
                placeholder=${fallbackChips.length === 0 ? "provider/model" : ""}
                @keydown=${handleChipKeydown}
                @blur=${(e: Event) => {
                  const input = e.target as HTMLInputElement;
                  const parsed = parseFallbackList(input.value);
                  if (parsed.length > 0) {
                    onModelFallbacksChange(agent.id, [...fallbackChips, ...parsed]);
                    input.value = "";
                  }
                }}
              />
            </div>
          </div>
        </div>
        <div class="agent-model-actions">
          <button
            type="button"
            class="btn btn--sm"
            ?disabled=${configLoading}
            @click=${onConfigReload}
          >
            ${t("common.reloadConfig")}
          </button>
          <button
            type="button"
            class="btn btn--sm primary"
            ?disabled=${configSaving || !configDirty}
            @click=${onConfigSave}
          >
            ${configSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </section>
  `;
}
