// TOM FIGHT - Main Game Controller, Camera Follow, Save System & UI
class TomFightGame {
  constructor() {
    this.container = document.getElementById("game-container");
    this.canvas = document.getElementById("webgl-canvas");

    // Progression & Stats
    this.coins = 100; // Starting bonus
    this.level = 1;
    this.xp = 0;
    this.xpNext = 200;
    this.upgrades = {
      hpTier: 0,
      attackTier: 0,
      specialTier: 0
    };
    this.unlockedSkins = ["classic_red"];
    this.currentSkin = "classic_red";

    // Graphics & Settings
    this.graphicsQuality = "medium"; // low, medium, high
    this.cameraSensitivity = 1.0;
    this.showFpsOverlay = false;
    this.isPaused = false;
    this.isInMainMenu = true;

    // Performance Monitoring Metrics (FPS & Frame Time)
    this.fpsFrameCount = 0;
    this.fpsLastTime = performance.now();
    this.currentFps = 60;
    this.currentFrameMs = 16.6;

    // Daily Reward Tracking
    this.lastLoginDate = "";
    this.loginStreak = 1;
    this.dailyRewardPending = null;

    // Load Local Save Data
    this.loadData();

    // Init Three.js Scene, Camera, Renderer
    this.initThree();

    // Audio Engine
    this.audio = new AudioManager();

    // World & Environment
    this.world = new CityWorld(this.scene);

    // Hero Character "Tom"
    this.player = new CharacterTom(this.scene, this.currentSkin);
    this.applyUpgrades();

    // Enemy Pool
    this.enemies = [];

    // Combat System
    this.combat = new CombatSystem(this.scene, this.camera, this.audio);

    // Mission Manager
    this.missions = new MissionManager(this);
    if (this.savedCompletedMissions) {
      this.missions.completedMissions = new Set(this.savedCompletedMissions);
    }
    if (this.savedUnlockedMissions) {
      this.missions.unlockedMissions = new Set(this.savedUnlockedMissions);
    }
    if (this.missions.tracker) {
      if (this.savedDailyMissionStreak !== undefined) {
        this.missions.tracker.dailyMissionStreak = this.savedDailyMissionStreak;
      }
      if (this.savedLastMissionCompletedDate) {
        this.missions.tracker.lastMissionCompletedDate = this.savedLastMissionCompletedDate;
      }
      if (this.savedCompletedMissionDates) {
        this.missions.tracker.completedMissionDates = new Set(this.savedCompletedMissionDates);
      }
    }
    if (this.savedGeneratedMissions && Array.isArray(this.savedGeneratedMissions) && this.savedGeneratedMissions.length > 0) {
      this.missions.generatedMissions = this.savedGeneratedMissions;
      this.savedGeneratedMissions.forEach(b => this.missions.unlockedMissions.add(b.id));
    }

    // Daily Mission System (3 Specific Randomized Tasks Each Day)
    this.dailyMissions = (typeof DailyMissionManager !== "undefined")
      ? new DailyMissionManager(this)
      : null;
    if (this.savedDailyMissions && this.dailyMissions && this.savedDailyMissions.date === this.dailyMissions.getTodayDateString()) {
      if (Array.isArray(this.savedDailyMissions.tasks) && this.savedDailyMissions.tasks.length === 3) {
        this.dailyMissions.tasks = this.savedDailyMissions.tasks;
        this.dailyMissions.allBonusClaimed = !!this.savedDailyMissions.allBonusClaimed;
      }
    }

    const hudDailyTag = document.getElementById("hud-daily-tag");
    if (hudDailyTag) {
      hudDailyTag.onclick = () => this.openMissionsModal();
    }

    // Input Controls
    this.controls = new InputControls(this);

    // Real-Time 2D Mini-Map UI Component
    this.minimap = new MiniMap(this);

    // Third-Person Camera State
    this.cameraYaw = 0;
    this.cameraPitch = 0.28;
    this.cameraDist = 5.2;
    this.targetCameraLookAt = new THREE.Vector3();
    this.currentCameraPos = new THREE.Vector3();

    // Photo Mode Manager
    this.isPhotoMode = false;
    if (typeof PhotoModeManager !== "undefined") {
      this.photoMode = new PhotoModeManager(this);
    }

    // Setup UI bindings & listeners
    this.bindUI();

    // Check Daily Login Reward
    this.checkDailyReward();

    // Initial HUD update
    this.updateHUD();
    if (this.missions) this.missions.updateHUD();

    // Clock & Start Loop
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    this.scene = new THREE.Scene();

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.2, 300);
    this.camera.position.set(0, 4, 8);

    // Resilient WebGL initialization compatible with Android emulators and devices
    // Handles environments where hardware rendernode is absent (falling back to swiftshader/software GL)
    const contextOptions = [
      { antialias: false, powerPreference: "default", failIfMajorPerformanceCaveat: false, alpha: false, preserveDrawingBuffer: true },
      { antialias: false, powerPreference: "low-power", failIfMajorPerformanceCaveat: false, alpha: false, preserveDrawingBuffer: true },
      { antialias: false, failIfMajorPerformanceCaveat: false },
      { antialias: false }
    ];

