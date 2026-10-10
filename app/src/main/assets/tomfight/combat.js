// TOM FIGHT - Real-time Combat Engine, Hitboxes, Particles & Feedback
class CombatSystem {
  constructor(scene, camera, audioManager) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audioManager;

    // Tracking active attack frames
    this.tomHitTargets = new Set();
    this.lastTomAttackId = -1;

    // Combo Counter & Multiplier
    this.comboHits = 0;
    this.comboTimer = 0;
    this.comboLabelTimeout = null;

    // Camera Shake
    this.shakeIntensity = 0;
    this.shakeDecay = 6.0;

    // 3D Hit Spark Particles
    this.sparks = [];
    this.initParticlePool();

    // DOM Damage Container & Hit Flash Overlay
    this.dmgContainer = document.getElementById("damage-container");
    this.comboDisplay = document.getElementById("combo-display");
    this.comboHitsText = document.getElementById("combo-hits");
    this.comboLabelText = document.getElementById("combo-label");
    this.hitFlashTimeout = null;
  }

  // Trigger dynamic full-screen radial hit flash matching impact audio
  triggerHitFlash(type = "punch") {
    let el = document.getElementById("hit-flash-overlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "hit-flash-overlay";
      el.className = "hit-flash-overlay";
      document.body.appendChild(el);
    }
    el.className = `hit-flash-overlay hit-flash-${type}`;
    if (this.hitFlashTimeout) clearTimeout(this.hitFlashTimeout);
    this.hitFlashTimeout = setTimeout(() => {
      el.className = "hit-flash-overlay";
    }, 90);
  }

  initParticlePool() {
    this.sparkGroup = new THREE.Group();
    this.scene.add(this.sparkGroup);

    const sparkGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat.clone());
      mesh.visible = false;
      this.sparkGroup.add(mesh);
      this.sparks.push({
        mesh: mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.3
      });
    }
  }

  emitSparks(pos, count = 8, color = 0xfef08a) {
    let emitted = 0;
    for (let i = 0; i < this.sparks.length && emitted < count; i++) {
      const p = this.sparks[i];
      if (!p.mesh.visible) {
        p.mesh.position.copy(pos);
        p.mesh.material.color.setHex(color);
        p.mesh.visible = true;
        p.life = 0;
        p.maxLife = 0.25 + Math.random() * 0.15;
        p.vel.set(
          (Math.random() - 0.5) * 6,
          Math.random() * 5 + 1,
          (Math.random() - 0.5) * 6
        );
        emitted++;
      }
    }
  }

  // Camera Shake trigger
  triggerCameraShake(intensity = 0.4) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  // Show Floating 2D Damage Text above 3D world pos
  spawnDamageNumber(pos, damage, isCrit = false, isPlayer = false) {
    if (!this.dmgContainer || !this.camera) return;

    // Project 3D vector to 2D screen coordinates
    const v = pos.clone().add(new THREE.Vector3(0, 1.8, 0));
    v.project(this.camera);

    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(v.y * 0.5) + 0.5) * window.innerHeight;

    // Behind camera check
    if (v.z > 1) return;

    const el = document.createElement("div");
    el.className = `floating-dmg ${isCrit ? "crit" : ""} ${isPlayer ? "player" : ""}`;
    el.innerText = isCrit ? `CRITICAL -${damage}!` : `-${damage}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    this.dmgContainer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 800);
  }

  // Update Combo Meter
  registerComboHit() {
    this.comboHits++;
    this.comboTimer = 2.4; // 2.4s to continue combo

    if (this.comboDisplay && this.comboHitsText && this.comboLabelText) {
      this.comboDisplay.style.display = "block";
      this.comboHitsText.innerText = `${this.comboHits}x`;

      let label = "NICE!";
      if (this.comboHits >= 10) label = "UNSTOPPABLE!!";
      else if (this.comboHits >= 6) label = "SAVAGE COMBO!";
      else if (this.comboHits >= 3) label = "GREAT HIT!";
      this.comboLabelText.innerText = label;
    }

    if (window.tomFightGame && window.tomFightGame.dailyMissions) {
      window.tomFightGame.dailyMissions.onCombo(this.comboHits);
    }
  }

  // Check Tom's attacks against Enemies & Training Dummy
  updateTomCombat(player, enemies, trainingDummy, delta) {
    // Attack ID change indicates new swing
    if (player.currentAttackId !== this.lastTomAttackId) {
      this.lastTomAttackId = player.currentAttackId;
      this.tomHitTargets.clear();
    }

    const isAttacking = (
      player.state === "lightPunch" ||
      player.state === "heavyPunch" ||
      player.state === "kick" ||
      player.state === "special"
    );

    if (!isAttacking) return;

    // Attack Range & Arc parameters
    let range = 2.2;
    let arc = Math.PI * 0.6; // ~108 degrees forward cone
    let baseDmg = player.attackPower;
    let isCrit = Math.random() < 0.22;

    if (player.state === "heavyPunch") {
      range = 2.5;
      baseDmg = Math.round(player.attackPower * 1.35);
    } else if (player.state === "kick") {
      range = 2.8;
      baseDmg = Math.round(player.attackPower * 1.5);
    } else if (player.state === "special") {
      range = 5.2; // Radial AoE
      arc = Math.PI * 2; // 360 degrees
      baseDmg = player.specialPower;
      isCrit = true;
    }

    // Facing direction
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotationY);

    // 1. Check against Training Dummy
    if (trainingDummy && !this.tomHitTargets.has("dummy")) {
      const dist = player.pos.distanceTo(trainingDummy.pos);
      if (dist <= range + 0.6) {
        const toDummy = trainingDummy.pos.clone().sub(player.pos).normalize();
        const angle = forward.angleTo(toDummy);
        if (angle <= arc / 2 || player.state === "special") {
          this.tomHitTargets.add("dummy");
          trainingDummy.hit(baseDmg, isCrit, player.state);
          if (window.tomFightGame && window.tomFightGame.missions) {
            window.tomFightGame.missions.onDummyHit();
          }
          if (window.tomFightGame && window.tomFightGame.dailyMissions) {
            window.tomFightGame.dailyMissions.onDummyHit();
            if (player.state === "kick") {
              window.tomFightGame.dailyMissions.onKick();
            } else if (player.state === "special") {
              window.tomFightGame.dailyMissions.onSpecial();
            } else {
              window.tomFightGame.dailyMissions.onPunch(player.state === "heavyPunch");
            }
          }
          const sparkColor = (player.state === "special") ? 0xec4899 : (isCrit ? 0xfff066 : 0xfef08a);
          this.emitSparks(trainingDummy.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), isCrit ? 14 : 10, sparkColor);
          this.spawnDamageNumber(trainingDummy.pos, baseDmg, isCrit);
          this.registerComboHit();

          // Specific hit-impact sound effects (punch/kick/special) matching visual hit flashes
          if (player.state === "special") {
            this.audio.playSpecialImpact(true);
            this.triggerCameraShake(0.7);
            this.triggerHitFlash("special");
          } else if (player.state === "kick") {
            this.audio.playKickImpact(isCrit);
            this.triggerCameraShake(isCrit ? 0.35 : 0.2);
            this.triggerHitFlash(isCrit ? "crit" : "kick");
          } else {
            this.audio.playPunchImpact(isCrit);
            if (player.state === "heavyPunch") this.triggerCameraShake(isCrit ? 0.35 : 0.2);
            this.triggerHitFlash(isCrit ? "crit" : "punch");
          }
        }
      }
    }

    // 2. Check against Live Enemies
    enemies.forEach(enemy => {
      if (enemy.state === "dead" || this.tomHitTargets.has(enemy.id)) return;

      const dist = player.pos.distanceTo(enemy.pos);
      if (dist <= range + enemy.radius) {
        const toEnemy = enemy.pos.clone().sub(player.pos).normalize();
        const angle = forward.angleTo(toEnemy);

        if (angle <= arc / 2 || player.state === "special") {
          this.tomHitTargets.add(enemy.id);

          // Calculate Damage with Combo Bonus
          const comboMult = 1.0 + Math.min(0.5, this.comboHits * 0.05);
          let dmg = Math.round(baseDmg * comboMult * (isCrit ? 1.6 : 1.0));

          const actualDmg = enemy.takeDamage(dmg, player.pos);
          const hitPos = enemy.pos.clone().add(new THREE.Vector3(0, 1.2, 0));

          const sparkColor = enemy.isBlocking ? 0x38bdf8 : (player.state === "special" ? 0xec4899 : (isCrit ? 0xfff066 : 0xfef08a));
          this.emitSparks(hitPos, isCrit ? 16 : 9, sparkColor);
          this.spawnDamageNumber(enemy.pos, actualDmg, isCrit);
          this.registerComboHit();

          if (window.tomFightGame && window.tomFightGame.dailyMissions) {
            if (player.state === "kick") {
              window.tomFightGame.dailyMissions.onKick();
            } else if (player.state === "special") {
              window.tomFightGame.dailyMissions.onSpecial();
            } else {
              window.tomFightGame.dailyMissions.onPunch(player.state === "heavyPunch");
            }
          }

          // Trigger specific hit-impact sound effects (punch/kick/block/special) matching visual hit flashes
          if (enemy.isBlocking) {
            this.audio.playBlockImpact();
            this.triggerHitFlash("block");
          } else if (player.state === "special") {
            this.audio.playSpecialImpact(true);
            this.triggerCameraShake(0.75);
            this.triggerHitFlash("special");
          } else if (player.state === "kick") {
            this.audio.playKickImpact(isCrit);
            this.triggerCameraShake(isCrit ? 0.45 : 0.25);
            this.triggerHitFlash(isCrit ? "crit" : "kick");
          } else {
            this.audio.playPunchImpact(isCrit);
            if (player.state === "heavyPunch") {
              this.triggerCameraShake(isCrit ? 0.4 : 0.2);
            }
            this.triggerHitFlash(isCrit ? "crit" : "punch");
          }

          // Energy recharge reward
          player.energy = Math.min(player.maxEnergy, player.energy + 8);
        }
      }
    });
  }

  // Check Enemy attacks against Tom
  updateEnemyCombat(player, enemies, delta) {
    enemies.forEach(enemy => {
      if (enemy.state !== "attack" || enemy.hasHitTomThisAttack) return;

      const dist = enemy.pos.distanceTo(player.pos);
      if (dist <= enemy.attackRange + player.radius) {
        // Check facing direction
        const enemyForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), enemy.rotationY);
        const toPlayer = player.pos.clone().sub(enemy.pos).normalize();

        if (enemyForward.angleTo(toPlayer) <= Math.PI * 0.45) {
          enemy.hasHitTomThisAttack = true;

          const dmg = enemy.attackPower;
          const actualDmg = player.takeDamage(dmg, enemy.pos);

          if (actualDmg > 0) {
            const sparkColor = player.isBlocking ? 0x38bdf8 : 0xef4444;
            this.emitSparks(player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 12, sparkColor);
            this.spawnDamageNumber(player.pos, actualDmg, false, true);
            this.triggerCameraShake(player.isBlocking ? 0.2 : 0.5);

            // Audio impact feedback matching block vs incoming attack impact
            if (player.isBlocking) {
              this.audio.playBlockImpact();
              this.triggerHitFlash("block");
            } else if (enemy.type === "boss") {
              this.audio.playSpecialImpact(false);
              this.triggerHitFlash("playerHurt");
            } else if (Math.random() < 0.45) {
              this.audio.playKickImpact(false);
              this.triggerHitFlash("playerHurt");
            } else {
              this.audio.playPunchImpact(false);
              this.triggerHitFlash("playerHurt");
            }

            // Break player's combo meter
            if (!player.isBlocking) {
              this.comboHits = 0;
              if (this.comboDisplay) this.comboDisplay.style.display = "none";
            }
          }
        }
      }
    });
  }

  update(delta) {
    // Combo timer countdown
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboHits = 0;
        if (this.comboDisplay) this.comboDisplay.style.display = "none";
      }
    }

    // Camera shake decay
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * delta);
    }

    // Update Spark Particles
    this.sparks.forEach(p => {
      if (p.mesh.visible) {
        p.life += delta;
        if (p.life >= p.maxLife) {
          p.mesh.visible = false;
        } else {
          p.vel.y -= 14 * delta; // Gravity
          p.mesh.position.addScaledVector(p.vel, delta);
          const s = 1.0 - (p.life / p.maxLife);
          p.mesh.scale.set(s, s, s);
        }
      }
    });
  }
}

window.CombatSystem = CombatSystem;
