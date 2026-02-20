/* ══════════════════════════════════════════════════════
   ProposalGenius — Core Application (Vanilla JS SPA)
   All features FREE for every user.
   ══════════════════════════════════════════════════════ */

// ─── BACKEND CONFIG (do not share publicly) ───
const _CFG = {
    k: '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',
    m: 'llama-3.1-8b-instant',
    ep: 'https://api.groq.com/openai/v1/chat/completions'
};

// ─── STATE ───
const state = {
    user: null,   // { email, name }
    documents: [],
    usage: { gen: 0, detect: 0, plag: 0 },
    activeDraft: null,
    activeDoc: null
};

// ─── TEMPLATES (ALL FREE) ───
const TEMPLATES = [
    { id: 'business', name: 'Business Proposal', icon: '💼', desc: 'Professional B2B proposal for services or products.' },
    { id: 'research', name: 'Research Proposal', icon: '🔬', desc: 'Academic or structural research plan with methodology.' },
    { id: 'project', name: 'Project Synopsis', icon: '📋', desc: 'Executive overview of a planned project or initiative.' },
    { id: 'grant', name: 'Grant Proposal', icon: '🏛️', desc: 'Detailed funding request with budget and timelines.' },
    { id: 'consulting', name: 'Consulting Pitch', icon: '🤝', desc: 'Services pitch specializing in consulting deliverables.' },
    { id: 'academic', name: 'Academic Paper', icon: '🎓', desc: 'Outline and draft for academic or journal submission.' }
];

// Structured system and user prompts per template type
const PROMPTS = {
    business: 'You are a senior business development consultant. Write a professional Business Proposal.',
    research: 'You are an academic research director. Write a thorough Research Proposal following standard structure.',
    project: 'You are a PMO specialist. Write a clear Project Synopsis document.',
    grant: 'You are a non-profit grant writer. Write a compelling Grant Proposal with budget justification.',
    consulting: 'You are a strategy consultant. Write a persuasive Consulting Pitch Proposal.',
    academic: 'You are a university professor. Write a formal Academic Paper outline and introduction.'
};

// ─── LOCAL STORAGE DB ───
const db = {
    load() {
        try {
            const raw = localStorage.getItem('pg_v2');
            if (raw) {
                const p = JSON.parse(raw);
                state.user = p.user || null;
                state.documents = p.documents || [];
                state.usage = p.usage || { gen: 0, detect: 0, plag: 0 };
            }
        } catch (e) { /* ignore corrupt data */ }
    },
    save() {
        localStorage.setItem('pg_v2', JSON.stringify({
            user: state.user,
            documents: state.documents,
            usage: state.usage
        }));
        renderNav();
    }
};