    let rendererInitialized = false;
    for (const opts of contextOptions) {
      try {
        const gl = this.canvas.getContext("webgl2", opts) ||
                   this.canvas.getContext("webgl", opts) ||
                   this.canvas.getContext("experimental-webgl", opts);

        if (gl) {
          this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            context: gl,
            ...opts
          });
          rendererInitialized = true;
          break;
        }
      } catch (err) {
        console.warn("Attempting WebGL context fallback:", err);
      }
    }

    if (!rendererInitialized) {
      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          antialias: false,
          failIfMajorPerformanceCaveat: false
        });
      } catch (finalErr) {
        console.warn("Final WebGL initialization fallback:", finalErr);
      }
    }

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1.0, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // WebGL Context recovery listeners
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      console.warn("WebGL context lost");
    }, false);

    window.addEventListener("resize", () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  // LocalStorage Persistence
  saveData() {
    try {
      const data = {
        coins: this.coins,
        level: this.level,
        xp: this.xp,
        upgrades: this.upgrades,
        unlockedSkins: this.unlockedSkins,
        currentSkin: this.currentSkin,
        completedMissions: Array.from(this.missions.completedMissions),
        unlockedMissions: Array.from(this.missions.unlockedMissions),
        graphicsQuality: this.graphicsQuality,
        cameraSensitivity: this.cameraSensitivity,
        showFpsOverlay: this.showFpsOverlay,
        lastLoginDate: this.lastLoginDate,
        loginStreak: this.loginStreak,
        dailyMissionStreak: this.missions?.tracker?.dailyMissionStreak ?? (this.savedDailyMissionStreak || 0),
        lastMissionCompletedDate: this.missions?.tracker?.lastMissionCompletedDate ?? (this.savedLastMissionCompletedDate || null),
        completedMissionDates: this.missions?.tracker ? Array.from(this.missions.tracker.completedMissionDates) : (this.savedCompletedMissionDates || []),
        generatedMissions: this.missions?.generatedMissions ?? (this.savedGeneratedMissions || []),
        dailyMissions: this.dailyMissions ? {
          date: this.dailyMissions.currentDate,
          tasks: this.dailyMissions.tasks,
          allBonusClaimed: this.dailyMissions.allBonusClaimed
        } : null
      };
      localStorage.setItem("tom_fight_save_v1", JSON.stringify(data));
    } catch (e) {
      console.warn("Save game error:", e);
    }
  }

  loadData() {
    try {
      const raw = localStorage.getItem("tom_fight_save_v1");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.coins !== undefined) this.coins = data.coins;
      if (data.level !== undefined) this.level = data.level;
      if (data.xp !== undefined) this.xp = data.xp;
      if (data.upgrades) this.upgrades = data.upgrades;
      if (data.unlockedSkins) this.unlockedSkins = data.unlockedSkins;
      if (data.currentSkin) this.currentSkin = data.currentSkin;
      if (data.graphicsQuality) this.graphicsQuality = data.graphicsQuality;
      if (data.cameraSensitivity) this.cameraSensitivity = data.cameraSensitivity;
      if (data.showFpsOverlay !== undefined) this.showFpsOverlay = Boolean(data.showFpsOverlay);
      if (data.lastLoginDate) this.lastLoginDate = data.lastLoginDate;
      if (data.loginStreak) this.loginStreak = data.loginStreak;
      if (data.completedMissions && Array.isArray(data.completedMissions)) {
        this.savedCompletedMissions = data.completedMissions;
        if (this.missions) this.missions.completedMissions = new Set(data.completedMissions);
      }
      if (data.unlockedMissions && Array.isArray(data.unlockedMissions)) {
        this.savedUnlockedMissions = data.unlockedMissions;
        if (this.missions) this.missions.unlockedMissions = new Set(data.unlockedMissions);
      }
      if (data.dailyMissionStreak !== undefined) {
        this.savedDailyMissionStreak = Number(data.dailyMissionStreak) || 0;
        if (this.missions?.tracker) this.missions.tracker.dailyMissionStreak = this.savedDailyMissionStreak;
      }
      if (data.lastMissionCompletedDate) {
        this.savedLastMissionCompletedDate = data.lastMissionCompletedDate;
        if (this.missions?.tracker) this.missions.tracker.lastMissionCompletedDate = data.lastMissionCompletedDate;
      }
      if (data.completedMissionDates && Array.isArray(data.completedMissionDates)) {
        this.savedCompletedMissionDates = data.completedMissionDates;
        if (this.missions?.tracker) this.missions.tracker.completedMissionDates = new Set(data.completedMissionDates);
      }
      if (data.generatedMissions && Array.isArray(data.generatedMissions)) {
        this.savedGeneratedMissions = data.generatedMissions;
        if (this.missions) {
          this.missions.generatedMissions = data.generatedMissions;
          data.generatedMissions.forEach(b => this.missions.unlockedMissions.add(b.id));
        }
      }
      if (data.dailyMissions && typeof data.dailyMissions === "object") {
        this.savedDailyMissions = data.dailyMissions;
        if (this.dailyMissions && data.dailyMissions.date === this.dailyMissions.getTodayDateString()) {
          if (Array.isArray(data.dailyMissions.tasks) && data.dailyMissions.tasks.length === 3) {
            this.dailyMissions.tasks = data.dailyMissions.tasks;
            this.dailyMissions.allBonusClaimed = !!data.dailyMissions.allBonusClaimed;
          }
        }
      }
    } catch (e) {
      console.warn("Load game error:", e);
    }
  }

  getSavePayload() {
    return {
      version: 1,
      exportDate: new Date().toISOString(),
      coins: this.coins,
      level: this.level,
      xp: this.xp,
      upgrades: { ...this.upgrades },
      unlockedSkins: [...this.unlockedSkins],
      currentSkin: this.currentSkin,
      completedMissions: this.missions ? Array.from(this.missions.completedMissions) : (this.savedCompletedMissions || []),
      unlockedMissions: this.missions ? Array.from(this.missions.unlockedMissions) : (this.savedUnlockedMissions || [1]),
      graphicsQuality: this.graphicsQuality,
      cameraSensitivity: this.cameraSensitivity,
      showFpsOverlay: this.showFpsOverlay,
      lastLoginDate: this.lastLoginDate,
      loginStreak: this.loginStreak,
      dailyMissionStreak: this.missions?.tracker?.dailyMissionStreak ?? (this.savedDailyMissionStreak || 0),
      lastMissionCompletedDate: this.missions?.tracker?.lastMissionCompletedDate ?? (this.savedLastMissionCompletedDate || null),
      completedMissionDates: this.missions?.tracker ? Array.from(this.missions.tracker.completedMissionDates) : (this.savedCompletedMissionDates || []),
      generatedMissions: this.missions?.generatedMissions ?? (this.savedGeneratedMissions || []),
      dailyMissions: this.dailyMissions ? {
        date: this.dailyMissions.currentDate,
        tasks: this.dailyMissions.tasks,
        allBonusClaimed: this.dailyMissions.allBonusClaimed
      } : null
    };
  }

  applyImportedSave(data) {
    try {
      if (data.coins !== undefined) this.coins = Math.max(0, Math.round(data.coins));
      if (data.level !== undefined) this.level = Math.max(1, Math.round(data.level));
      if (data.xp !== undefined) this.xp = Math.max(0, Math.round(data.xp));

      this.xpNext = 100;
      for (let i = 1; i < this.level; i++) {
        this.xpNext = Math.round(this.xpNext * 1.5);
      }

      if (data.upgrades && typeof data.upgrades === "object") {
        this.upgrades.hpTier = Math.max(0, Math.min(5, data.upgrades.hpTier ?? 0));
        this.upgrades.attackTier = Math.max(0, Math.min(5, data.upgrades.attackTier ?? 0));
        this.upgrades.specialTier = Math.max(0, Math.min(5, data.upgrades.specialTier ?? 0));
        this.applyUpgrades();
      }

      if (Array.isArray(data.unlockedSkins) && data.unlockedSkins.length > 0) {
        this.unlockedSkins = Array.from(new Set(data.unlockedSkins));
      }
      if (data.currentSkin && typeof data.currentSkin === "string") {
        this.currentSkin = data.currentSkin;
        if (this.player && this.player.setSkin) {
          this.player.setSkin(this.currentSkin);
        }
      }

      if (this.missions) {
        if (Array.isArray(data.completedMissions)) {
          this.missions.completedMissions = new Set(data.completedMissions);
        }
        if (Array.isArray(data.unlockedMissions)) {
          this.missions.unlockedMissions = new Set(data.unlockedMissions);
        }
        if (data.dailyMissionStreak !== undefined && this.missions.tracker) {
          this.missions.tracker.dailyMissionStreak = Number(data.dailyMissionStreak) || 0;
        }
        if (data.lastMissionCompletedDate && this.missions.tracker) {
          this.missions.tracker.lastMissionCompletedDate = data.lastMissionCompletedDate;
        }
        if (Array.isArray(data.completedMissionDates) && this.missions.tracker) {
          this.missions.tracker.completedMissionDates = new Set(data.completedMissionDates);
        }
        if (Array.isArray(data.generatedMissions)) {
          this.missions.generatedMissions = data.generatedMissions;
          data.generatedMissions.forEach(b => this.missions.unlockedMissions.add(b.id));
        }
        this.missions.updateHUD();
      }

      if (data.dailyMissions && this.dailyMissions && data.dailyMissions.date === this.dailyMissions.getTodayDateString()) {
        if (Array.isArray(data.dailyMissions.tasks) && data.dailyMissions.tasks.length === 3) {
          this.dailyMissions.tasks = data.dailyMissions.tasks;
          this.dailyMissions.allBonusClaimed = !!data.dailyMissions.allBonusClaimed;
          this.dailyMissions.refreshUIIfVisible();
        }
      }

      if (data.graphicsQuality) {
        this.setQuality(data.graphicsQuality);
        const qualSelect = document.getElementById("setting-quality");
        if (qualSelect) qualSelect.value = this.graphicsQuality;
      }

      if (data.showFpsOverlay !== undefined) {
        this.toggleFpsOverlay(Boolean(data.showFpsOverlay));
        const fpsToggle = document.getElementById("setting-fps-toggle");
        if (fpsToggle) fpsToggle.checked = this.showFpsOverlay;
      }

      if (data.lastLoginDate) this.lastLoginDate = data.lastLoginDate;
      if (data.loginStreak) this.loginStreak = data.loginStreak;

      // Save into storage
      this.saveData();

      // Refresh HUD and Modals
      this.updateHUD();
      this.updateShopUI();
      return true;
    } catch (err) {
      console.error("applyImportedSave failed:", err);
      return false;
    }
  }

  applyUpgrades() {
    // Each HP tier gives +25 max HP
    this.player.maxHp = 100 + this.upgrades.hpTier * 25;
    this.player.hp = this.player.maxHp;

    // Each Attack tier gives +5 base attack power
    this.player.attackPower = 20 + this.upgrades.attackTier * 5;

    // Each Special tier gives +15 special power
    this.player.specialPower = 65 + this.upgrades.specialTier * 15;
  }

  addCoins(amount) {
    this.coins += amount;
    this.updateHUD();
    this.saveData();
  }

  addXP(amount) {
    this.xp += amount;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(this.xpNext * 1.5);
      this.player.maxHp += 15;
      this.player.hp = this.player.maxHp;
      this.audio.playMissionComplete();
      this.showToast(`LEVEL UP! You are now Level ${this.level}!`);
    }
    this.updateHUD();
    this.saveData();
  }

  spawnEnemy(type, x, z) {
    const enemy = new Enemy(this.scene, type, { x, z }, Date.now() + Math.random());
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
  }

  bindUI() {
    // Main Menu Buttons
    const btnPlay = document.getElementById("btn-menu-play");
    const btnMissions = document.getElementById("btn-menu-missions");
    const btnShop = document.getElementById("btn-menu-shop");
    const btnSettings = document.getElementById("btn-menu-settings");
    const mainMenuScreen = document.getElementById("main-menu-screen");

    if (btnPlay) {
      btnPlay.addEventListener("click", () => {
        this.audio.ensureContext();
        this.audio.startMusic();
        this.isInMainMenu = false;
        if (mainMenuScreen) mainMenuScreen.style.display = "none";
        this.showToast("Welcome to TOM FIGHT! Explore or visit glowing beacons!");
      });
    }

    if (btnMissions) {
      btnMissions.addEventListener("click", () => {
        this.openMissionsModal();
      });
    }

    if (btnShop) {
      btnShop.addEventListener("click", () => {
        this.openShopModal();
      });
    }

    if (btnSettings) {
      btnSettings.addEventListener("click", () => {
        this.openSettingsModal();
      });
    }

    // Top Right HUD Buttons
    const btnPause = document.getElementById("btn-pause");
    const btnHudShop = document.getElementById("btn-hud-shop");
    const btnHudMissions = document.getElementById("btn-hud-missions");

    if (btnPause) btnPause.addEventListener("click", () => this.togglePause());
    if (btnHudShop) btnHudShop.addEventListener("click", () => this.openShopModal());
    if (btnHudMissions) btnHudMissions.addEventListener("click", () => this.openMissionsModal());

    // Pause Modal Buttons
    const btnResume = document.getElementById("btn-pause-resume");
    const btnRestart = document.getElementById("btn-pause-restart");
    const btnQuitMenu = document.getElementById("btn-pause-quit");

    if (btnResume) btnResume.addEventListener("click", () => this.togglePause());
    if (btnRestart) {
      btnRestart.addEventListener("click", () => {
        this.restartGame();
        this.togglePause();
      });
    }
    if (btnQuitMenu) {
      btnQuitMenu.addEventListener("click", () => {
        this.togglePause();
        this.isInMainMenu = true;
        if (mainMenuScreen) mainMenuScreen.style.display = "flex";
      });
    }

    // Mission Complete Buttons
    const btnContinue = document.getElementById("btn-complete-continue");
    if (btnContinue) {
      btnContinue.addEventListener("click", () => {
        const modal = document.getElementById("mission-complete-modal");
        if (modal) modal.style.display = "none";
      });
    }

    // Daily Reward Claim Button
    const btnClaimDaily = document.getElementById("btn-claim-daily");
    if (btnClaimDaily) {
      btnClaimDaily.addEventListener("click", () => {
        this.claimDailyReward();
      });
    }

    // Defeat Screen Buttons
    const btnRespawn = document.getElementById("btn-defeat-respawn");
    if (btnRespawn) {
      btnRespawn.addEventListener("click", () => {
        this.respawnPlayer();
        const defeatModal = document.getElementById("defeat-modal");
        if (defeatModal) defeatModal.style.display = "none";
      });
    }

    // Modal Close Buttons
    document.querySelectorAll(".close-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const modal = e.target.closest(".modal-overlay");
        if (modal) modal.style.display = "none";
      });
    });

    // Interaction Prompt Click
    const promptEl = document.getElementById("interaction-prompt");
    if (promptEl) {
      promptEl.addEventListener("click", () => {
        if (this.nearbyBeacon) {
          this.missions.startMission(this.nearbyBeacon.id);
          promptEl.style.display = "none";
          this.showToast(`Started: ${this.nearbyBeacon.name}!`);
        }
      });
    }

    this.bindShopUI();
    if (typeof SettingsManager !== "undefined") {
      this.settings = new SettingsManager(this);
    } else {
      this.bindSettingsUI();
    }
    this.updateHUD();
  }

  bindShopUI() {
    const bindUpgrade = (btnId, key, baseCost, costMult, maxTier) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener("click", () => {
        const tier = this.upgrades[key];
        const cost = Math.round(baseCost * Math.pow(costMult, tier));
        if (tier < maxTier && this.coins >= cost) {
          this.coins -= cost;
          this.upgrades[key]++;
          this.applyUpgrades();
          this.audio.playCoin();
          this.saveData();
          this.updateShopUI();
          this.updateHUD();
        }
      });
    };

    bindUpgrade("btn-buy-hp", "hpTier", 80, 1.6, 5);
    bindUpgrade("btn-buy-atk", "attackTier", 100, 1.8, 5);
    bindUpgrade("btn-buy-sp", "specialTier", 120, 2.0, 5);

    // Skins
    const skinButtons = [
      { id: "skin-card-classic", key: "classic_red", cost: 0 },
      { id: "skin-card-ninja", key: "shadow_ninja", cost: 200 },
      { id: "skin-card-cyber", key: "cyber_gold", cost: 350 },
      { id: "skin-card-neon", key: "neon_blue", cost: 500 }
    ];

    skinButtons.forEach(s => {
      const card = document.getElementById(s.id);
      if (!card) return;
      card.addEventListener("click", () => {
        if (this.unlockedSkins.includes(s.key)) {
          this.currentSkin = s.key;
          this.player.setSkin(s.key);
          this.saveData();
          this.updateShopUI();
        } else if (this.coins >= s.cost) {
          this.coins -= s.cost;
          this.unlockedSkins.push(s.key);
          this.currentSkin = s.key;
          this.player.setSkin(s.key);
          this.audio.playCoin();
          this.saveData();
          this.updateShopUI();
          this.updateHUD();
        }
      });
    });
  }

  updateShopUI() {
    const updateTier = (tierId, costId, btnId, key, baseCost, costMult, maxTier) => {
      const tierEl = document.getElementById(tierId);
      const costEl = document.getElementById(costId);
      const btn = document.getElementById(btnId);
      const tier = this.upgrades[key];
      const cost = Math.round(baseCost * Math.pow(costMult, tier));

      if (tierEl) tierEl.innerText = `Level ${tier}/${maxTier}`;
      if (costEl) costEl.innerText = tier >= maxTier ? "MAX" : `${cost} Coins`;
      if (btn) btn.disabled = (tier >= maxTier || this.coins < cost);
    };

    updateTier("hp-tier-text", "hp-cost-text", "btn-buy-hp", "hpTier", 80, 1.6, 5);
    updateTier("atk-tier-text", "atk-cost-text", "btn-buy-atk", "attackTier", 100, 1.8, 5);
    updateTier("sp-tier-text", "sp-cost-text", "btn-buy-sp", "specialTier", 120, 2.0, 5);

    // Update Skin selection highlights
    ["classic_red", "shadow_ninja", "cyber_gold", "neon_blue"].forEach(k => {
      const card = document.getElementById(`skin-card-${k.split("_")[0]}`);
      if (card) {
        if (this.currentSkin === k) card.classList.add("selected");
        else card.classList.remove("selected");
      }
    });
  }

  openShopModal() {
    this.updateShopUI();
    const modal = document.getElementById("shop-modal");
    if (modal) modal.style.display = "flex";
  }

  openMissionsModal() {
    this.missionDifficultyFilter = this.missionDifficultyFilter || "all";

    // 1. Render Persistent Daily Mission Streak Calendar Widget
    const calEl = document.getElementById("mission-streak-calendar");
    if (calEl && this.missions && this.missions.tracker) {
      this.missions.tracker.renderCalendarWidget(calEl);
    }

    // 2. Render Daily Missions (3 Randomized Tasks System)
    const dailyEl = document.getElementById("daily-missions-container");
    if (dailyEl && this.dailyMissions) {
      this.dailyMissions.renderDailyMissions(dailyEl);
    }

    // 3. Wire Difficulty Filter Buttons (ALL, EASY, HARD, BOSS)
    const filterBtns = document.querySelectorAll(".diff-filter-btn");
    filterBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.missionDifficultyFilter = btn.dataset.difficulty || "all";
        this.renderMissionsList();
      };
    });

    // 3. Wire Refresh Bounties Button
    const refreshBtn = document.getElementById("btn-refresh-bounties");
    if (refreshBtn) {
      refreshBtn.onclick = (e) => {
        e.stopPropagation();
        if (this.missions) {
          this.missions.generateBountyMissions(true);
          this.saveData();
          if (this.audio) this.audio.playCoin();
          this.showToast("🎲 Generated fresh Easy, Hard & Boss bounty missions!");
          this.renderMissionsList();
        }
      };
    }

    // 4. Render Mission List matching current difficulty filter
    this.renderMissionsList();

    const modal = document.getElementById("missions-modal");
    if (modal) modal.style.display = "flex";
  }

  renderMissionsList() {
    const list = document.getElementById("missions-modal-list");
    if (!list || !this.missions) return;
    list.innerHTML = "";

    const filter = (this.missionDifficultyFilter || "all").toLowerCase();
    const allMissions = [
      ...this.missions.missionDefs,
      ...(this.missions.generatedMissions || [])
    ];

    const filtered = allMissions.filter(m => {
      if (filter === "all") return true;
      const mDiff = (m.difficulty || "Easy").toLowerCase();
      return mDiff === filter;
    });

    if (filtered.length === 0) {
      list.innerHTML = `<div class="missions-empty-notice">No missions found matching difficulty: ${filter.toUpperCase()}</div>`;
      return;
    }

    filtered.forEach(m => {
      const isCompleted = this.missions.completedMissions.has(m.id);
      const isUnlocked = this.missions.unlockedMissions.has(m.id);
      const isActive = this.missions.currentMission && this.missions.currentMission.id === m.id;
      const diff = m.difficulty || "Easy";
      const diffLower = diff.toLowerCase();
      const isBounty = m.id >= 100;

      let diffIcon = "🟢";
      if (diffLower === "hard") diffIcon = "🟠";
      if (diffLower === "boss") diffIcon = "🔴";

      const item = document.createElement("div");
      item.className = `mission-item mission-diff-${diffLower} ${!isUnlocked ? "locked" : ""} ${isActive ? "active" : ""}`;
      item.innerHTML = `
        <div class="mission-details-col">
          <div class="mission-title-row">
            <span class="diff-badge diff-badge-${diffLower}">${diffIcon} ${diff.toUpperCase()}</span>
            <span class="mission-type-pill ${isBounty ? "pill-bounty" : "pill-campaign"}">${isBounty ? "DAILY BOUNTY" : "CAMPAIGN"}</span>
            <span class="mission-details-title">${m.title} ${isCompleted ? "✓" : ""}</span>
          </div>
          <div class="mission-details-desc">${m.desc}</div>
          <div class="mission-details-reward">
            <span class="reward-coins">🪙 +${m.coins} Coins</span>
            <span class="reward-xp">⭐ +${m.xp} EXP</span>
          </div>
        </div>
        <button class="btn-buy ${isActive ? "active-btn" : ""}" ${!isUnlocked || isActive ? "disabled" : ""}>
          ${isActive ? "ACTIVE" : (isCompleted ? "REPLAY" : (isUnlocked ? "START" : "LOCKED"))}
        </button>
      `;

      if (isUnlocked && !isActive) {
        item.querySelector("button").addEventListener("click", () => {
          this.missions.startMission(m.id);
          document.getElementById("missions-modal").style.display = "none";
          if (this.isInMainMenu) {
            document.getElementById("main-menu-screen").style.display = "none";
            this.isInMainMenu = false;
            this.audio.startMusic();
          }
          this.showToast(`Started [${diff.toUpperCase()}]: ${m.title}!`);
        });
      }

      list.appendChild(item);
    });
  }

  bindSettingsUI() {
    const masterSlider = document.getElementById("setting-master-vol");
    const sfxSlider = document.getElementById("setting-sfx-vol");
    const musicSlider = document.getElementById("setting-music-vol");
    const qualSelect = document.getElementById("setting-quality");

    if (masterSlider) {
      masterSlider.addEventListener("input", (e) => {
        this.audio.setVolumes(parseFloat(e.target.value), this.audio.sfxVolume, this.audio.musicVolume);
      });
    }
    if (sfxSlider) {
      sfxSlider.addEventListener("input", (e) => {
        this.audio.setVolumes(this.audio.masterVolume, parseFloat(e.target.value), this.audio.musicVolume);
      });
    }
    if (musicSlider) {
      musicSlider.addEventListener("input", (e) => {
        this.audio.setVolumes(this.audio.masterVolume, this.audio.sfxVolume, parseFloat(e.target.value));
      });
    }
    if (qualSelect) {
      qualSelect.value = this.graphicsQuality;
      qualSelect.addEventListener("change", (e) => {
        this.setQuality(e.target.value);
      });
    }

    const fpsToggle = document.getElementById("setting-fps-toggle");
    if (fpsToggle) {
      fpsToggle.checked = this.showFpsOverlay;
      fpsToggle.addEventListener("change", (e) => {
        this.toggleFpsOverlay(e.target.checked);
      });
    }

    // Initialize overlay visibility according to saved preference
    this.updatePerfOverlayVisibility();
  }

  toggleFpsOverlay(enabled) {
    this.showFpsOverlay = Boolean(enabled);
    this.saveData();
    this.updatePerfOverlayVisibility();
  }

  updatePerfOverlayVisibility() {
    const overlay = document.getElementById("perf-overlay");
    if (overlay) {
      overlay.style.display = this.showFpsOverlay ? "flex" : "none";
    }
  }

  updatePerfOverlay(delta) {
    if (!this.showFpsOverlay) return;

    this.fpsFrameCount++;
    const now = performance.now();
    const elapsed = now - this.fpsLastTime;

    // Update FPS numbers every 300ms for stable readability
    if (elapsed >= 300) {
      this.currentFps = Math.round((this.fpsFrameCount * 1000) / elapsed);
      this.currentFrameMs = (elapsed / this.fpsFrameCount).toFixed(1);
      this.fpsFrameCount = 0;
      this.fpsLastTime = now;

      const overlay = document.getElementById("perf-overlay");
      const fpsValEl = document.getElementById("perf-fps-val");
      const msValEl = document.getElementById("perf-ms-val");

      if (fpsValEl) {
        fpsValEl.innerText = this.currentFps;
      }
      if (msValEl) {
        msValEl.innerText = `${this.currentFrameMs}ms`;
      }

      if (overlay) {
        // Color coding: Green >= 50, Yellow 30-49, Red < 30
        overlay.classList.remove("perf-warn", "perf-crit");
        if (this.currentFps < 30) {
          overlay.classList.add("perf-crit");
        } else if (this.currentFps < 50) {
          overlay.classList.add("perf-warn");
        }
      }
    }
  }

  setQuality(level) {
    this.graphicsQuality = level;
    if (level === "low") {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(1.0);
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, level === "high" ? 2.0 : 1.5));
    }
    this.saveData();
  }

  openSettingsModal() {
    const modal = document.getElementById("settings-modal");
    if (modal) modal.style.display = "flex";
  }

  /**
   * Daily Reward System:
   * Compares today's date (YYYY-MM-DD) against the stored lastLoginDate in localStorage.
   * If a new day is detected, calculates the login streak bonus and shows a celebration modal.
   */
  checkDailyReward() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    if (this.lastLoginDate === todayStr) {
      // Already claimed today
      return;
    }

    // Determine streak (consecutive calendar day check)
    let newStreak = 1;
    if (this.lastLoginDate) {
      const lastDate = new Date(this.lastLoginDate);
      const diffTime = today.setHours(0,0,0,0) - lastDate.setHours(0,0,0,0);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak = Math.min(7, (this.loginStreak || 1) + 1);
      } else if (diffDays > 1) {
        newStreak = 1; // Reset streak if missed a day
      }
    }

    // Base bonus: 100 coins, plus +30 coins per streak day (up to 280 coins on Day 7)
    const rewardCoins = 100 + (newStreak - 1) * 30;

    this.dailyRewardPending = {
      date: todayStr,
      streak: newStreak,
      coins: rewardCoins
    };

    // Show popup notification
    setTimeout(() => {
      this.showDailyRewardModal();
    }, 600);
  }

  showDailyRewardModal() {
    if (!this.dailyRewardPending) return;

    const modal = document.getElementById("daily-reward-modal");
    const streakText = document.getElementById("daily-streak-text");
    const amountText = document.getElementById("daily-reward-amount");

    if (streakText) {
      streakText.innerText = `DAY ${this.dailyRewardPending.streak} STREAK 🔥`;
    }
    if (amountText) {
      amountText.innerText = `+${this.dailyRewardPending.coins} COINS`;
    }

    if (modal) {
      modal.style.display = "flex";
      if (this.audio) this.audio.playMissionComplete();
    }
  }

  claimDailyReward() {
    if (!this.dailyRewardPending) return;

    const { date, streak, coins } = this.dailyRewardPending;
    this.lastLoginDate = date;
    this.loginStreak = streak;

    // Grant bonus coins and update save
    this.addCoins(coins);
    this.saveData();

    const modal = document.getElementById("daily-reward-modal");
    if (modal) modal.style.display = "none";

    if (this.audio) this.audio.playCoin();
    this.showToast(`Claimed +${coins} Daily Coins! Day ${streak} streak active!`);

    this.dailyRewardPending = null;
  }

  togglePause() {
    if (this.isPhotoMode && this.photoMode) {
      this.photoMode.exit();
      return;
    }
    this.isPaused = !this.isPaused;
    const modal = document.getElementById("pause-modal");
    if (modal) modal.style.display = this.isPaused ? "flex" : "none";
  }

  restartGame() {
    this.player.pos.set(0, 0, 0);
    this.player.hp = this.player.maxHp;
    this.player.state = "idle";
    this.missions.abortMission();
    this.clearEnemies();
    this.updateHUD();
  }

  respawnPlayer() {
    this.player.pos.set(0, 0, 0);
    this.player.hp = this.player.maxHp;
    this.player.state = "idle";
    this.missions.abortMission();
    this.clearEnemies();
    this.updateHUD();
  }

  showToast(message) {
    const toast = document.getElementById("tutorial-hint");
    if (!toast) return;
    toast.innerText = message;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 3200);
  }

  updateHUD() {
    const hpFill = document.getElementById("hp-fill");
    const energyFill = document.getElementById("energy-fill");
    const coinCount = document.getElementById("coin-count");
    const levelBadge = document.getElementById("player-level-badge");
    const specialOverlay = document.getElementById("special-cooldown-overlay");

    if (hpFill) {
      const ratio = Math.max(0, this.player.hp / this.player.maxHp);
      hpFill.style.width = `${Math.round(ratio * 100)}%`;
      if (ratio < 0.25) hpFill.classList.add("low");
      else hpFill.classList.remove("low");
    }

    if (energyFill) {
      const eRatio = Math.max(0, this.player.energy / this.player.maxEnergy);
      energyFill.style.width = `${Math.round(eRatio * 100)}%`;
    }

    if (coinCount) coinCount.innerText = this.coins;
    if (levelBadge) levelBadge.innerText = `LV.${this.level}`;

    const hudDailyCounter = document.getElementById("hud-daily-counter");
    if (hudDailyCounter && this.dailyMissions) {
      hudDailyCounter.innerText = `${this.dailyMissions.getCompletedCount()}/3`;
    }

    // Special Cooldown Visual Radial Timer Overlay
    if (specialOverlay) {
      if (this.player.specialCooldown > 0) {
        const maxCooldown = this.player.maxSpecialCooldown || 8.0;
        const remaining = Math.max(0, this.player.specialCooldown);
        const ratio = Math.min(1.0, Math.max(0, remaining / maxCooldown));
        const deg = Math.round(ratio * 360);

        specialOverlay.style.display = "flex";
        // Conic-gradient creates the visual radial cooldown sweep timer
        specialOverlay.style.background = `conic-gradient(rgba(10, 12, 22, 0.85) 0deg, rgba(10, 12, 22, 0.85) ${deg}deg, rgba(234, 179, 8, 0.35) ${deg}deg, transparent ${deg}deg 360deg)`;

        // Precise countdown timer: tenths of a second when < 1.0s for crisp feedback
        specialOverlay.innerText = remaining < 1.0 ? remaining.toFixed(1) : Math.ceil(remaining);

        const btnSpecial = document.getElementById("btn-special");
        if (btnSpecial) btnSpecial.classList.add("on-cooldown");
      } else {
        specialOverlay.style.display = "none";
        specialOverlay.style.background = "";
        specialOverlay.innerText = "";

        const btnSpecial = document.getElementById("btn-special");
        if (btnSpecial) btnSpecial.classList.remove("on-cooldown");
      }
    }

    // Boss / Target HUD
    const bossHud = document.getElementById("boss-hud");
    const bossHpFill = document.getElementById("boss-hp-fill");
    const bossNameEl = document.getElementById("boss-name");

    const bossEnemy = this.enemies.find(e => e.type === "boss" && e.state !== "dead");
    if (bossEnemy && bossHud && bossHpFill && bossNameEl) {
      bossHud.style.display = "block";
      bossNameEl.innerText = bossEnemy.name;
      const bRatio = Math.max(0, bossEnemy.hp / bossEnemy.maxHp);
      bossHpFill.style.width = `${Math.round(bRatio * 100)}%`;
    } else if (bossHud) {
      bossHud.style.display = "none";
    }

    // Keep persistent Task Queue and mission banner synced
    if (this.missions) {
      this.missions.updateHUD();
    }
  }

  // Check Coin Pickups
  checkCoinPickups() {
    this.world.coins.forEach(coin => {
      if (!coin.collected) {
        const dist = this.player.pos.distanceTo(coin.pos);
        if (dist <= 1.4) {
          coin.collected = true;
          coin.mesh.visible = false;
          this.addCoins(10);
          this.audio.playCoin();
          this.combat.spawnDamageNumber(coin.pos, "+10 COINS", false, false);
          if (this.dailyMissions) {
            this.dailyMissions.onCoinCollected();
          }
        }
      }
    });
  }

  // Check Proximity to Mission Beacons
  checkMissionBeacons() {
    const promptEl = document.getElementById("interaction-prompt");
    let foundNearby = null;

    for (let i = 0; i < this.world.missionBeacons.length; i++) {
      const b = this.world.missionBeacons[i];
      const dist = this.player.pos.distanceTo(b.pos);
      if (dist <= 3.2) {
        foundNearby = b;
        break;
      }
    }

    this.nearbyBeacon = foundNearby;
    if (promptEl) {
      if (foundNearby && (!this.missions.currentMission || this.missions.currentMission.id !== foundNearby.id)) {
        promptEl.innerText = `TAP HERE TO START: ${foundNearby.name}`;
        promptEl.style.display = "block";
      } else {
        promptEl.style.display = "none";
      }
    }
  }

  // Update Camera Orbit & Follow
  updateCamera(delta) {
    if (this.isPhotoMode && this.photoMode) {
      this.photoMode.updateCamera(delta);
      return;
    }

    if (this.isInMainMenu) {
      // Gentle cinematic panoramic orbit around city in main menu
      const t = this.clock.getElapsedTime() * 0.2;
      this.camera.position.set(Math.cos(t) * 26, 12, Math.sin(t) * 26);
      this.camera.lookAt(0, 3, 0);
      return;
    }

    // Apply Touch Drag Camera Rotation
    const camDelta = this.controls.consumeCameraDelta();
    this.cameraYaw -= camDelta.x * this.cameraSensitivity;
    this.cameraPitch = Math.max(-0.25, Math.min(0.75, this.cameraPitch + camDelta.y * this.cameraSensitivity));

    // Target look position (Tom's chest level)
    const targetLookAt = this.player.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.targetCameraLookAt.lerp(targetLookAt, 12 * delta);

    // Compute ideal camera position in spherical coordinates behind Tom
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const camOffsetX = Math.sin(this.cameraYaw) * cosPitch * this.cameraDist;
    const camOffsetY = sinPitch * this.cameraDist;
    const camOffsetZ = Math.cos(this.cameraYaw) * cosPitch * this.cameraDist;

    const desiredCamPos = this.targetCameraLookAt.clone().add(
      new THREE.Vector3(camOffsetX, Math.max(0.8, camOffsetY + 1.2), camOffsetZ)
    );

    // Smooth position interpolation
    this.currentCameraPos.lerp(desiredCamPos, 14 * delta);

    // Apply Camera Shake offset
    if (this.combat.shakeIntensity > 0) {
      const s = this.combat.shakeIntensity;
      this.currentCameraPos.x += (Math.random() - 0.5) * s;
      this.currentCameraPos.y += (Math.random() - 0.5) * s;
      this.currentCameraPos.z += (Math.random() - 0.5) * s;
    }

    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.targetCameraLookAt);
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = Math.min(0.1, this.clock.getDelta());
    const elapsedTime = this.clock.getElapsedTime();

    if (!this.isPaused) {
      // 1. World dynamic elements
      this.world.update(delta, elapsedTime);

      if (!this.isInMainMenu) {
        // 2. Player Movement & State
        const moveVector = this.controls.getMovementVector(this.cameraYaw);
        this.player.update(delta, moveVector, this.world);

        // Check if Tom is defeated
        if (this.player.state === "defeat") {
          const defeatModal = document.getElementById("defeat-modal");
          if (defeatModal && defeatModal.style.display !== "flex") {
            defeatModal.style.display = "flex";
            this.audio.playDefeat();
          }
        }

        // 3. Enemies AI Loop
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const enemy = this.enemies[i];
          const shouldRemove = enemy.update(delta, this.player, this.enemies, this.world, this.camera);
          if (shouldRemove) {
            this.addCoins(enemy.coinReward);
            this.addXP(enemy.xpReward);
            this.missions.onEnemyDefeated(enemy);
            if (this.dailyMissions) {
              this.dailyMissions.onEnemyDefeated(enemy);
            }
            enemy.destroy();
            this.enemies.splice(i, 1);
          }
        }

        // 4. Combat Systems
        this.combat.updateTomCombat(this.player, this.enemies, this.world.trainingDummy, delta);
        this.combat.updateEnemyCombat(this.player, this.enemies, delta);
        this.combat.update(delta);

        // 5. Exploration & Beacons
        this.checkCoinPickups();
        this.checkMissionBeacons();

        // 6. HUD Sync
        this.updateHUD();

        // 7. Update Real-Time 2D Mini-Map
        if (this.minimap) {
          this.minimap.update(delta, elapsedTime);
        }
      }
    }

    // 8. Third-Person Follow Camera
    this.updateCamera(delta);

    // 9. Render Frame
    this.renderer.render(this.scene, this.camera);

    // 10. Performance Monitoring FPS & Frame Time Update
    this.updatePerfOverlay(delta);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.tomFightGame = new TomFightGame();
});
