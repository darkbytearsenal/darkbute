import './style.css';
import {
  createProgram,
  deleteProgram,
  fetchPrograms,
  updateProgram,
  type Program,
} from './programsApi';
import { auth } from './firebaseConfig';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('Root element #app not found');
}

appRoot.innerHTML = `
  <div class="page">
    <header class="header">
      <div class="header-left">
        <div class="logo-circle">
          <div class="logo-mark">
            <span class="logo-mark-inner"></span>
          </div>
        </div>
        <div class="brand">
          <span class="brand-title">DarkByte Arsenal</span>
          <span class="brand-subtitle">Share your own tools with everyone</span>
        </div>
      </div>
      <div class="header-right">
        <div class="search-wrapper">
          <input
            id="search-input"
            class="search-input"
            type="text"
            placeholder="Search programs..."
          />
        </div>
        <button id="admin-button" class="btn ghost">Admin</button>
      </div>
    </header>

    <main class="content">
      <section class="info-banner">
        <div class="info-banner-left">
          <p class="info-eyebrow">Welcome to DarkByte Arsenal</p>
          <h1 class="hero-title">Download my tools for free</h1>
          <p class="hero-text">
            A focused library of utilities and clients I personally use. No registration, no ads, no installers — just clean direct downloads.
          </p>
        </div>
        <div class="info-banner-right">
          <div class="info-pill">Free · No ads · Direct download</div>
        </div>
      </section>

      <section>
        <div class="section-header">
          <h2 class="section-title">Programs</h2>
          <span id="program-count" class="section-meta">0 items</span>
        </div>
        <div id="program-grid" class="program-grid">
          <!-- cards inserted by script -->
        </div>
        <div id="empty-state" class="empty-state" hidden>
          <p id="empty-text">No programs found. Try changing your search.</p>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="disclaimer">
        <strong>Disclaimer.</strong>
        All tools are provided “as is” without any warranties. You use them at your own risk, and I am not responsible for any damage or violations caused by their usage.
      </div>
      <span>Made by me for free distribution of my own software.</span>
    </footer>

    <div id="overlay" class="overlay" hidden></div>

    <div id="program-modal" class="modal" hidden>
      <div class="panel-header">
        <h2 id="program-modal-title" class="panel-title">Program</h2>
        <button id="program-modal-close" class="icon-button" aria-label="Close dialog">✕</button>
      </div>
      <div id="program-modal-content" class="panel-content">
        <!-- filled by script -->
      </div>
    </div>

    <div id="admin-panel" class="panel" hidden>
      <div class="panel-header">
        <h2 class="panel-title">Admin area</h2>
        <button id="panel-close" class="icon-button" aria-label="Close panel">✕</button>
      </div>
      <div id="admin-content" class="panel-content">
        <!-- login or upload form rendered here -->
      </div>
    </div>
  </div>
`;

const searchInput = document.querySelector<HTMLInputElement>('#search-input')!;
const programGrid = document.querySelector<HTMLDivElement>('#program-grid')!;
const programCount = document.querySelector<HTMLSpanElement>('#program-count')!;
const emptyState = document.querySelector<HTMLDivElement>('#empty-state')!;
const adminButton = document.querySelector<HTMLButtonElement>('#admin-button')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const programModal = document.querySelector<HTMLDivElement>('#program-modal')!;
const programModalTitle =
  document.querySelector<HTMLHeadingElement>('#program-modal-title')!;
const programModalContent =
  document.querySelector<HTMLDivElement>('#program-modal-content')!;
const programModalClose =
  document.querySelector<HTMLButtonElement>('#program-modal-close')!;
const panel = document.querySelector<HTMLDivElement>('#admin-panel')!;
const panelClose = document.querySelector<HTMLButtonElement>('#panel-close')!;
const adminContent = document.querySelector<HTMLDivElement>('#admin-content')!;

let allPrograms: Program[] = [];
let currentUser: { email: string } | null = null;
let activeDialog: 'admin' | 'program' | null = null;
let editingProgramId: string | null = null;

window.addEventListener('pointermove', (event) => {
  const x = (event.clientX / window.innerWidth) * 100;
  const y = (event.clientY / window.innerHeight) * 100;
  const root = document.documentElement;
  root.style.setProperty('--mouse-x', `${x}%`);
  root.style.setProperty('--mouse-y', `${y}%`);
});

const infoBanner = document.querySelector<HTMLElement>('.info-banner');
infoBanner?.addEventListener('mouseenter', () => {
  document.body.classList.add('hero-focus');
});
infoBanner?.addEventListener('mouseleave', () => {
  document.body.classList.remove('hero-focus');
});

