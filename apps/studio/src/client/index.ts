import type { PrimitiveSummary, StudioSnapshot, TraceEvent } from '@agents/shared';

const app = document.querySelector<HTMLDivElement>('#app');
const THEME_STORAGE_KEY = 'agents-studio-theme';
const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

if (!app) {
  throw new Error('Missing #app root');
}

const root = app;

type Theme = 'light' | 'dark';

type ClientState = {
  snapshot: StudioSnapshot | null;
  theme: Theme;
};

const state: ClientState = {
  snapshot: null,
  theme: getPreferredTheme()
};

// The browser only owns rendering and user input; the studio server owns protocol state.
void bootstrap();

async function bootstrap(): Promise<void> {
  applyTheme(state.theme);
  state.snapshot = await fetchJson<StudioSnapshot>('/api/state');
  render();
  const events = new EventSource('/api/events');
  events.addEventListener('snapshot', event => {
    state.snapshot = JSON.parse((event as MessageEvent<string>).data) as StudioSnapshot;
    render();
  });
  themeMediaQuery.addEventListener('change', handleSystemThemeChange);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...init
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function render(): void {
  const snapshot = state.snapshot;
  if (!snapshot) {
    root.innerHTML = '<p>Loading…</p>';
    return;
  }

  root.innerHTML = `
    <div class="shell">
      <section class="hero">
        <article class="hero-card">
          <div class="pill-note">Local stdio MCP playground</div>
          <h1>Self-Serve Agents, Explained From the Wire Up</h1>
          <p>
            This studio owns the MCP client session, the browser renders the live state, and every interesting protocol event lands in the trace.
            Run the guided tour, trigger tools, create recipes, and watch prompts/resources evolve in real time.
          </p>
        </article>
        <aside class="hero-side">
          <div class="hero-side-header">
            <h2>Session</h2>
            <button class="ghost theme-toggle" type="button" id="theme-toggle" aria-label="Switch to ${state.theme === 'dark' ? 'light' : 'dark'} mode">
              ${state.theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
          <div class="meta-grid">
            <div class="meta-row"><span>Connection</span><strong>${snapshot.connected ? 'connected' : 'offline'}</strong></div>
            <div class="meta-row"><span>Transport</span><strong>${snapshot.capabilityMatrix.transport}</strong></div>
            <div class="meta-row"><span>Mode</span><strong>${snapshot.mode}</strong></div>
            <div class="meta-row"><span>Theme</span><strong>${state.theme}</strong></div>
            <div class="meta-row"><span>Trace events</span><strong>${snapshot.trace.length}</strong></div>
            <div class="meta-row"><span>Recipes</span><strong>${snapshot.recipes.length}</strong></div>
          </div>
        </aside>
      </section>

      <section class="layout">
        <div class="column">
          <section class="panel">
            <div class="section-title">
              <h2>Run / Chat</h2>
              <span>Kick off the tour, test tools, and create agent recipes.</span>
            </div>

            <div class="controls">
              <form id="tour-form" class="split">
                <div class="control-grid">
                  <div class="field">
                    <label for="tour-goal">Tour goal</label>
                    <input id="tour-goal" name="goal" value="Understand the complete capability surface of this MCP perspective." />
                  </div>
                  <div class="field">
                    <label for="tour-mode">Mode</label>
                    <select id="tour-mode" name="mode">
                      ${renderModeOptions(snapshot.mode)}
                    </select>
                  </div>
                </div>
                <div class="button-row">
                  <button class="primary" type="submit">Run protocol tour</button>
                  <button class="ghost" type="button" id="refresh-button">Refresh state</button>
                </div>
              </form>

              <div class="control-grid">
                <form id="search-form" class="field">
                  <label for="search-query">Quick search</label>
                  <input id="search-query" name="query" value="McpServer" />
                  <button class="secondary" type="submit">Run workspace.search</button>
                </form>

                <form id="summary-form" class="field">
                  <label for="summary-path">Summarize file</label>
                  <input id="summary-path" name="path" value="README.md" />
                  <button class="secondary" type="submit">Run file.summarize</button>
                </form>
              </div>

              <form id="recipe-form" class="recipe-form">
                <div class="section-title">
                  <h2>Self-Serve Agent Recipe</h2>
                  <span>Leave <code>systemPrompt</code> blank to trigger server-side elicitation.</span>
                </div>
                <div class="control-grid">
                  <div class="field">
                    <label for="recipe-name">Name</label>
                    <input id="recipe-name" name="name" value="Trace Partner" />
                  </div>
                  <div class="field">
                    <label for="recipe-mode">Recipe mode</label>
                    <select id="recipe-mode" name="mode">
                      ${renderModeOptions(snapshot.mode)}
                    </select>
                  </div>
                </div>
                <div class="field">
                  <label for="recipe-description">Description</label>
                  <input id="recipe-description" name="description" value="Explains the newest trace and suggests the next experiment." />
                </div>
                <div class="field">
                  <label for="recipe-system-prompt">System prompt</label>
                  <textarea id="recipe-system-prompt" name="systemPrompt" placeholder="Optional: leave blank to see elicitation in action."></textarea>
                </div>
                <div class="field">
                  <label for="recipe-starter-prompt">Starter prompt</label>
                  <textarea id="recipe-starter-prompt" name="starterPrompt">Explain the newest run in plain English and point out the most educational protocol moment.</textarea>
                </div>
                <div class="field">
                  <label>Allowed tools</label>
                  <div class="badge-row">
                    ${renderCheckbox('allowedTools', 'workspace.search', true)}
                    ${renderCheckbox('allowedTools', 'file.summarize', true)}
                    ${renderCheckbox('allowedTools', 'agent.scaffold', false)}
                  </div>
                </div>
                <div class="field">
                  <label>Pinned resources</label>
                  <div class="badge-row">
                    ${renderCheckbox('pinnedResources', 'workspace://tree', true)}
                    ${renderCheckbox('pinnedResources', 'session://latest-run', true)}
                  </div>
                </div>
                <div class="button-row">
                  <button class="primary" type="submit">Save recipe via MCP tool</button>
                </div>
              </form>

              ${renderPendingElicitation(snapshot)}

              <div class="split">
                <div>
                  <div class="section-title">
                    <h2>Transcript</h2>
                    <span>Studio messages and prompt output.</span>
                  </div>
                  <div class="transcript">
                    ${snapshot.messages.map(message => renderMessage(message.role, message.text)).join('')}
                  </div>
                </div>
                <div>
                  <div class="section-title">
                    <h2>Latest Run Resource</h2>
                    <span>The subscribed <code>session://latest-run</code> resource.</span>
                  </div>
                  <pre class="resource-preview">${escapeHtml(snapshot.latestRunResource)}</pre>
                </div>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="section-title">
              <h2>Live Trace Timeline</h2>
              <span>Lifecycle, discovery, tool, prompt, resource, sampling, and elicitation events.</span>
            </div>
            <div class="trace-list">
              ${snapshot.trace.slice().reverse().map(renderTraceItem).join('')}
            </div>
          </section>
        </div>

        <div class="column">
          <section class="panel">
            <div class="section-title">
              <h2>Capability Matrix</h2>
              <span>What each side of the session says it can do.</span>
            </div>
            <div class="catalog-section">
              <div>
                <small class="muted">Client capabilities</small>
                <div class="badge-row">
                  ${Object.entries(snapshot.capabilityMatrix.client)
                    .map(([name, flag]) => renderCapabilityBadge(name, flag.enabled, flag.detail))
                    .join('')}
                </div>
              </div>
              <div>
                <small class="muted">Server capabilities</small>
                <div class="badge-row">
                  ${Object.entries(snapshot.capabilityMatrix.server)
                    .map(([name, flag]) => renderCapabilityBadge(name, flag.enabled, flag.detail))
                    .join('')}
                </div>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="section-title">
              <h2>Primitive Catalog</h2>
              <span>Tools, resources, and prompts discovered from the server.</span>
            </div>
            <div class="catalog">
              ${renderCatalogSection('Tools', snapshot.primitiveCatalog.tools)}
              ${renderCatalogSection('Resources', snapshot.primitiveCatalog.resources)}
              ${renderCatalogSection('Prompts', snapshot.primitiveCatalog.prompts)}
            </div>
          </section>

          <section class="panel">
            <div class="section-title">
              <h2>Recipes</h2>
              <span>Persisted locally in the gitignored data directory.</span>
            </div>
            <div class="catalog-grid">
              ${
                snapshot.recipes.length === 0
                  ? '<div class="catalog-card"><p>No recipes yet. Use the form in the run panel or complete the protocol tour.</p></div>'
                  : snapshot.recipes
                      .map(
                        recipe => `
                          <article class="catalog-card">
                            <header><strong>${escapeHtml(recipe.name)}</strong><code>${escapeHtml(recipe.mode)}</code></header>
                            <p>${escapeHtml(recipe.description)}</p>
                            <p><strong>Prompt:</strong> <code>${escapeHtml(`recipe.${recipe.id}`)}</code></p>
                            <p><strong>Tools:</strong> ${recipe.allowedTools.map(item => `<code>${escapeHtml(item)}</code>`).join(', ')}</p>
                            <p><strong>Resources:</strong> ${recipe.pinnedResources.map(item => `<code>${escapeHtml(item)}</code>`).join(', ')}</p>
                          </article>
                        `
                      )
                      .join('')
              }
            </div>
          </section>
        </div>
      </section>
    </div>
  `;

  bindInteractions();
}

function renderModeOptions(selected: StudioSnapshot['mode']): string {
  return ['deterministic', 'live']
    .map(mode => `<option value="${mode}" ${selected === mode ? 'selected' : ''}>${mode}</option>`)
    .join('');
}

function renderCheckbox(name: string, value: string, checked: boolean): string {
  return `
    <label class="badge enabled">
      <input type="checkbox" name="${name}" value="${value}" ${checked ? 'checked' : ''} />
      ${escapeHtml(value)}
    </label>
  `;
}

function renderPendingElicitation(snapshot: StudioSnapshot): string {
  if (!snapshot.pendingElicitation) {
    return '';
  }

  const properties = (snapshot.pendingElicitation.requestedSchema.properties ?? {}) as Record<string, { description?: string; type?: string }>;
  const required = new Set(((snapshot.pendingElicitation.requestedSchema.required as string[] | undefined) ?? []).map(String));

  return `
    <div class="elicitation-card">
      <div class="section-title">
        <h2>Pending Elicitation</h2>
        <span>The server is waiting for the browser client to answer.</span>
      </div>
      <p>${escapeHtml(snapshot.pendingElicitation.message)}</p>
      <form id="elicitation-form" class="elicitation-form" data-id="${snapshot.pendingElicitation.id}">
        ${Object.entries(properties)
          .map(([key, schema]) => {
            const isLong = key.toLowerCase().includes('prompt') || key.toLowerCase().includes('description');
            return `
              <div class="field">
                <label for="elicitation-${escapeHtml(key)}">${escapeHtml(key)}${required.has(key) ? ' *' : ''}</label>
                ${
                  isLong
                    ? `<textarea id="elicitation-${escapeHtml(key)}" name="${escapeHtml(key)}" placeholder="${escapeHtml(schema.description ?? '')}"></textarea>`
                    : `<input id="elicitation-${escapeHtml(key)}" name="${escapeHtml(key)}" placeholder="${escapeHtml(schema.description ?? '')}" />`
                }
              </div>
            `;
          })
          .join('')}
        <div class="button-row">
          <button class="primary" type="submit">Submit elicitation</button>
          <button class="ghost" type="button" id="elicitation-decline">Decline</button>
        </div>
      </form>
    </div>
  `;
}

function renderMessage(role: string, text: string): string {
  return `
    <article class="message ${role}">
      <small>${escapeHtml(role)}</small>
      <p>${escapeHtml(text)}</p>
    </article>
  `;
}

function renderCapabilityBadge(name: string, enabled: boolean, detail?: string): string {
  return `<span class="badge ${enabled ? 'enabled' : 'disabled'}">${escapeHtml(name)}${detail ? ` · ${escapeHtml(detail)}` : ''}</span>`;
}

function renderCatalogSection(title: string, items: PrimitiveSummary[]): string {
  return `
    <section class="catalog-section">
      <div class="section-title">
        <h2>${escapeHtml(title)}</h2>
        <span>${items.length} item${items.length === 1 ? '' : 's'}</span>
      </div>
      <div class="catalog-grid">
        ${
          items.length === 0
            ? '<div class="catalog-card"><p>No items discovered yet.</p></div>'
            : items.map(renderPrimitiveCard).join('')
        }
      </div>
    </section>
  `;
}

function renderPrimitiveCard(item: PrimitiveSummary): string {
  return `
    <article class="catalog-card">
      <header><strong>${escapeHtml(item.title || item.name)}</strong></header>
      <p><code>${escapeHtml(item.name)}</code>${item.uri ? ` · <code>${escapeHtml(item.uri)}</code>` : ''}</p>
      <p>${escapeHtml(item.description || 'No description provided.')}</p>
    </article>
  `;
}

function renderTraceItem(event: TraceEvent): string {
  return `
    <article class="trace-item">
      <header>
        <div>
          <strong>${escapeHtml(event.title)}</strong>
          <p class="muted">${escapeHtml(event.category)} · ${escapeHtml(event.direction)}</p>
        </div>
        <time datetime="${escapeHtml(event.timestamp)}">${new Date(event.timestamp).toLocaleTimeString()}</time>
      </header>
      ${event.detail ? `<p>${escapeHtml(event.detail)}</p>` : ''}
      ${event.payload ? `<pre>${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre>` : ''}
    </article>
  `;
}

function bindInteractions(): void {
  const tourForm = document.querySelector<HTMLFormElement>('#tour-form');
  tourForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(tourForm);
    await fetchJson('/api/run-tour', {
      method: 'POST',
      body: JSON.stringify({
        goal: form.get('goal'),
        mode: form.get('mode')
      })
    });
  });

  const refreshButton = document.querySelector<HTMLButtonElement>('#refresh-button');
  refreshButton?.addEventListener('click', async () => {
    await fetchJson('/api/refresh', {
      method: 'POST',
      body: JSON.stringify({})
    });
  });

  const themeToggle = document.querySelector<HTMLButtonElement>('#theme-toggle');
  themeToggle?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, state.theme);
    } catch {
      // Ignore storage failures and still apply the theme in-memory.
    }
    applyTheme(state.theme);
    render();
  });

  const searchForm = document.querySelector<HTMLFormElement>('#search-form');
  searchForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(searchForm);
    await fetchJson('/api/actions/search', {
      method: 'POST',
      body: JSON.stringify({
        query: form.get('query')
      })
    });
  });

  const summaryForm = document.querySelector<HTMLFormElement>('#summary-form');
  summaryForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(summaryForm);
    await fetchJson('/api/actions/summarize', {
      method: 'POST',
      body: JSON.stringify({
        path: form.get('path'),
        audience: 'beginner'
      })
    });
  });

  const recipeForm = document.querySelector<HTMLFormElement>('#recipe-form');
  recipeForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(recipeForm);
    await fetchJson('/api/recipes', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        description: form.get('description'),
        systemPrompt: form.get('systemPrompt'),
        starterPrompt: form.get('starterPrompt'),
        mode: form.get('mode'),
        allowedTools: form.getAll('allowedTools'),
        pinnedResources: form.getAll('pinnedResources')
      })
    });
  });

  const elicitationForm = document.querySelector<HTMLFormElement>('#elicitation-form');
  elicitationForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const id = elicitationForm.dataset.id;
    if (!id) return;
    const form = new FormData(elicitationForm);
    const content = Object.fromEntries(form.entries());
    await fetchJson(`/api/elicitation/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'accept', content })
    });
  });

  const elicitationDecline = document.querySelector<HTMLButtonElement>('#elicitation-decline');
  elicitationDecline?.addEventListener('click', async () => {
    const id = document.querySelector<HTMLFormElement>('#elicitation-form')?.dataset.id;
    if (!id) return;
    await fetchJson(`/api/elicitation/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'decline', content: {} })
    });
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getPreferredTheme(): Theme {
  // Respect a saved override first, then fall back to the operating system preference.
  const storedTheme = readStoredTheme();
  if (storedTheme) {
    return storedTheme;
  }
  return themeMediaQuery.matches ? 'dark' : 'light';
}

function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function handleSystemThemeChange(event: MediaQueryListEvent): void {
  // Once someone toggles manually, we stop auto-following later system changes.
  if (readStoredTheme()) {
    return;
  }
  state.theme = event.matches ? 'dark' : 'light';
  applyTheme(state.theme);
  render();
}
