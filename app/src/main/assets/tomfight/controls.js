// TOM FIGHT - Mobile Multi-Touch & Virtual Joystick Controls
class InputControls {
  constructor(game) {
    this.game = game;
    this.moveVector = new THREE.Vector2(0, 0); // (x: -1 to 1, y: -1 to 1)
    this.cameraDelta = new THREE.Vector2(0, 0);

    // Joystick state
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickMaxDist = 45; // Max stick offset pixels

    // Camera touch state
    this.cameraTouchActive = false;
    this.cameraTouchId = null;
    this.lastCameraTouchPos = { x: 0, y: 0 };
    this.cameraSensitivity = 0.005;

    // Keyboard state
    this.keys = {};

    this.initTouchControls();
    this.initKeyboardControls();
  }

  initTouchControls() {
    const joyZone = document.getElementById("joystick-zone");
    const joyStick = document.getElementById("joystick-stick");
    const camZone = document.getElementById("camera-touch-zone");

    // 1. Virtual Joystick
    if (joyZone && joyStick) {
      joyZone.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.joystickActive = true;
        this.joystickTouchId = e.pointerId;
        const rect = joyZone.getBoundingClientRect();
        this.joystickCenter = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
        this.updateJoystick(e.clientX, e.clientY, joyStick);
      }, { passive: false });

      window.addEventListener("pointermove", (e) => {
        if (this.joystickActive && e.pointerId === this.joystickTouchId) {
          this.updateJoystick(e.clientX, e.clientY, joyStick);
        }
      });