function renderPrograms(filter: string) {
  const value = filter.trim().toLowerCase();
  const filtered = allPrograms.filter((program) => {
    if (!value) return true;
    const haystack = `${program.title} ${program.description} ${program.platform} ${program.version ?? ''}`.toLowerCase();
    return haystack.includes(value);
  });

  programGrid.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.hidden = false;
    programCount.textContent = '0 items';
    return;
  }

  emptyState.hidden = true;
  programCount.textContent = `${filtered.length} item${filtered.length === 1 ? '' : 's'}`;

  for (const program of filtered) {
    const card = document.createElement('article');
    card.className = 'program-card';
    card.tabIndex = 0;
    card.dataset.id = program.id;

    const isGithubSource = program.fileUrl.toLowerCase().includes('github.com');
    const trustLabel = isGithubSource
      ? 'Source: GitHub · No ads / installers'
      : 'Direct download · No ads / installers';

    card.innerHTML = `
      <div class="banner">
        <img src="${program.iconUrl}" alt="${program.title} banner" class="program-banner-img" />
      </div>
      <div class="program-card-main">
        <div class="program-info">
          <h3 class="program-title">${program.title}</h3>
          <p class="program-description clamp">${program.description}</p>
        </div>
      </div>
      <div class="program-footer">
        <div class="program-meta">
          <span class="program-tag">${program.platform}</span>
          ${program.version ? `<span class="program-tag subtle">v${program.version}</span>` : ''}
        </div>
        <div class="program-actions">
          <a href="${program.fileUrl}" class="btn primary" target="_blank" rel="noopener">
            Download
          </a>
        </div>
      </div>
      <div class="program-trust">${trustLabel}</div>
    `;

    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('a')) return;
      openProgramModal(program);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openProgramModal(program);
      }
    });

    card.addEventListener('mouseenter', () => {
      document.body.classList.add('program-focus');
    });

    card.addEventListener('mouseleave', () => {
      document.body.classList.remove('program-focus');
    });

    programGrid.appendChild(card);
  }
}

function openOverlay() {
  overlay.hidden = false;
  overlay.classList.add('overlay-visible');
}

function closeOverlay() {
  overlay.classList.remove('overlay-visible');
  setTimeout(() => {
    overlay.hidden = true;
  }, 200);
}

function openAdminPanel() {
  activeDialog = 'admin';
  openOverlay();
  panel.hidden = false;
  panel.classList.add('panel-visible');
}

function closeAdminPanel() {
  panel.classList.remove('panel-visible');
  activeDialog = null;
  setTimeout(() => {
    panel.hidden = true;
    closeOverlay();
  }, 200);
}

function openProgramModal(program: Program) {
  activeDialog = 'program';
  openOverlay();
  programModalTitle.textContent = program.title;
  programModalContent.innerHTML = `
    <div class="banner banner--modal">
      <img src="${program.iconUrl}" alt="${program.title} banner" class="modal-banner-img" />
    </div>
    <p class="modal-description">${program.description}</p>
    <div class="modal-footer">
      <div class="program-meta">
        <span class="program-tag">${program.platform}</span>
        ${program.version ? `<span class="program-tag subtle">v${program.version}</span>` : ''}
      </div>
      <div class="modal-actions">
        <button class="btn ghost" id="copy-program-link" type="button">Copy link</button>
        <a class="btn primary" href="${program.fileUrl}" target="_blank" rel="noopener">Download</a>
      </div>
    </div>
  `;
  programModal.hidden = false;
  programModal.classList.add('panel-visible');

  const url = new URL(window.location.href);
  url.searchParams.set('program', program.id);
  window.history.replaceState({}, '', url);

  const copyButton =
    programModalContent.querySelector<HTMLButtonElement>('#copy-program-link');
  copyButton?.addEventListener('click', async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      window.alert('Link copied!');
    } catch {
      window.prompt('Copy this link:', link);
    }
  });
}

function closeProgramModal() {
  programModal.classList.remove('panel-visible');
  activeDialog = null;
  setTimeout(() => {
    programModal.hidden = true;
    closeOverlay();
  }, 200);

  const url = new URL(window.location.href);
  url.searchParams.delete('program');
  window.history.replaceState({}, '', url);
}

function renderLoginForm() {
  adminContent.innerHTML = `
    <form id="login-form" class="form">
      <p class="form-text">
        Sign in with your admin email and password to upload new programs.
      </p>
      <label class="field">
        <span class="field-label">Email</span>
        <input id="login-email" type="email" class="field-input" required />
      </label>
      <label class="field">
        <span class="field-label">Password</span>
        <input id="login-password" type="password" class="field-input" required />
      </label>
      <div class="form-actions">
        <button type="submit" class="btn primary">Sign in</button>
      </div>
      <p id="login-error" class="form-error" hidden></p>
    </form>
  `;

  const form = document.querySelector<HTMLFormElement>('#login-form')!;
  const emailInput = document.querySelector<HTMLInputElement>('#login-email')!;
  const passwordInput =
    document.querySelector<HTMLInputElement>('#login-password')!;
  const errorEl = document.querySelector<HTMLParagraphElement>('#login-error')!;

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    errorEl.textContent = '';

    try {
      await signInWithEmailAndPassword(
        auth,
        emailInput.value.trim(),
        passwordInput.value
      );
    } catch (err) {
      console.error(err);
      errorEl.textContent =
        'Failed to sign in. Please check your credentials.';
      errorEl.hidden = false;
    }
  };
}

