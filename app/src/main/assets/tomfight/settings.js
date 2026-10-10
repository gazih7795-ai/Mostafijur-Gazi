// TOM FIGHT - Settings & Save Data Manager (settings.js)
// Manages game settings (Volume, Graphics Quality, FPS Overlay)
// and handles Export/Import Save Data with clipboard copying and validation.

class SettingsManager {
  constructor(game) {
    this.game = game;
    this.isImportMode = false;
    this.init();
  }

  init() {
    this.bindAudioSliders();
    this.bindGraphicsQuality();
    this.bindFpsToggle();
    this.bindSaveDataActions();
  }

  bindAudioSliders() {
    const masterSlider = document.getElementById("setting-master-vol");
    const sfxSlider = document.getElementById("setting-sfx-vol");
    const musicSlider = document.getElementById("setting-music-vol");

    if (masterSlider) {
      masterSlider.addEventListener("input", (e) => {
        if (this.game.audio) {
          this.game.audio.setVolumes(parseFloat(e.target.value), this.game.audio.sfxVolume, this.game.audio.musicVolume);
        }
      });
    }
    if (sfxSlider) {
      sfxSlider.addEventListener("input", (e) => {
        if (this.game.audio) {
          this.game.audio.setVolumes(this.game.audio.masterVolume, parseFloat(e.target.value), this.game.audio.musicVolume);
        }
      });
    }
    if (musicSlider) {
      musicSlider.addEventListener("input", (e) => {
        if (this.game.audio) {
          this.game.audio.setVolumes(this.game.audio.masterVolume, this.game.audio.sfxVolume, parseFloat(e.target.value));
        }
      });
    }
  }

  bindGraphicsQuality() {
    const qualSelect = document.getElementById("setting-quality");
    if (qualSelect) {
      qualSelect.value = this.game.graphicsQuality || "medium";
      qualSelect.addEventListener("change", (e) => {
        this.game.setQuality(e.target.value);
      });
    }
  }

  bindFpsToggle() {
    const fpsToggle = document.getElementById("setting-fps-toggle");
    if (fpsToggle) {
      fpsToggle.checked = Boolean(this.game.showFpsOverlay);
      fpsToggle.addEventListener("change", (e) => {
        this.game.toggleFpsOverlay(e.target.checked);
      });
    }
    this.game.updatePerfOverlayVisibility();
  }

  bindSaveDataActions() {
    const btnExport = document.getElementById("btn-export-save");
    const btnToggleImport = document.getElementById("btn-toggle-import");
    const btnQuickCopy = document.getElementById("btn-quick-copy");
    const btnConfirmImport = document.getElementById("btn-confirm-import");
    const btnClosePanel = document.getElementById("btn-close-save-panel");

    if (btnExport) {
      btnExport.addEventListener("click", () => this.exportSaveData());
    }
    if (btnToggleImport) {
      btnToggleImport.addEventListener("click", () => this.openImportMode());
    }
    if (btnQuickCopy) {
      btnQuickCopy.addEventListener("click", () => this.copyTextareaContent());
    }
    if (btnConfirmImport) {
      btnConfirmImport.addEventListener("click", () => this.confirmImportData());
    }
    if (btnClosePanel) {
      btnClosePanel.addEventListener("click", () => this.hideSavePanel());
    }
  }

  /**
   * Generates formatted save progress JSON and copies to player clipboard
   */
  async exportSaveData() {
    const savePayload = this.game.getSavePayload();
    const jsonString = JSON.stringify(savePayload, null, 2);

    const panel = document.getElementById("save-data-panel");
    const title = document.getElementById("save-data-panel-title");
    const textarea = document.getElementById("save-data-json-text");
    const confirmBtn = document.getElementById("btn-confirm-import");

    if (panel) panel.style.display = "block";
    if (title) title.innerText = "EXPORTED SAVE DATA (COPIED)";
    if (confirmBtn) confirmBtn.style.display = "none";
    if (textarea) {
      textarea.value = jsonString;
      textarea.readOnly = false;
      textarea.focus();
      textarea.select();
    }

    const copied = await this.copyToClipboard(jsonString, textarea);

    if (copied) {
      this.showFeedback("✓ Save progress copied to clipboard! Keep this JSON string safe to restore anytime.", "success");
      this.game.showToast("Save Data copied to clipboard! 📋");
    } else {
      this.showFeedback("✓ Save JSON generated below. Long-press or tap Copy Text to save to clipboard.", "info");
      this.game.showToast("Save JSON ready in text box below!");
    }

    if (this.game.audio) this.game.audio.playCoin();
  }