      const endJoy = (e) => {
        if (this.joystickActive && e.pointerId === this.joystickTouchId) {
          this.joystickActive = false;
          this.joystickTouchId = null;
          this.moveVector.set(0, 0);
          joyStick.style.transform = `translate(0px, 0px)`;
        }
      };
      window.addEventListener("pointerup", endJoy);
      window.addEventListener("pointercancel", endJoy);
    }

    // 2. Camera Touch Drag
    if (camZone) {
      camZone.addEventListener("pointerdown", (e) => {
        if (this.cameraTouchActive) return;
        this.cameraTouchActive = true;
        this.cameraTouchId = e.pointerId;
        this.lastCameraTouchPos = { x: e.clientX, y: e.clientY };
      });

      window.addEventListener("pointermove", (e) => {
        if (this.cameraTouchActive && e.pointerId === this.cameraTouchId) {
          const dx = e.clientX - this.lastCameraTouchPos.x;
          const dy = e.clientY - this.lastCameraTouchPos.y;
          this.cameraDelta.x += dx * this.cameraSensitivity;
          this.cameraDelta.y += dy * this.cameraSensitivity;
          this.lastCameraTouchPos = { x: e.clientX, y: e.clientY };
        }
      });

      const endCam = (e) => {
        if (this.cameraTouchActive && e.pointerId === this.cameraTouchId) {
          this.cameraTouchActive = false;
          this.cameraTouchId = null;
        }
      };
      window.addEventListener("pointerup", endCam);
      window.addEventListener("pointercancel", endCam);
    }

    // 3. Action Buttons
    this.bindActionButton("btn-punch", () => {
      this.game.player.doPunch();
      this.game.audio.playPunch();
    });

    this.bindActionButton("btn-kick", () => {
      this.game.player.doKick();
      this.game.audio.playKick();
    });

    this.bindActionButton("btn-jump", () => {
      if (this.game.player.doJump()) {
        this.game.audio.playJump();
      }
    });

    // Block button holds down
    const btnBlock = document.getElementById("btn-block");
    if (btnBlock) {
      const startBlock = (e) => {
        e.preventDefault();
        btnBlock.classList.add("pressed");
        this.game.player.setBlock(true);
      };
      const stopBlock = (e) => {
        btnBlock.classList.remove("pressed");
        this.game.player.setBlock(false);
      };
      btnBlock.addEventListener("pointerdown", startBlock);
      btnBlock.addEventListener("pointerup", stopBlock);
      btnBlock.addEventListener("pointercancel", stopBlock);
    }

    this.bindActionButton("btn-dodge", () => {
      const moveDir = this.getMovementVector();
      if (this.game.player.doDodge(moveDir)) {
        this.game.audio.playDodge();
        if (this.game.dailyMissions) {
          this.game.dailyMissions.onDodge();
        }
      }
    });

    this.bindActionButton("btn-special", () => {
      if (this.game.player.doSpecial()) {
        this.game.audio.playSpecial();
        if (this.game.dailyMissions) {
          this.game.dailyMissions.onSpecial();
        }
        if (this.game.triggerCameraShake) {
          // Special attack activation surge
          this.game.triggerCameraShake(0.65, 0, -0.25, 0.08);
        }
      }
    });
  }

  bindActionButton(id, callback) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.classList.add("pressed");
      callback();
      if (navigator.vibrate) navigator.vibrate(15);
    });
    const release = () => el.classList.remove("pressed");
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
  }

  updateJoystick(clientX, clientY, stickEl) {
    const dx = clientX - this.joystickCenter.x;
    const dy = clientY - this.joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) {
      this.moveVector.set(0, 0);
      stickEl.style.transform = `translate(0px, 0px)`;
      return;
    }

    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(this.joystickMaxDist, dist);

    const stickX = Math.cos(angle) * clampedDist;
    const stickY = Math.sin(angle) * clampedDist;

    stickEl.style.transform = `translate(${stickX}px, ${stickY}px)`;

    // Deadzone check
    if (dist < 8) {
      this.moveVector.set(0, 0);
    } else {
      const normDist = clampedDist / this.joystickMaxDist;
      this.moveVector.set(Math.cos(angle) * normDist, Math.sin(angle) * normDist);
    }
  }

  initKeyboardControls() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "KeyJ") {
        this.game.player.doPunch();
        this.game.audio.playPunch();
      } else if (e.code === "KeyK") {
        this.game.player.doKick();
        this.game.audio.playKick();
      } else if (e.code === "Space") {
        if (this.game.player.doJump()) this.game.audio.playJump();
      } else if (e.code === "KeyL") {
        this.game.player.setBlock(true);
      } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        const moveDir = this.getMovementVector();
        if (this.game.player.doDodge(moveDir)) this.game.audio.playDodge();
      } else if (e.code === "KeyU") {
        if (this.game.player.doSpecial()) {
          this.game.audio.playSpecial();
          if (this.game.triggerCameraShake) {
            this.game.triggerCameraShake(0.65, 0, -0.25, 0.08);
          }
        }
      } else if (e.code === "Escape") {
        this.game.togglePause();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      if (e.code === "KeyL") {
        this.game.player.setBlock(false);
      }
    });
  }

  // Returns current 3D movement direction relative to camera angle
  getMovementVector(cameraYaw = 0) {
    let inputX = this.moveVector.x;
    let inputZ = this.moveVector.y;

    // Keyboard fallback
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) inputZ = -1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) inputZ = 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) inputX = -1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) inputX = 1;

    if (Math.abs(inputX) < 0.05 && Math.abs(inputZ) < 0.05) {
      return new THREE.Vector3(0, 0, 0);
    }

    // Convert screen/joystick coordinates to camera-relative 3D world space
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);

    const worldMove = new THREE.Vector3();
    worldMove.addScaledVector(right, inputX);
    worldMove.addScaledVector(forward, -inputZ); // Joystick up (negative Y) moves forward

    if (worldMove.lengthSq() > 1.0) {
      worldMove.normalize();
    }
    return worldMove;
  }

  consumeCameraDelta() {
    const delta = this.cameraDelta.clone();
    this.cameraDelta.set(0, 0);
    return delta;
  }
}

window.InputControls = InputControls;