function renderAdminForm(email: string) {
  adminContent.innerHTML = `
    <div class="admin-header">
      <p class="form-text">Signed in as <strong>${email}</strong></p>
      <button id="sign-out" class="btn ghost small">Sign out</button>
    </div>
    <form id="upload-form" class="form">
      <h3 id="upload-form-title" class="form-title">Publish new program</h3>
      <label class="field">
        <span class="field-label">Program name</span>
        <input id="program-title" type="text" class="field-input" required />
      </label>
      <label class="field">
        <span class="field-label">Short description</span>
        <textarea id="program-description" class="field-input" rows="3" required></textarea>
      </label>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Platform / type</span>
          <input id="program-platform" type="text" class="field-input" placeholder="Windows, Android, CLI..." required />
        </label>
        <label class="field">
          <span class="field-label">Version (optional)</span>
          <input id="program-version" type="text" class="field-input" placeholder="1.0.0" />
        </label>
      </div>
      <label class="field">
        <span class="field-label">Program file URL</span>
        <input id="program-file-url" type="url" class="field-input" placeholder="https://github.com/you/repo/releases/..." required />
      </label>
      <label class="field">
        <span class="field-label">Banner image URL</span>
        <input id="program-icon-url" type="url" class="field-input" placeholder="https://raw.githubusercontent.com/you/repo/..." required />
      </label>
      <div class="form-actions">
        <button id="edit-cancel" type="button" class="btn ghost" hidden>Cancel</button>
        <button id="upload-submit" type="submit" class="btn primary">Publish</button>
      </div>
      <p id="upload-error" class="form-error" hidden></p>
      <p id="upload-success" class="form-success" hidden>Program published successfully.</p>
    </form>
    <div class="admin-divider"></div>
    <div class="admin-list">
      <div class="section-header">
        <h3 class="section-title">Manage programs</h3>
        <span class="section-meta">Delete removes it from the site list</span>
      </div>
      <div id="admin-programs" class="admin-programs">
        <!-- filled by script -->
      </div>
    </div>
  `;

  const signOutButton =
    document.querySelector<HTMLButtonElement>('#sign-out')!;
  const form = document.querySelector<HTMLFormElement>('#upload-form')!;
  const titleInput =
    document.querySelector<HTMLInputElement>('#program-title')!;
  const descriptionInput =
    document.querySelector<HTMLTextAreaElement>('#program-description')!;
  const platformInput =
    document.querySelector<HTMLInputElement>('#program-platform')!;
  const versionInput =
    document.querySelector<HTMLInputElement>('#program-version')!;
  const fileUrlInput =
    document.querySelector<HTMLInputElement>('#program-file-url')!;
  const iconUrlInput =
    document.querySelector<HTMLInputElement>('#program-icon-url')!;
  const formTitle =
    document.querySelector<HTMLHeadingElement>('#upload-form-title')!;
  const submitButton =
    document.querySelector<HTMLButtonElement>('#upload-submit')!;
  const cancelButton =
    document.querySelector<HTMLButtonElement>('#edit-cancel')!;
  const errorEl =
    document.querySelector<HTMLParagraphElement>('#upload-error')!;
  const successEl =
    document.querySelector<HTMLParagraphElement>('#upload-success')!;
  const adminPrograms =
    document.querySelector<HTMLDivElement>('#admin-programs')!;

  signOutButton.onclick = async () => {
    await signOut(auth);
  };

  function setEditMode(program: Program | null) {
    editingProgramId = program?.id ?? null;
    if (program) {
      formTitle.textContent = 'Edit program';
      submitButton.textContent = 'Save changes';
      cancelButton.hidden = false;
      titleInput.value = program.title ?? '';
      descriptionInput.value = program.description ?? '';
      platformInput.value = program.platform ?? '';
      versionInput.value = program.version ?? '';
      fileUrlInput.value = program.fileUrl ?? '';
      iconUrlInput.value = program.iconUrl ?? '';
      successEl.hidden = true;
      errorEl.hidden = true;
    } else {
      formTitle.textContent = 'Publish new program';
      submitButton.textContent = 'Publish';
      cancelButton.hidden = true;
      editingProgramId = null;
    }
  }

  cancelButton.onclick = () => {
    setEditMode(null);
    titleInput.value = '';
    descriptionInput.value = '';
    platformInput.value = '';
    versionInput.value = '';
    fileUrlInput.value = '';
    iconUrlInput.value = '';
    successEl.hidden = true;
    errorEl.hidden = true;
  };

  function renderAdminProgramsList() {
    const items = allPrograms;
    if (items.length === 0) {
      adminPrograms.innerHTML = `<p class="form-text">No programs yet.</p>`;
      return;
    }

    adminPrograms.innerHTML = items
      .map((p) => {
        const safeTitle = p.title.replaceAll('"', '&quot;');
        return `
          <div class="admin-program-row">
            <div class="admin-program-main">
              <span class="admin-program-title">${safeTitle}</span>
              <span class="admin-program-meta">${p.platform}${p.version ? ` · v${p.version}` : ''}</span>
            </div>
            <div class="admin-program-actions">
              <button class="btn ghost small admin-edit" data-id="${p.id}" type="button">Edit</button>
              <button class="btn ghost small admin-delete" data-id="${p.id}" type="button">Delete</button>
            </div>
          </div>
        `;
      })
      .join('');

    for (const button of adminPrograms.querySelectorAll<HTMLButtonElement>(
      '.admin-edit'
    )) {
      button.onclick = () => {
        const id = button.dataset.id;
        if (!id) return;
        const program = allPrograms.find((p) => p.id === id);
        if (!program) return;
        setEditMode(program);
      };
    }

    for (const button of adminPrograms.querySelectorAll<HTMLButtonElement>(
      '.admin-delete'
    )) {
      button.onclick = async () => {
        const id = button.dataset.id;
        if (!id) return;
        const program = allPrograms.find((p) => p.id === id);
        if (!program) return;
        const ok = window.confirm(`Delete "${program.title}" from the site list?`);
        if (!ok) return;

        try {
          await deleteProgram(program);
          allPrograms = await fetchPrograms();
          renderPrograms(searchInput.value);
          renderAdminProgramsList();
        } catch (err) {
          console.error(err);
          window.alert('Delete failed. Check Firestore rules and try again.');
        }
      };
    }
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;
    errorEl.textContent = '';

    const fileUrl = fileUrlInput.value.trim();
    const iconUrl = iconUrlInput.value.trim();

    if (!fileUrl || !iconUrl) {
      errorEl.textContent = 'Please provide both file URL and icon URL.';
      errorEl.hidden = false;
      return;
    }

    try {
      const payload = {
        title: titleInput.value.trim(),
        description: descriptionInput.value.trim(),
        platform: platformInput.value.trim(),
        version: versionInput.value.trim(),
        fileUrl,
        iconUrl,
      };

      if (editingProgramId) {
        await updateProgram(editingProgramId, payload);
      } else {
        await createProgram(payload);
      }

      titleInput.value = '';
      descriptionInput.value = '';
      platformInput.value = '';
      versionInput.value = '';
      fileUrlInput.value = '';
      iconUrlInput.value = '';

      successEl.hidden = false;
      allPrograms = await fetchPrograms();
      renderPrograms(searchInput.value);
      renderAdminProgramsList();
      setEditMode(null);
    } catch (err) {
      console.error(err);
      errorEl.textContent =
        'Failed to publish program. Please try again later.';
      errorEl.hidden = false;
    }
  };

  setEditMode(null);
  renderAdminProgramsList();
}