  openImportMode() {
    const panel = document.getElementById("save-data-panel");
    const title = document.getElementById("save-data-panel-title");
    const textarea = document.getElementById("save-data-json-text");
    const confirmBtn = document.getElementById("btn-confirm-import");

    if (panel) panel.style.display = "block";
    if (title) title.innerText = "IMPORT / RESTORE SAVE DATA";
    if (confirmBtn) confirmBtn.style.display = "inline-flex";
    if (textarea) {
      textarea.value = "";
      textarea.placeholder = "Paste your backup save JSON string here and tap APPLY RESTORE...";
      textarea.readOnly = false;
      textarea.focus();
    }

    this.showFeedback("Paste your save JSON in the box above and tap 'APPLY RESTORE'. Your progress will update immediately.", "info");
  }

  hideSavePanel() {
    const panel = document.getElementById("save-data-panel");
    if (panel) panel.style.display = "none";
    this.hideFeedback();
  }

  async copyTextareaContent() {
    const textarea = document.getElementById("save-data-json-text");
    if (!textarea || !textarea.value.trim()) {
      this.showFeedback("No save text to copy. Tap 'Export Save (Copy)' first.", "warning");
      return;
    }
    textarea.focus();
    textarea.select();
    const success = await this.copyToClipboard(textarea.value, textarea);
    if (success) {
      this.showFeedback("✓ Save JSON copied to clipboard!", "success");
      this.game.showToast("Copied to clipboard! 📋");
    } else {
      this.showFeedback("Please select and copy text manually from the box.", "info");
    }
  }

  /**
   * Resilient clipboard copy with multiple fallbacks for Android WebView
   */
  async copyToClipboard(text, fallbackElement) {
    let success = false;

    // Method 1: Modern navigator.clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch (err) {
        console.warn("navigator.clipboard failed, attempting fallback:", err);
      }
    }

    // Method 2: document.execCommand('copy') via textarea selection
    if (!success) {
      try {
        let el = fallbackElement;
        let tempCreated = false;
        if (!el) {
          el = document.createElement("textarea");
          el.value = text;
          el.style.position = "fixed";
          el.style.left = "-9999px";
          el.style.top = "0";
          document.body.appendChild(el);
          tempCreated = true;
        }
        el.focus();
        el.select();
        el.setSelectionRange(0, 99999);
        success = document.execCommand("copy");
        if (tempCreated) {
          document.body.removeChild(el);
        }
      } catch (err) {
        console.warn("execCommand fallback failed:", err);
      }
    }

    return success;
  }

  confirmImportData() {
    const textarea = document.getElementById("save-data-json-text");
    if (!textarea || !textarea.value.trim()) {
      this.showFeedback("Please paste valid save JSON into the text box.", "error");
      return;
    }

    const raw = textarea.value.trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this.showFeedback("⚠️ JSON Parse Error: The pasted text is not valid JSON.", "error");
      return;
    }

    // Validate save data schema
    const validation = this.validateSaveData(parsed);
    if (!validation.valid) {
      this.showFeedback(`⚠️ Invalid Save Data: ${validation.error}`, "error");
      return;
    }

    // Apply to game instance
    const applied = this.game.applyImportedSave(parsed);
    if (applied) {
      this.showFeedback("🎉 Progress restored successfully! Coins, levels, skins & missions updated.", "success");
      this.game.showToast("Save Data Restored Successfully! 🎉");
      if (this.game.audio) this.game.audio.playMissionComplete();
      textarea.value = JSON.stringify(parsed, null, 2);
      const confirmBtn = document.getElementById("btn-confirm-import");
      if (confirmBtn) confirmBtn.style.display = "none";
      const title = document.getElementById("save-data-panel-title");
      if (title) title.innerText = "RESTORED SAVE PROGRESS";
    } else {
      this.showFeedback("⚠️ Failed to apply imported save data.", "error");
    }
  }

  validateSaveData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { valid: false, error: "Root content must be an object." };
    }

    // Check types
    if (data.coins !== undefined && (typeof data.coins !== "number" || isNaN(data.coins) || data.coins < 0)) {
      return { valid: false, error: "Invalid 'coins' value." };
    }
    if (data.level !== undefined && (typeof data.level !== "number" || isNaN(data.level) || data.level < 1)) {
      return { valid: false, error: "Invalid 'level' value." };
    }
    if (data.xp !== undefined && (typeof data.xp !== "number" || isNaN(data.xp) || data.xp < 0)) {
      return { valid: false, error: "Invalid 'xp' value." };
    }
    if (data.upgrades && typeof data.upgrades !== "object") {
      return { valid: false, error: "Invalid 'upgrades' structure." };
    }
    if (data.unlockedSkins && !Array.isArray(data.unlockedSkins)) {
      return { valid: false, error: "Invalid 'unlockedSkins' list." };
    }

    return { valid: true };
  }

  showFeedback(message, type = "info") {
    const fb = document.getElementById("save-data-feedback");
    if (!fb) return;
    fb.style.display = "block";
    fb.className = `save-feedback-msg save-feedback-${type}`;
    fb.innerText = message;
  }

  hideFeedback() {
    const fb = document.getElementById("save-data-feedback");
    if (fb) fb.style.display = "none";
  }
}
