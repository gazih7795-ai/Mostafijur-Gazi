// TOM FIGHT - Photo Mode Manager (photo-mode.js)
// Enables pausing the game, hiding HUD elements, freely orbiting the 3D camera
// around Tom with 360-degree rotation, zoom, tilt, posing, filters, and high-res screenshot capture.

class PhotoModeManager {
  constructor(game) {
    this.game = game;
    this.isActive = false;

    // Camera parameters
    this.cameraYaw = 0;
    this.cameraPitch = 0.15;
    this.cameraDist = 4.8;
    this.targetHeight = 1.35;
    this.fov = 60;
    this.sensitivity = 0.005;

    // Filters and styling
    this.activeFilter = "none";
    this.activePose = "frozen";
    this.showGrid = false;
    this.uiVisible = true;

    // Original state backup for clean restoration
    this.savedState = null;
    this.savedPose = null;
    this.capturedDataUrl = null;

    // Touch gesture tracking (orbit & pinch-to-zoom)
    this.activePointers = new Map();
    this.lastPinchDist = 0;
    this.isDragging = false;
    this.lastPointerPos = { x: 0, y: 0 };

    this.initUI();
  }

  initUI() {
    // 1. Hook HUD & Pause Photo Mode trigger buttons
    const btnHudPhoto = document.getElementById("btn-hud-photo");
    if (btnHudPhoto) {
      btnHudPhoto.addEventListener("click", () => this.enter());
    }

    const btnPausePhoto = document.getElementById("btn-pause-photo");
    if (btnPausePhoto) {
      btnPausePhoto.addEventListener("click", () => {
        const pauseModal = document.getElementById("pause-modal");
        if (pauseModal) pauseModal.style.display = "none";
        this.enter();
      });
    }

    // Keyboard shortcut 'P' or 'C' for quick Photo Mode
    window.addEventListener("keydown", (e) => {
      if ((e.key === "p" || e.key === "P" || e.key === "c" || e.key === "C") && !e.repeat) {
        if (!this.game.isInMainMenu) {
          if (this.isActive) this.exit();
          else this.enter();
        }
      }
    });

    // 2. Touch Surface for 360 orbit & pinch-to-zoom
    const touchSurface = document.getElementById("photo-camera-touch-surface");
    if (touchSurface) {
      touchSurface.addEventListener("pointerdown", (e) => this.onPointerDown(e));
      touchSurface.addEventListener("pointermove", (e) => this.onPointerMove(e));
      touchSurface.addEventListener("pointerup", (e) => this.onPointerUp(e));
      touchSurface.addEventListener("pointercancel", (e) => this.onPointerUp(e));

      // Mouse wheel zoom
      touchSurface.addEventListener("wheel", (e) => {
        if (!this.isActive) return;
        e.preventDefault();
        const zoomDelta = e.deltaY * 0.005;
        this.setCameraDist(this.cameraDist + zoomDelta);
      }, { passive: false });
    }

    // 3. Top Toolbar buttons
    const btnExit = document.getElementById("btn-photo-exit");
    if (btnExit) btnExit.addEventListener("click", () => this.exit());

    const btnToggleUI = document.getElementById("btn-photo-toggle-ui");
    if (btnToggleUI) btnToggleUI.addEventListener("click", () => this.toggleUI());

    const btnGrid = document.getElementById("btn-photo-grid");
    if (btnGrid) btnGrid.addEventListener("click", () => this.toggleGrid());

    const btnResetCam = document.getElementById("btn-photo-reset-cam");
    if (btnResetCam) btnResetCam.addEventListener("click", () => this.resetCamera());

    // 4. Clean View Tap Surface (to bring UI back when hidden)
    const cleanTapArea = document.getElementById("photo-clean-tap-restore");
    if (cleanTapArea) {
      cleanTapArea.addEventListener("click", () => {
        if (!this.uiVisible) this.toggleUI(true);
      });
    }

    // 5. Angle Preset Buttons
    document.querySelectorAll(".photo-angle-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const angle = e.currentTarget.dataset.angle;
        this.applyAnglePreset(angle);
        document.querySelectorAll(".photo-angle-btn").forEach((b) => b.classList.remove("active"));
        e.currentTarget.classList.add("active");
      });
    });

    // 6. Pose Preset Buttons
    document.querySelectorAll(".photo-pose-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const pose = e.currentTarget.dataset.pose;
        this.applyPose(pose);
        document.querySelectorAll(".photo-pose-btn").forEach((b) => b.classList.remove("active"));
        e.currentTarget.classList.add("active");
      });
    });

    // 7. Filter Buttons
    document.querySelectorAll(".photo-filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const filter = e.currentTarget.dataset.filter;
        this.applyFilter(filter);
        document.querySelectorAll(".photo-filter-btn").forEach((b) => b.classList.remove("active"));
        e.currentTarget.classList.add("active");
      });
    });

    // 8. Sliders (Zoom, Pitch/Height, FOV)
    const sliderZoom = document.getElementById("photo-slider-zoom");
    if (sliderZoom) {
      sliderZoom.addEventListener("input", (e) => {
        this.setCameraDist(parseFloat(e.target.value));
      });
    }

    const sliderHeight = document.getElementById("photo-slider-height");
    if (sliderHeight) {
      sliderHeight.addEventListener("input", (e) => {
        this.targetHeight = parseFloat(e.target.value);
      });
    }

    const sliderFov = document.getElementById("photo-slider-fov");
    if (sliderFov) {
      sliderFov.addEventListener("input", (e) => {
        this.setFov(parseFloat(e.target.value));
      });
    }

    // 9. Camera Shutter Button
    const btnShutter = document.getElementById("btn-photo-shutter");
    if (btnShutter) {
      btnShutter.addEventListener("click", () => this.capturePhoto());
    }

    // 10. Preview Modal actions (Download, Retake, Done)
    const btnDownload = document.getElementById("btn-photo-download");
    if (btnDownload) {
      btnDownload.addEventListener("click", () => this.downloadCapturedPhoto());
    }

    const btnRetake = document.getElementById("btn-photo-retake");
    if (btnRetake) {
      btnRetake.addEventListener("click", () => {
        const previewModal = document.getElementById("photo-preview-modal");
        if (previewModal) previewModal.style.display = "none";
      });
    }

    const btnPreviewDone = document.getElementById("btn-photo-done");
    if (btnPreviewDone) {
      btnPreviewDone.addEventListener("click", () => {
        const previewModal = document.getElementById("photo-preview-modal");
        if (previewModal) previewModal.style.display = "none";
        this.exit();
      });
    }
  }

  // Pointer event handlers for touch drag & multi-touch pinch zoom
  onPointerDown(e) {
    if (!this.isActive) return;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 1) {
      this.isDragging = true;
      this.lastPointerPos = { x: e.clientX, y: e.clientY };
    } else if (this.activePointers.size === 2) {
      // Two finger pinch started
      const pts = Array.from(this.activePointers.values());
      this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  }

  onPointerMove(e) {
    if (!this.isActive) return;
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 1 && this.isDragging) {
      const dx = e.clientX - this.lastPointerPos.x;
      const dy = e.clientY - this.lastPointerPos.y;

      // Free 360 horizontal orbit
      this.cameraYaw -= dx * this.sensitivity;

      // Vertical tilt (-1.2 to +1.2 rad)
      this.cameraPitch = Math.max(-1.25, Math.min(1.25, this.cameraPitch + dy * this.sensitivity));

      this.lastPointerPos = { x: e.clientX, y: e.clientY };
    } else if (this.activePointers.size === 2) {
      // Pinch to zoom
      const pts = Array.from(this.activePointers.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.lastPinchDist > 0) {
        const deltaDist = currentDist - this.lastPinchDist;
        this.setCameraDist(this.cameraDist - deltaDist * 0.02);
      }
      this.lastPinchDist = currentDist;
    }
  }

  onPointerUp(e) {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size === 0) {
      this.isDragging = false;
      this.lastPinchDist = 0;
    } else if (this.activePointers.size === 1) {
      const remaining = Array.from(this.activePointers.values())[0];
      this.lastPointerPos = { x: remaining.x, y: remaining.y };
      this.lastPinchDist = 0;
    }
  }

  setCameraDist(dist) {
    this.cameraDist = Math.max(1.5, Math.min(15.0, dist));
    const slider = document.getElementById("photo-slider-zoom");
    if (slider) slider.value = this.cameraDist;
  }

  setFov(val) {
    this.fov = Math.max(30, Math.min(85, val));
    if (this.game.camera) {
      this.game.camera.fov = this.fov;
      this.game.camera.updateProjectionMatrix();
    }
    const slider = document.getElementById("photo-slider-fov");
    if (slider) slider.value = this.fov;
  }

  enter() {
    if (this.isActive || this.game.isInMainMenu) return;

    this.isActive = true;
    this.game.isPaused = true;
    this.game.isPhotoMode = true;

    // Backup current game state
    this.savedState = {
      yaw: this.game.cameraYaw,
      pitch: this.game.cameraPitch,
      dist: this.game.cameraDist,
      fov: this.game.camera ? this.game.camera.fov : 60,
      hudDisplay: document.getElementById("hud") ? document.getElementById("hud").style.display : "block"
    };

    // Save Tom's current limb rotations
    this.saveTomPose();

    // Initialize photo camera oriented around Tom
    this.cameraYaw = this.game.cameraYaw;
    this.cameraPitch = 0.15;
    this.cameraDist = 4.8;
    this.targetHeight = 1.35;
    this.fov = 60;
    this.setCameraDist(4.8);
    this.setFov(60);

    // Hide HUD and other game overlays
    const hud = document.getElementById("hud");
    if (hud) hud.style.display = "none";

    const dmgContainer = document.getElementById("damage-container");
    if (dmgContainer) dmgContainer.style.display = "none";

    const camZone = document.getElementById("camera-touch-zone");
    if (camZone) camZone.style.display = "none";

    const pauseModal = document.getElementById("pause-modal");
    if (pauseModal) pauseModal.style.display = "none";

    // Show Photo Mode Overlay
    const overlay = document.getElementById("photo-mode-overlay");
    if (overlay) overlay.style.display = "flex";

    this.toggleUI(true);
    this.applyFilter("none");

    // Reset buttons to defaults
    document.querySelectorAll(".photo-angle-btn").forEach((b) => b.classList.remove("active"));
    const defAngle = document.querySelector('.photo-angle-btn[data-angle="front"]');
    if (defAngle) defAngle.classList.add("active");

    document.querySelectorAll(".photo-pose-btn").forEach((b) => b.classList.remove("active"));
    const defPose = document.querySelector('.photo-pose-btn[data-pose="frozen"]');
    if (defPose) defPose.classList.add("active");

    document.querySelectorAll(".photo-filter-btn").forEach((b) => b.classList.remove("active"));
    const defFilter = document.querySelector('.photo-filter-btn[data-filter="none"]');
    if (defFilter) defFilter.classList.add("active");

    if (this.game.showToast) {
      this.game.showToast("📷 Photo Mode Active: Drag to rotate 360°, tap 👁️ to hide UI");
    }
  }

  exit() {
    if (!this.isActive) return;
    this.isActive = false;

    // Restore Tom's pose
    this.restoreTomPose();

    // Reset canvas CSS filter
    if (this.game.canvas) {
      this.game.canvas.style.filter = "none";
    }

    // Restore camera
    if (this.savedState && this.game.camera) {
      this.game.cameraYaw = this.savedState.yaw;
      this.game.cameraPitch = this.savedState.pitch;
      this.game.cameraDist = this.savedState.dist;
      this.game.camera.fov = this.savedState.fov;
      this.game.camera.updateProjectionMatrix();
    }

    // Hide Photo Mode Overlay & preview
    const overlay = document.getElementById("photo-mode-overlay");
    if (overlay) overlay.style.display = "none";

    const previewModal = document.getElementById("photo-preview-modal");
    if (previewModal) previewModal.style.display = "none";

    // Restore HUD
    const hud = document.getElementById("hud");
    if (hud) hud.style.display = "block";

    const dmgContainer = document.getElementById("damage-container");
    if (dmgContainer) dmgContainer.style.display = "block";

    const camZone = document.getElementById("camera-touch-zone");
    if (camZone) camZone.style.display = "block";

    this.game.isPhotoMode = false;
    this.game.isPaused = false;

    if (this.game.showToast) {
      this.game.showToast("Exited Photo Mode");
    }
  }

  resetCamera() {
    this.cameraYaw = this.game.player.rotationY || 0;
    this.cameraPitch = 0.15;
    this.setCameraDist(4.8);
    this.targetHeight = 1.35;
    this.setFov(60);

    const sliderHeight = document.getElementById("photo-slider-height");
    if (sliderHeight) sliderHeight.value = 1.35;
  }

  applyAnglePreset(preset) {
    const tomFacing = this.game.player.rotationY || 0;

    switch (preset) {
      case "close":
        // Close portrait shot of Tom
        this.cameraYaw = tomFacing;
        this.cameraPitch = 0.08;
        this.setCameraDist(2.2);
        this.targetHeight = 1.55;
        this.setFov(50);
        break;
      case "front":
        // Dynamic full-body front action
        this.cameraYaw = tomFacing;
        this.cameraPitch = -0.12;
        this.setCameraDist(4.2);
        this.targetHeight = 1.25;
        this.setFov(60);
        break;
      case "low":
        // Heroic low ground angle looking up
        this.cameraYaw = tomFacing + 0.25;
        this.cameraPitch = -0.65;
        this.setCameraDist(3.5);
        this.targetHeight = 0.8;
        this.setFov(65);
        break;
      case "side":
        // Cinematic side profile
        this.cameraYaw = tomFacing + Math.PI / 2;
        this.cameraPitch = 0.0;
        this.setCameraDist(4.0);
        this.targetHeight = 1.35;
        this.setFov(55);
        break;
      case "birds":
        // Bird's eye high overhead view
        this.cameraYaw = tomFacing;
        this.cameraPitch = 1.15;
        this.setCameraDist(6.5);
        this.targetHeight = 1.2;
        this.setFov(60);
        break;
    }

    const sliderH = document.getElementById("photo-slider-height");
    if (sliderH) sliderH.value = this.targetHeight;
  }

  saveTomPose() {
    const p = this.game.player;
    if (!p) return;
    this.savedPose = {
      torso: p.torso ? p.torso.rotation.clone() : null,
      neck: p.neck ? p.neck.rotation.clone() : null,
      leftShoulder: p.leftShoulder ? p.leftShoulder.rotation.clone() : null,
      rightShoulder: p.rightShoulder ? p.rightShoulder.rotation.clone() : null,
      leftElbow: p.leftElbow ? p.leftElbow.rotation.clone() : null,
      rightElbow: p.rightElbow ? p.rightElbow.rotation.clone() : null,
      leftHip: p.leftHip ? p.leftHip.rotation.clone() : null,
      rightHip: p.rightHip ? p.rightHip.rotation.clone() : null,
      leftKnee: p.leftKnee ? p.leftKnee.rotation.clone() : null,
      rightKnee: p.rightKnee ? p.rightKnee.rotation.clone() : null,
    };
  }

  restoreTomPose() {
    const p = this.game.player;
    if (!p || !this.savedPose) return;
    if (p.torso && this.savedPose.torso) p.torso.rotation.copy(this.savedPose.torso);
    if (p.neck && this.savedPose.neck) p.neck.rotation.copy(this.savedPose.neck);
    if (p.leftShoulder && this.savedPose.leftShoulder) p.leftShoulder.rotation.copy(this.savedPose.leftShoulder);
    if (p.rightShoulder && this.savedPose.rightShoulder) p.rightShoulder.rotation.copy(this.savedPose.rightShoulder);
    if (p.leftElbow && this.savedPose.leftElbow) p.leftElbow.rotation.copy(this.savedPose.leftElbow);
    if (p.rightElbow && this.savedPose.rightElbow) p.rightElbow.rotation.copy(this.savedPose.rightElbow);
    if (p.leftHip && this.savedPose.leftHip) p.leftHip.rotation.copy(this.savedPose.leftHip);
    if (p.rightHip && this.savedPose.rightHip) p.rightHip.rotation.copy(this.savedPose.rightHip);
    if (p.leftKnee && this.savedPose.leftKnee) p.leftKnee.rotation.copy(this.savedPose.leftKnee);
    if (p.rightKnee && this.savedPose.rightKnee) p.rightKnee.rotation.copy(this.savedPose.rightKnee);
  }

  applyPose(poseName) {
    const p = this.game.player;
    if (!p) return;
    this.activePose = poseName;

    if (poseName === "frozen") {
      this.restoreTomPose();
      return;
    }

    // Reset to neutral
    if (p.torso) p.torso.rotation.set(0, 0, 0);
    if (p.neck) p.neck.rotation.set(0, 0, 0);
    if (p.leftShoulder) p.leftShoulder.rotation.set(0, 0, 0);
    if (p.rightShoulder) p.rightShoulder.rotation.set(0, 0, 0);
    if (p.leftElbow) p.leftElbow.rotation.set(0, 0, 0);
    if (p.rightElbow) p.rightElbow.rotation.set(0, 0, 0);
    if (p.leftHip) p.leftHip.rotation.set(0, 0, 0);
    if (p.rightHip) p.rightHip.rotation.set(0, 0, 0);
    if (p.leftKnee) p.leftKnee.rotation.set(0, 0, 0);
    if (p.rightKnee) p.rightKnee.rotation.set(0, 0, 0);

    switch (poseName) {
      case "guard":
        // Classic Martial Arts Fighter Guard
        if (p.torso) p.torso.rotation.set(0.1, -0.3, 0);
        if (p.leftShoulder) p.leftShoulder.rotation.set(-0.8, 0.4, 0.3);
        if (p.leftElbow) p.leftElbow.rotation.set(-1.1, 0, 0);
        if (p.rightShoulder) p.rightShoulder.rotation.set(-0.6, -0.2, -0.3);
        if (p.rightElbow) p.rightElbow.rotation.set(-1.3, 0, 0);
        if (p.leftHip) p.leftHip.rotation.set(-0.25, 0.2, 0);
        if (p.rightHip) p.rightHip.rotation.set(0.2, -0.2, 0);
        if (p.leftKnee) p.leftKnee.rotation.set(0.35, 0, 0);
        if (p.rightKnee) p.rightKnee.rotation.set(0.25, 0, 0);
        break;

      case "kick":
        // Flying High Dragon Kick
        if (p.torso) p.torso.rotation.set(-0.15, 0, -0.35);
        if (p.rightHip) p.rightHip.rotation.set(-1.45, 0.2, 0.4);
        if (p.rightKnee) p.rightKnee.rotation.set(0.1, 0, 0);
        if (p.leftHip) p.leftHip.rotation.set(0.3, 0, 0);
        if (p.leftKnee) p.leftKnee.rotation.set(0.4, 0, 0);
        if (p.leftShoulder) p.leftShoulder.rotation.set(0.6, 0.3, 0.4);
        if (p.rightShoulder) p.rightShoulder.rotation.set(-0.8, -0.3, -0.4);
        break;

      case "punch":
        // Full Extension Dragon Punch
        if (p.torso) p.torso.rotation.set(0.1, 0.4, 0);
        if (p.rightShoulder) p.rightShoulder.rotation.set(-1.55, 0, 0.1);
        if (p.rightElbow) p.rightElbow.rotation.set(-0.15, 0, 0);
        if (p.leftShoulder) p.leftShoulder.rotation.set(0.4, 0, 0.2);
        if (p.leftElbow) p.leftElbow.rotation.set(-1.3, 0, 0);
        if (p.leftHip) p.leftHip.rotation.set(-0.4, 0, 0);
        if (p.rightHip) p.rightHip.rotation.set(0.3, 0, 0);
        if (p.leftKnee) p.leftKnee.rotation.set(0.5, 0, 0);
        break;

      case "block":
        // Cross Arm Iron Defense
        if (p.torso) p.torso.rotation.set(0.2, 0, 0);
        if (p.leftShoulder) p.leftShoulder.rotation.set(-1.1, 0.5, 0.2);
        if (p.leftElbow) p.leftElbow.rotation.set(-1.4, 0, 0);
        if (p.rightShoulder) p.rightShoulder.rotation.set(-1.1, -0.5, -0.2);
        if (p.rightElbow) p.rightElbow.rotation.set(-1.4, 0, 0);
        if (p.leftHip) p.leftHip.rotation.set(-0.2, 0.2, 0);
        if (p.rightHip) p.rightHip.rotation.set(-0.2, -0.2, 0);
        if (p.leftKnee) p.leftKnee.rotation.set(0.3, 0, 0);
        if (p.rightKnee) p.rightKnee.rotation.set(0.3, 0, 0);
        break;

      case "victory":
        // Double Fist Victory Stance
        if (p.torso) p.torso.rotation.set(-0.1, 0, 0);
        if (p.neck) p.neck.rotation.set(-0.25, 0, 0);
        if (p.leftShoulder) p.leftShoulder.rotation.set(-2.5, 0.3, 0.3);
        if (p.rightShoulder) p.rightShoulder.rotation.set(-2.5, -0.3, -0.3);
        if (p.leftElbow) p.leftElbow.rotation.set(-0.5, 0, 0);
        if (p.rightElbow) p.rightElbow.rotation.set(-0.5, 0, 0);
        if (p.leftHip) p.leftHip.rotation.set(-0.1, 0.2, 0);
        if (p.rightHip) p.rightHip.rotation.set(-0.1, -0.2, 0);
        break;

      case "meditation":
        // Zen Focus Stance
        if (p.torso) p.torso.rotation.set(0.05, 0, 0);
        if (p.leftShoulder) p.leftShoulder.rotation.set(-0.7, 0.5, 0);
        if (p.rightShoulder) p.rightShoulder.rotation.set(-0.7, -0.5, 0);
        if (p.leftElbow) p.leftElbow.rotation.set(-1.3, 0, 0);
        if (p.rightElbow) p.rightElbow.rotation.set(-1.3, 0, 0);
        if (p.leftHip) p.leftHip.rotation.set(-0.4, 0.4, 0.2);
        if (p.rightHip) p.rightHip.rotation.set(-0.4, -0.4, -0.2);
        if (p.leftKnee) p.leftKnee.rotation.set(0.8, 0, 0);
        if (p.rightKnee) p.rightKnee.rotation.set(0.8, 0, 0);
        break;
    }
  }

  applyFilter(filterName) {
    this.activeFilter = filterName;
    if (!this.game.canvas) return;

    let cssFilter = "none";
    switch (filterName) {
      case "cinematic":
        cssFilter = "contrast(1.22) saturate(1.2) brightness(1.02)";
        break;
      case "noir":
        cssFilter = "grayscale(1) contrast(1.4) brightness(0.95)";
        break;
      case "cyberpunk":
        cssFilter = "hue-rotate(170deg) saturate(1.85) contrast(1.25)";
        break;
      case "golden":
        cssFilter = "sepia(0.4) saturate(1.4) contrast(1.15) brightness(1.05)";
        break;
      case "anime":
        cssFilter = "saturate(1.7) contrast(1.25) brightness(1.08)";
        break;
      case "none":
      default:
        cssFilter = "none";
        break;
    }

    this.game.canvas.style.filter = cssFilter;
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    const grid = document.getElementById("photo-grid-overlay");
    if (grid) grid.style.display = this.showGrid ? "grid" : "none";

    const btnGrid = document.getElementById("btn-photo-grid");
    if (btnGrid) {
      btnGrid.classList.toggle("active", this.showGrid);
    }
  }

  toggleUI(forceState = null) {
    this.uiVisible = (forceState !== null) ? forceState : !this.uiVisible;
    const controls = document.getElementById("photo-controls-container");
    const topBar = document.getElementById("photo-top-bar");
    const restoreTap = document.getElementById("photo-clean-tap-restore");

    if (controls) controls.style.display = this.uiVisible ? "flex" : "none";
    if (topBar) topBar.style.display = this.uiVisible ? "flex" : "none";
    if (restoreTap) restoreTap.style.display = this.uiVisible ? "none" : "block";

    const btnToggleUI = document.getElementById("btn-photo-toggle-ui");
    if (btnToggleUI) {
      btnToggleUI.innerText = this.uiVisible ? "👁️" : "👁️‍🗨️";
    }
  }

  // Update photo camera every frame
  updateCamera(delta) {
    if (!this.isActive || !this.game.player) return;

    // Smooth target look vector at Tom's body
    const targetLook = this.game.player.pos.clone().add(new THREE.Vector3(0, this.targetHeight, 0));

    // Spherical position around Tom
    const cosP = Math.cos(this.cameraPitch);
    const sinP = Math.sin(this.cameraPitch);
    const offsetX = Math.sin(this.cameraYaw) * cosP * this.cameraDist;
    const offsetY = sinP * this.cameraDist;
    const offsetZ = Math.cos(this.cameraYaw) * cosP * this.cameraDist;

    const desiredCamPos = targetLook.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));

    this.game.camera.position.copy(desiredCamPos);
    this.game.camera.lookAt(targetLook);
  }

  capturePhoto() {
    if (!this.isActive || !this.game.renderer || !this.game.canvas) return;

    // 1. Play Shutter Sound
    if (this.game.audio && typeof this.game.audio.playShutter === "function") {
      this.game.audio.playShutter();
    }

    // 2. Flash visual animation
    const flashEl = document.getElementById("photo-flash-overlay");
    if (flashEl) {
      flashEl.classList.remove("flash-anim");
      // Trigger reflow
      void flashEl.offsetWidth;
      flashEl.classList.add("flash-anim");
    }

    // 3. Temporarily hide photo mode UI & grid to grab clean screenshot
    const overlay = document.getElementById("photo-mode-overlay");
    const grid = document.getElementById("photo-grid-overlay");
    if (overlay) overlay.style.visibility = "hidden";
    if (grid) grid.style.visibility = "hidden";

    // 4. Force pristine WebGL render
    this.game.renderer.render(this.game.scene, this.game.camera);

    // 5. Generate high-resolution photo with baked-in color filter & watermark
    try {
      const srcCanvas = this.game.canvas;
      const offscreen = document.createElement("canvas");
      offscreen.width = srcCanvas.width;
      offscreen.height = srcCanvas.height;
      const ctx = offscreen.getContext("2d");

      // Apply current CSS filter to 2D context
      if (this.activeFilter && this.activeFilter !== "none") {
        let ctxFilter = "none";
        switch (this.activeFilter) {
          case "cinematic": ctxFilter = "contrast(1.22) saturate(1.2) brightness(1.02)"; break;
          case "noir": ctxFilter = "grayscale(1) contrast(1.4) brightness(0.95)"; break;
          case "cyberpunk": ctxFilter = "hue-rotate(170deg) saturate(1.85) contrast(1.25)"; break;
          case "golden": ctxFilter = "sepia(0.4) saturate(1.4) contrast(1.15) brightness(1.05)"; break;
          case "anime": ctxFilter = "saturate(1.7) contrast(1.25) brightness(1.08)"; break;
        }
        ctx.filter = ctxFilter;
      }

      ctx.drawImage(srcCanvas, 0, 0);

      // Reset filter for decorative badge
      ctx.filter = "none";

      // Subtle stylish watermark badge in bottom right corner
      const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const badgeText = `TOM FIGHT • 3D MARTIAL ARTS`;
      const subText = `${dateStr} • Level ${this.game.level || 1}`;

      ctx.save();
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(offscreen.width - 290, offscreen.height - 54, 276, 42);

      ctx.font = "bold 13px 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#facc15";
      ctx.fillText(badgeText, offscreen.width - 24, offscreen.height - 32);

      ctx.font = "10px 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(subText, offscreen.width - 24, offscreen.height - 18);
      ctx.restore();

      this.capturedDataUrl = offscreen.toDataURL("image/png");
    } catch (e) {
      console.warn("Offscreen capture fallback:", e);
      this.capturedDataUrl = this.game.canvas.toDataURL("image/png");
    }

    // 6. Restore overlay visibility
    if (overlay) overlay.style.visibility = "visible";
    if (grid) grid.style.visibility = "visible";

    // 7. Show Photo Preview Modal
    this.showPreviewModal(this.capturedDataUrl);
  }

  showPreviewModal(dataUrl) {
    const previewModal = document.getElementById("photo-preview-modal");
    const previewImg = document.getElementById("photo-preview-img");
    const previewMeta = document.getElementById("photo-preview-meta");

    if (previewImg) previewImg.src = dataUrl;
    if (previewMeta) {
      const now = new Date();
      previewMeta.innerText = `Captured on ${now.toLocaleTimeString()} • Filter: ${this.activeFilter.toUpperCase()} • Pose: ${this.activePose.toUpperCase()}`;
    }

    if (previewModal) previewModal.style.display = "flex";
  }

  downloadCapturedPhoto() {
    if (!this.capturedDataUrl) return;

    const timestamp = Date.now();
    const filename = `TomFight_Photo_${timestamp}.png`;

    try {
      const link = document.createElement("a");
      link.download = filename;
      link.href = this.capturedDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (this.game.showToast) {
        this.game.showToast(`📸 Photo saved: ${filename}`);
      }
    } catch (err) {
      console.warn("Direct download failed, opening in new tab:", err);
      window.open(this.capturedDataUrl, "_blank");
    }
  }
}

window.PhotoModeManager = PhotoModeManager;