async function bootstrap() {
  try {
    allPrograms = await fetchPrograms();
  } catch (err) {
    console.error('Failed to load programs list:', err);
    allPrograms = [];
  }

  renderPrograms('');

  searchInput.addEventListener('input', () => {
    renderPrograms(searchInput.value);
  });

  adminButton.onclick = () => {
    openAdminPanel();
    if (currentUser) {
      renderAdminForm(currentUser.email);
    } else {
      renderLoginForm();
    }
  };

  overlay.onclick = () => {
    if (activeDialog === 'admin') closeAdminPanel();
    if (activeDialog === 'program') closeProgramModal();
  };

  panelClose.onclick = () => {
    closeAdminPanel();
  };

  programModalClose.onclick = () => {
    closeProgramModal();
  };

  onAuthStateChanged(auth, (user) => {
    if (user && user.email) {
      currentUser = { email: user.email };
      adminButton.textContent = 'Admin (online)';
      if (!panel.hidden) {
        renderAdminForm(user.email);
      }
    } else {
      currentUser = null;
      adminButton.textContent = 'Admin';
      if (!panel.hidden) {
        renderLoginForm();
      }
    }
  });

  const url = new URL(window.location.href);
  const openId = url.searchParams.get('program');
  if (openId) {
    const program = allPrograms.find((p) => p.id === openId);
    if (program) {
      const card = document.querySelector<HTMLElement>(
        `.program-card[data-id="${openId}"]`
      );
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      openProgramModal(program);
    }
  }
}

bootstrap().catch((err) => {
  console.error(err);
});

