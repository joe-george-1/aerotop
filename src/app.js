import SkinEngine from './skin-engine.js';
import WinampChromeSkin from './skins/winamp-chrome/skin.js';

// ── Initialize Skin Engine ───────────────────────────────────

const container = document.getElementById('skin-container');
const engine = new SkinEngine(container);

// Register all skins
engine.register(WinampChromeSkin);

// Activate preferred (or default) skin
const preferredSkin = engine.getPreferredSkin('winamp-chrome');
engine.activate(preferredSkin);

// ── System Data Feed ─────────────────────────────────────────

window.aerotop.onSystemUpdate((snapshot) => {
    engine.update(snapshot);
});

// ── Skin Selector (Ctrl+T) ──────────────────────────────────

const overlay = document.getElementById('skin-selector-overlay');
const skinList = document.getElementById('skin-list');

function buildSkinList() {
    skinList.innerHTML = '';
    const skins = engine.listSkins();
    const activeId = engine.getActiveSkinId();

    skins.forEach(meta => {
        const div = document.createElement('div');
        div.className = 'skin-option' + (meta.id === activeId ? ' active' : '');
        div.innerHTML = `
      <div class="skin-name">${meta.name}</div>
      <div class="skin-desc">${meta.description}</div>
    `;
        div.addEventListener('click', () => {
            engine.activate(meta.id);
            overlay.classList.remove('active');
        });
        skinList.appendChild(div);
    });
}

function toggleSkinSelector() {
    if (overlay.classList.contains('active')) {
        overlay.classList.remove('active');
    } else {
        buildSkinList();
        overlay.classList.add('active');
    }
}

// Close skin selector on Escape
overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
        overlay.classList.remove('active');
    }
});

// ── Global Keyboard Shortcuts ────────────────────────────────

document.addEventListener('keydown', (e) => {
    // Ctrl+T: toggle skin selector
    if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        toggleSkinSelector();
        return;
    }

    // Escape: close overlays
    if (e.key === 'Escape') {
        overlay.classList.remove('active');
    }
});