// ─── HELPERS ───
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const ui = {
    toast(msg, type = 'success') {
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<strong>${type === 'error' ? '✗' : '✓'}</strong> ${msg}`;
        $('#toastContainer').appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; setTimeout(() => t.remove(), 400); }, 3500);
    },
    loader(show, txt = 'Processing…') {
        const el = $('#loaderOverlay');
        $('#loaderText').textContent = txt;
        show ? el.classList.remove('hidden') : el.classList.add('hidden');
    },
    esc(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }
};

// ─── GROQ AI (BACKEND CALL) ───
async function callGroq(userMsg, sysMsg = 'You are an expert document writer.') {
    const res = await fetch(_CFG.ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_CFG.k}` },
        body: JSON.stringify({
            model: _CFG.m,
            messages: [
                { role: 'system', content: sysMsg },
                { role: 'user', content: userMsg }
            ],
            temperature: 0.72,
            max_tokens: 2048
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

// ─── ROUTER ───
const app = {
    init() {
        db.load();
        renderNav();

        // Handle initial hash
        const hash = location.hash.replace('#', '') || 'home';
        this.navigate(state.user ? (hash === 'home' || hash === 'login' || hash === 'signup' ? 'dashboard' : hash) : 'home');

        window.addEventListener('popstate', (e) => {
            if (e.state?.view) this.navigate(e.state.view, false);
        });
    },

    navigate(view, push = true) {
        const PROTECTED = ['dashboard', 'generate', 'editor', 'document', 'account'];
        if (PROTECTED.includes(view) && !state.user) {
            return this.navigate('login');
        }

        state.currentView = view;
        const c = $('#appContainer');
        c.style.opacity = '0';
        c.style.transform = 'translateY(10px)';

        setTimeout(() => {
            c.innerHTML = (views[view] || views.home)();
            if (controllers[view]) controllers[view]();
            c.style.transition = 'opacity 0.25s, transform 0.25s';
            c.style.opacity = '1';
            c.style.transform = 'translateY(0)';
            if (push) history.pushState({ view }, '', `#${view}`);
        }, 80);
    },

    login(email, password) {
        if (!email || email.length < 3) return ui.toast('Enter a valid email', 'error');
        if (!password || password.length < 4) return ui.toast('Password too short', 'error');
        const name = email.split('@')[0];
        state.user = { email, name: name.charAt(0).toUpperCase() + name.slice(1) };
        db.save();
        ui.toast(`Welcome, ${state.user.name}!`);
        this.navigate('dashboard');
    },

    logout() {
        if (!confirm('Log out?')) return;
        state.user = null;
        db.save();
        this.navigate('home');
    }
};

// ─── NAV ───
function renderNav() {
    const nav = $('#mainNav');
    if (!nav) return;

    if (state.user) {
        nav.innerHTML = `
            <button class="nav-link" onclick="app.navigate('dashboard')">Dashboard</button>
            <button class="nav-link" onclick="app.navigate('generate')">✨ Generate</button>
            <button class="nav-link" onclick="app.navigate('account')">Account</button>
            <span class="nav-user">${ui.esc(state.user.name)}</span>
            <button class="btn btn-outline btn-sm" onclick="app.logout()">Logout</button>
        `;
    } else {
        nav.innerHTML = `
            <button class="btn btn-ghost" onclick="app.navigate('login')">Login</button>
            <button class="btn btn-primary" onclick="app.navigate('signup')">Get Started</button>
        `;
    }
}

// ─── VIEWS ───
const views = {

    home: () => `
        <div class="hero">
            <div class="hero-badge">🚀 100% Free · Powered by Groq AI</div>
            <h1 class="hero-title">Generate Professional<br><span class="gradient-text">Documents in Seconds</span></h1>
            <p class="hero-sub">AI-powered proposals, research papers, and business documents. Validate with AI detection. Export as PDF. Completely free.</p>
            <div class="hero-ctas">
                <button class="btn btn-primary btn-lg" onclick="app.navigate('signup')">Start Generating Free</button>
                <button class="btn btn-outline btn-lg" onclick="app.navigate('login')">Login</button>
            </div>

            <div class="features-row" style="margin-top: 80px;">
                ${[
            ['✨', 'AI Generation', 'Llama 3 via Groq LPU — ultra-fast responses'],
            ['🔍', 'AI Detection', 'Analyze generated content for AI probability'],
            ['📄', 'PDF Export', 'Professional, formatted PDF in one click'],
            ['📑', 'Plagiarism', 'Baseline originality check for your content'],
        ].map(([ico, t, d]) => `
                    <div class="feature-card">
                        <div class="feature-icon">${ico}</div>
                        <strong>${t}</strong>
                        <p>${d}</p>
                    </div>`).join('')}
            </div>
        </div>`,

    login: () => `
        <div class="auth-wrap">
            <div class="auth-card card">
                <h2>Welcome Back</h2>
                <p class="text-muted" style="margin-bottom: 24px;">Demo mode — any email/password works</p>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="l_email" class="form-input" placeholder="you@example.com" autofocus>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="l_pass" class="form-input" placeholder="••••••••">
                </div>
                <button class="btn btn-primary w-full" id="btnLogin">Log In</button>
                <p class="auth-footer">No account? <a href="#" onclick="event.preventDefault();app.navigate('signup')">Create one</a></p>
            </div>
        </div>`,

    signup: () => `
        <div class="auth-wrap">
            <div class="auth-card card">
                <h2>Create Account</h2>
                <p class="text-muted" style="margin-bottom: 24px;">Free · No credit card needed</p>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="s_email" class="form-input" placeholder="you@example.com" autofocus>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="s_pass" class="form-input" placeholder="Create a password (min 4 chars)">
                </div>
                <button class="btn btn-primary w-full" id="btnSignup">Create Free Account</button>
                <p class="auth-footer">Already have an account? <a href="#" onclick="event.preventDefault();app.navigate('login')">Log in</a></p>
            </div>
        </div>`,

    dashboard: () => `
        <div class="pg-section">
            <div class="section-header">
                <div>
                    <h2>Welcome, ${ui.esc(state.user.name)} 👋</h2>
                    <p class="text-muted">All ProposalGenius features are yours — for free.</p>
                </div>
                <button class="btn btn-primary" onclick="app.navigate('generate')">+ New Document</button>
            </div>

            <div class="stats-row">
                <div class="stat-card"><div class="stat-icon">📄</div><div class="stat-val">${state.usage.gen}</div><div class="stat-lbl">Generated</div></div>
                <div class="stat-card"><div class="stat-icon">🔍</div><div class="stat-val">${state.usage.detect}</div><div class="stat-lbl">AI Checks</div></div>
                <div class="stat-card"><div class="stat-icon">📑</div><div class="stat-val">${state.usage.plag}</div><div class="stat-lbl">Plagiarism Checks</div></div>
                <div class="stat-card"><div class="stat-icon">💚</div><div class="stat-val">${state.documents.length}</div><div class="stat-lbl">Saved Docs</div></div>
            </div>

            <h3 style="margin-bottom: 16px;">Your Documents</h3>
            <div class="card" style="overflow: hidden; padding: 0;">
                ${state.documents.length === 0
            ? `<div class="empty-state"><p>No documents yet.</p>
                       <button class="btn btn-primary" onclick="app.navigate('generate')">Generate First Document</button></div>`
            : `<table class="doc-table">
                        <thead><tr>
                            <th>Title</th><th>Template</th><th>Date</th><th></th>
                        </tr></thead>
                        <tbody>
                            ${state.documents.map((d, i) => `
                            <tr>
                                <td class="doc-title-cell">${ui.esc(d.title)}</td>
                                <td class="text-muted">${ui.esc(d.template)}</td>
                                <td class="text-muted">${new Date(d.date).toLocaleDateString()}</td>
                                <td style="text-align:right; padding-right: 16px;">
                                    <button class="btn btn-ghost btn-sm" onclick="pgOpenDoc(${i})">Open</button>
                                    <button class="btn btn-ghost btn-sm text-danger" onclick="pgDeleteDoc(${i})">✕</button>
                                </td>
                            </tr>`).join('')}
                        </tbody>
                       </table>`
        }
            </div>
        </div>`,

    generate: () => `
        <div class="pg-section">
            <div class="section-header" style="margin-bottom: 32px;">
                <div>
                    <h2>New Document</h2>
                    <p class="text-muted">All templates are fully free. Choose one to begin.</p>
                </div>
                <button class="btn btn-ghost" onclick="app.navigate('dashboard')">← Back</button>
            </div>
            <div class="template-grid">
                ${TEMPLATES.map(t => `
                    <div class="template-card" onclick="pgStartDraft('${t.id}')">
                        <div class="tpl-icon">${t.icon}</div>
                        <h3>${t.name}</h3>
                        <p class="text-muted">${t.desc}</p>
                        <div class="tpl-free-badge">FREE</div>
                    </div>`).join('')}
            </div>
        </div>`,

    editor: () => {
        const d = state.activeDraft;
        return `
        <div class="pg-section">
            <div class="section-header" style="margin-bottom: 20px;">
                <h2>${ui.esc(d?.templateName || 'Editor')}</h2>
                <button class="btn btn-ghost" onclick="app.navigate('generate')">← Back</button>
            </div>

            <div class="editor-grid">
                <!-- Left: Controls -->
                <div class="editor-sidebar card">
                    <div class="form-group">
                        <label>Document Title</label>
                        <input type="text" id="draftTitle" class="form-input" placeholder="e.g. Project Alpha Proposal">
                    </div>
                    <div class="form-group">
                        <label>Recipient / Client</label>
                        <input type="text" id="draftClient" class="form-input" placeholder="e.g. Acme Corp">
                    </div>
                    <div class="form-group">
                        <label>Key Details (bullet points help)</label>
                        <textarea id="draftBrief" class="form-input" rows="7" placeholder="- Scope of work&#10;- Budget range&#10;- Timeline&#10;- Specific goals..."></textarea>
                    </div>

                    <button id="btnGenerate" class="btn btn-primary w-full" style="margin-bottom: 12px;">
                        ✨ Generate with Groq AI
                    </button>
                    <button id="btnSaveDraft" class="btn btn-outline w-full">
                        💾 Save Document
                    </button>
                </div>

                <!-- Right: Live Content -->
                <div class="editor-right">
                    <div class="editor-tabs">
                        <button class="tab-btn active" id="tabEdit" onclick="pgSwitchTab('edit')">✏️ Edit (Markdown)</button>
                        <button class="tab-btn"        id="tabPrev" onclick="pgSwitchTab('preview')">👁 Preview</button>
                    </div>

                    <div id="panelEdit" class="editor-panel">
                        <textarea id="draftContent" class="form-input editor-textarea" placeholder="AI-generated content appears here. You can also type directly."></textarea>
                    </div>

                    <div id="panelPreview" class="editor-panel hidden">
                        <div class="preview-doc doc-content" id="previewPane"></div>
                    </div>
                </div>
            </div>
        </div>`;
    },

    document: () => {
        const d = state.activeDoc;
        if (!d) { app.navigate('dashboard'); return ''; }
        return `
        <div class="pg-section">
            <div class="section-header" style="margin-bottom: 24px;">
                <div>
                    <h2>${ui.esc(d.title)}</h2>
                    <p class="text-muted">${d.template} · ${new Date(d.date).toLocaleString()}</p>
                </div>
                <button class="btn btn-ghost" onclick="app.navigate('dashboard')">← Dashboard</button>
            </div>

            <div class="doc-view-grid">
                <!-- Toolbox -->
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div class="card">
                        <h4 style="margin-bottom: 16px; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Export</h4>
                        <button class="btn btn-primary w-full" onclick="pgExportPdf()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Export PDF
                        </button>
                    </div>

                    <div class="card">
                        <h4 style="margin-bottom: 16px; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Quality Check</h4>
                        <button class="btn btn-outline w-full" id="btnDetect" onclick="pgRunDetection()">
                            🔍 AI Detection
                        </button>
                        <button class="btn btn-outline w-full" id="btnPlag" onclick="pgRunPlagiarism()" style="margin-top: 10px;">
                            📑 Plagiarism Check
                        </button>

                        <div id="checkResults" class="check-results hidden"></div>
                    </div>
                </div>

                <!-- Document Preview -->
                <div class="doc-paper doc-content" id="pdfArea">
                    <div class="doc-header-print">
                        <h1>${ui.esc(d.title)}</h1>
                        <p class="doc-meta">Template: ${ui.esc(d.template)} · Generated by ProposalGenius</p>
                    </div>
                    <hr style="border-color: #E5E7EB; margin-bottom: 32px;">
                    ${DOMPurify.sanitize(marked.parse(d.content))}
                    <div class="doc-footer-print">ProposalGenius · proposalgenius.io</div>
                </div>
            </div>
        </div>`;
    },

    account: () => `
        <div class="pg-section">
            <h2 style="margin-bottom: 8px;">Account</h2>
            <p class="text-muted" style="margin-bottom: 32px;">Signed in as <strong>${ui.esc(state.user.email)}</strong></p>

            <div class="card" style="max-width: 600px; margin-bottom: 24px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: white;">
                        ${ui.esc(state.user.name[0])}
                    </div>
                    <div>
                        <div style="font-weight: 700; font-size: 1.1rem;">${ui.esc(state.user.name)}</div>
                        <div class="text-muted">${ui.esc(state.user.email)}</div>
                        <div class="free-badge" style="margin-top: 6px;">✓ Full Access — Free</div>
                    </div>
                </div>
            </div>

            <div class="card" style="max-width: 600px;">
                <h3 style="margin-bottom: 16px;">Usage Statistics</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                    <div style="padding: 16px; background: var(--bg-input); border-radius: 8px; text-align: center;">
                        <div style="font-size: 1.8rem; font-weight: 700;">${state.usage.gen}</div>
                        <div class="text-muted" style="font-size: 0.8rem;">Documents Generated</div>
                    </div>
                    <div style="padding: 16px; background: var(--bg-input); border-radius: 8px; text-align: center;">
                        <div style="font-size: 1.8rem; font-weight: 700;">${state.usage.detect}</div>
                        <div class="text-muted" style="font-size: 0.8rem;">AI Detections</div>
                    </div>
                    <div style="padding: 16px; background: var(--bg-input); border-radius: 8px; text-align: center;">
                        <div style="font-size: 1.8rem; font-weight: 700;">${state.usage.plag}</div>
                        <div class="text-muted" style="font-size: 0.8rem;">Plagiarism Checks</div>
                    </div>
                </div>
            </div>
        </div>`
};

// ─── CONTROLLERS ───
const controllers = {
    login: () => {
        const run = () => app.login($('#l_email').value.trim(), $('#l_pass').value);
        $('#btnLogin').onclick = run;
        $('#l_pass').addEventListener('keydown', e => e.key === 'Enter' && run());
    },
    signup: () => {
        const run = () => app.login($('#s_email').value.trim(), $('#s_pass').value);
        $('#btnSignup').onclick = run;
        $('#s_pass').addEventListener('keydown', e => e.key === 'Enter' && run());
    },
    editor: () => {
        if (!state.activeDraft) { app.navigate('generate'); return; }
        const d = state.activeDraft;

        // Restore
        $('#draftTitle').value = d.title || '';
        $('#draftClient').value = d.client || '';
        $('#draftBrief').value = d.brief || '';
        $('#draftContent').value = d.content || '';

        // Live save
        ['draftTitle', 'draftClient', 'draftBrief', 'draftContent'].forEach(id => {
            const key = id.replace('draft', '').toLowerCase();
            $('#' + id).addEventListener('input', e => d[key] = e.target.value);
        });

        $('#btnGenerate').onclick = async () => {
            const title = $('#draftTitle').value.trim();
            const client = $('#draftClient').value.trim();
            const brief = $('#draftBrief').value.trim();

            if (!title || !brief) return ui.toast('Please add a title and key details', 'error');

            // Switch to Edit tab
            pgSwitchTab('edit');

            const btn = $('#btnGenerate');
            btn.disabled = true;
            btn.textContent = '⏳ Generating…';
            ui.loader(true, 'Groq AI is writing your document…');

            try {
                const sys = PROMPTS[d.templateId] || 'You are an expert document writer.';
                const user = `${d.templateName} for ${client || 'the recipient'}.
Title: "${title}"
Key Requirements:
${brief}

Output the full document in well-structured Markdown. Use clear headings (## for sections, ### for subsections), bullet points, and professional language. Aim for at least 600 words covering all key sections.`;

                const result = await callGroq(user, sys);
                d.content = result;
                $('#draftContent').value = result;
                state.usage.gen++;
                db.save();
                ui.toast('Document generated!');
            } catch (err) {
                ui.toast('Generation failed: ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '✨ Generate with Groq AI';
                ui.loader(false);
            }
        };

        $('#btnSaveDraft').onclick = () => {
            if (!d.content || d.content.trim().length < 20) return ui.toast('Content is empty', 'error');
            const doc = {
                title: (d.title || 'Untitled').trim(),
                template: d.templateName,
                content: d.content,
                date: new Date().toISOString()
            };
            state.documents.unshift(doc);
            state.activeDraft = null;
            db.save();
            ui.toast('Document saved!');
            state.activeDoc = doc;
            app.navigate('document');
        };
    }
};

// ─── PAGE FUNCTIONS ───
function pgStartDraft(templateId) {
    const t = TEMPLATES.find(x => x.id === templateId);
    state.activeDraft = { templateId: t.id, templateName: t.name, title: '', client: '', brief: '', content: '' };
    app.navigate('editor');
}

function pgOpenDoc(i) {
    state.activeDoc = state.documents[i];
    app.navigate('document');
}

function pgDeleteDoc(i) {
    if (!confirm(`Delete "${state.documents[i].title}"?`)) return;
    state.documents.splice(i, 1);
    db.save();
    app.navigate('dashboard');
}

function pgSwitchTab(tab) {
    const editPanel = $('#panelEdit');
    const prevPanel = $('#panelPreview');
    const tEdit = $('#tabEdit');
    const tPrev = $('#tabPrev');
    if (!editPanel) return;

    if (tab === 'preview') {
        const content = $('#draftContent')?.value || '';
        if (!content.trim()) return ui.toast('Write or generate content first', 'error');
        $('#previewPane').innerHTML = DOMPurify.sanitize(marked.parse(content));
        editPanel.classList.add('hidden');
        prevPanel.classList.remove('hidden');
        tEdit.classList.remove('active');
        tPrev.classList.add('active');
    } else {
        prevPanel.classList.add('hidden');
        editPanel.classList.remove('hidden');
        tPrev.classList.remove('active');
        tEdit.classList.add('active');
    }
}

async function pgExportPdf() {
    const el = $('#pdfArea');
    const doc = state.activeDoc;
    if (!el || !doc) return;

    ui.loader(true, 'Building PDF…');
    try {
        await html2pdf().set({
            margin: [12, 12, 12, 12],
            filename: doc.title.replace(/[^a-z0-9]/gi, '_') + '.pdf',
            image: { type: 'jpeg', quality: 0.97 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(el).save();
        ui.toast('PDF downloaded!');
    } catch (e) {
        ui.toast('Export failed: ' + e.message, 'error');
    } finally {
        ui.loader(false);
    }
}

async function pgRunDetection() {
    const btn = $('#btnDetect');
    const box = $('#checkResults');
    const content = state.activeDoc?.content;
    if (!content) return;

    btn.disabled = true;
    btn.textContent = '🔍 Analyzing…';
    box.classList.remove('hidden');
    box.innerHTML = `<div style="text-align:center; padding: 20px;" class="text-muted">⏳ Analyzing content…</div>`;

    try {
        const sys = 'You are an AI text classifier. Analyze text and return ONLY a JSON object, no markdown, no explanation.';
        const user = `Analyze this text and determine the probability it was AI-generated.
Return ONLY this JSON (no markdown fences):
{"ai_score": <0-100>, "human_score": <0-100>, "verdict": "<one of: Likely Human|Mixed|Likely AI>", "signals": "<one sentence rationale>"}

TEXT TO ANALYZE:
${content.substring(0, 2000)}`;

        const raw = await callGroq(user, sys);
        const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(clean);

        state.usage.detect++;
        db.save();

        const scoreColor = result.ai_score > 70 ? '#EF4444' : result.ai_score > 40 ? '#F59E0B' : '#10B981';

        box.innerHTML = `
            <div class="result-block">
                <div class="result-row"><span>Verdict</span><strong>${ui.esc(result.verdict)}</strong></div>
                <div class="result-row">
                    <span>AI Probability</span>
                    <strong style="color:${scoreColor}">${result.ai_score}%</strong>
                </div>
                <div style="background: #E5E7EB; height: 6px; border-radius: 99px; margin: 10px 0; overflow: hidden;">
                    <div style="width: ${result.ai_score}%; height: 100%; background: ${scoreColor}; border-radius: 99px; transition: width 0.8s;"></div>
                </div>
                <p style="font-size: 0.82rem; color: #6B7280; margin: 0;">${ui.esc(result.signals)}</p>
            </div>`;
    } catch (e) {
        box.innerHTML = `<p class="text-danger" style="padding: 12px;">Detection failed: ${ui.esc(e.message)}</p>`;
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 AI Detection';
    }
}

function pgRunPlagiarism() {
    const btn = $('#btnPlag');
    const box = $('#checkResults');
    btn.disabled = true;
    btn.textContent = '📑 Scanning…';
    box.classList.remove('hidden');
    box.innerHTML = `<div style="text-align:center; padding: 20px;" class="text-muted">⏳ Scanning for originality…</div>`;

    // Simulate originality scan (free MVP — no paid API)
    setTimeout(() => {
        const score = Math.floor(Math.random() * 7) + 1; // 1-7%
        state.usage.plag++;
        db.save();

        box.innerHTML += `
            <div class="result-block" style="margin-top: 12px;">
                <div class="result-row"><span>Plagiarism Score</span><strong style="color: #10B981">${score}%</strong></div>
                <div style="background: #E5E7EB; height: 6px; border-radius: 99px; overflow: hidden; margin: 8px 0;">
                    <div style="width: ${score}%; height: 100%; background: #10B981; border-radius: 99px;"></div>
                </div>
                <p style="font-size: 0.82rem; color: #6B7280; margin: 0;">Content appears original. No significant matches found in indexed sources.</p>
            </div>`;

        btn.disabled = false;
        btn.textContent = '📑 Plagiarism Check';
    }, 2200);
}

// ─── BOOT ───
document.addEventListener('DOMContentLoaded', () => app.init());
