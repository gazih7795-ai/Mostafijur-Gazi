// TOM FIGHT - Articulated 3D Hero "Tom" & Procedural Kinematics Engine
class CharacterTom {
  constructor(scene, skinKey = "classic_red") {
    this.scene = scene;
    this.skinKey = skinKey;

    // Position & Physics
    this.pos = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotationY = 0;
    this.targetRotationY = 0;
    this.isGrounded = true;
    this.radius = 0.5;

    // Hero Stats & Progression
    this.maxHp = 100;
    this.hp = 100;
    this.energy = 100;
    this.maxEnergy = 100;
    this.attackPower = 20;
    this.specialPower = 65;
    this.isBlocking = false;
    this.isDodging = false;
    this.invulnerableTimer = 0;

    // Animation & Combat States
    this.state = "idle"; // idle, walk, run, jump, lightPunch, heavyPunch, kick, block, dodge, special, hurt, defeat, victory
    this.animTime = 0;
    this.attackTimer = 0;
    this.attackDuration = 0;
    this.currentAttackId = 0;
    this.comboCounter = 0;
    this.lastAttackTime = 0;
    this.specialCooldown = 0;
    this.maxSpecialCooldown = 8.0;

    // Build Articulated 3D Model
    this.buildModel();
  }

  getSkinPalette(key) {
    switch (key) {
      case "shadow_ninja":
        return {
          skin: 0xd4a373,
          gi: 0x18181b,
          pants: 0x09090b,
          hair: 0x27272a,
          headband: 0x7c3aed,
          gloves: 0x581c87,
          boots: 0x18181b,
          belt: 0xa855f7
        };
      case "cyber_gold":
        return {
          skin: 0xffdbac,
          gi: 0xf59e0b,
          pants: 0x1e293b,
          hair: 0xfacc15,
          headband: 0x06b6d4,
          gloves: 0xd97706,
          boots: 0x0f172a,
          belt: 0x06b6d4
        };
      case "neon_blue":
        return {
          skin: 0xfcd34d,
          gi: 0x0284c7,
          pants: 0x0f172a,
          hair: 0x38bdf8,
          headband: 0xffffff,
          gloves: 0x0369a1,
          boots: 0x0284c7,
          belt: 0x38bdf8
        };
      case "classic_red":
      default:
        return {
          skin: 0xffdbac,
          gi: 0xef4444,
          pants: 0x1e293b,
          hair: 0x451a03,
          headband: 0xffffff,
          gloves: 0xb91c1c,
          boots: 0x0f172a,
          belt: 0x111827
        };
    }
  }

  buildModel() {
    if (this.rootGroup) {
      this.scene.remove(this.rootGroup);
    }

    const palette = this.getSkinPalette(this.skinKey);
    this.palette = palette;

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    // Master Rotator (handles facing direction)
    this.modelRotator = new THREE.Group();
    this.rootGroup.add(this.modelRotator);

    // Materials
    this.matSkin = new THREE.MeshLambertMaterial({ color: palette.skin });
    this.matGi = new THREE.MeshLambertMaterial({ color: palette.gi });
    this.matPants = new THREE.MeshLambertMaterial({ color: palette.pants });
    this.matHair = new THREE.MeshLambertMaterial({ color: palette.hair });
    this.matHeadband = new THREE.MeshLambertMaterial({ color: palette.headband });
    this.matGloves = new THREE.MeshLambertMaterial({ color: palette.gloves });
    this.matBoots = new THREE.MeshLambertMaterial({ color: palette.boots });
    this.matBelt = new THREE.MeshLambertMaterial({ color: palette.belt });

    // 1. Pelvis / Hip Center
    this.hip = new THREE.Group();
    this.hip.position.y = 0.95;
    this.modelRotator.add(this.hip);

    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.35), this.matPants);
    pelvisMesh.castShadow = true;
    this.hip.add(pelvisMesh);

    // Belt and Knot
    const beltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.38), this.matBelt);
    beltMesh.position.y = 0.08;
    this.hip.add(beltMesh);

    const knotMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.1), this.matBelt);
    knotMesh.position.set(0, 0, 0.2);
    this.hip.add(knotMesh);

    // 2. Torso / Upper Body
    this.torso = new THREE.Group();
    this.torso.position.y = 0.2;
    this.hip.add(this.torso);

    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.38), this.matGi);
    chestMesh.position.y = 0.27;
    chestMesh.castShadow = true;
    this.torso.add(chestMesh);

    // 3. Neck & Head
    this.neck = new THREE.Group();
    this.neck.position.y = 0.55;
    this.torso.add(this.neck);

    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.38, 0.35), this.matSkin);
    headMesh.position.y = 0.2;
    headMesh.castShadow = true;
    this.neck.add(headMesh);

    // Hero Hair (Spiky)
    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.38), this.matHair);
    hairMesh.position.set(0, 0.35, -0.02);
    this.neck.add(hairMesh);

    // Headband
    const headbandMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.38), this.matHeadband);
    headbandMesh.position.set(0, 0.28, 0);
    this.neck.add(headbandMesh);

    // Headband trailing ribbons
    this.ribbonTail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.04), this.matHeadband);
    this.ribbonTail.position.set(0, 0.15, -0.22);
    this.ribbonTail.rotation.x = 0.3;
    this.neck.add(this.ribbonTail);

    // 4. Left Arm & Fist
    this.leftShoulder = new THREE.Group();
    this.leftShoulder.position.set(-0.35, 0.45, 0);
    this.torso.add(this.leftShoulder);

    const lUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.18), this.matSkin);
    lUpperArm.position.y = -0.15;
    this.leftShoulder.add(lUpperArm);

    this.leftElbow = new THREE.Group();
    this.leftElbow.position.y = -0.3;
    this.leftShoulder.add(this.leftElbow);

    const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.25, 0.16), this.matSkin);
    lForearm.position.y = -0.12;
    this.leftElbow.add(lForearm);

    this.leftFist = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), this.matGloves);
    this.leftFist.position.y = -0.28;
    this.leftFist.castShadow = true;
    this.leftElbow.add(this.leftFist);

    // 5. Right Arm & Fist (Punching Arm)
    this.rightShoulder = new THREE.Group();
    this.rightShoulder.position.set(0.35, 0.45, 0);
    this.torso.add(this.rightShoulder);

    const rUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.18), this.matSkin);
    rUpperArm.position.y = -0.15;
    this.rightShoulder.add(rUpperArm);

    this.rightElbow = new THREE.Group();
    this.rightElbow.position.y = -0.3;
    this.rightShoulder.add(this.rightElbow);

    const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.25, 0.16), this.matSkin);
    rForearm.position.y = -0.12;
    this.rightElbow.add(rForearm);

    this.rightFist = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), this.matGloves);
    this.rightFist.position.y = -0.28;
    this.rightFist.castShadow = true;
    this.rightElbow.add(this.rightFist);

    // 6. Left Leg & Boot
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(-0.16, -0.12, 0);
    this.hip.add(this.leftHip);

    const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.38, 0.22), this.matPants);
    lThigh.position.y = -0.19;
    this.leftHip.add(lThigh);

    this.leftKnee = new THREE.Group();
    this.leftKnee.position.y = -0.38;
    this.leftHip.add(this.leftKnee);

    const lCalf = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.2), this.matPants);
    lCalf.position.y = -0.17;
    this.leftKnee.add(lCalf);

    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.3), this.matBoots);
    lBoot.position.set(0, -0.36, 0.05);
    lBoot.castShadow = true;
    this.leftKnee.add(lBoot);

    // 7. Right Leg & Boot (Kicking Leg)
    this.rightHip = new THREE.Group();
    this.rightHip.position.set(0.16, -0.12, 0);
    this.hip.add(this.rightHip);

    const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.38, 0.22), this.matPants);
    rThigh.position.y = -0.19;
    this.rightHip.add(rThigh);

    this.rightKnee = new THREE.Group();
    this.rightKnee.position.y = -0.38;
    this.rightHip.add(this.rightKnee);

    const rCalf = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.2), this.matPants);
    rCalf.position.y = -0.17;
    this.rightKnee.add(rCalf);

    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.3), this.matBoots);
    rBoot.position.set(0, -0.36, 0.05);
    rBoot.castShadow = true;
    this.rightKnee.add(rBoot);

    // Defensive Energy Barrier (Glows during Block)
    const shieldGeo = new THREE.RingGeometry(0.6, 0.9, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0
    });
    this.blockShield = new THREE.Mesh(shieldGeo, shieldMat);
    this.blockShield.position.set(0, 0.4, 0.5);
    this.torso.add(this.blockShield);

    // Special Attack Shockwave Ring
    const shockGeo = new THREE.RingGeometry(0.2, 2.5, 24);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0
    });
    this.shockRing = new THREE.Mesh(shockGeo, shockMat);
    this.shockRing.rotation.x = -Math.PI / 2;
    this.shockRing.position.y = 0.05;
    this.rootGroup.add(this.shockRing);
  }

  setSkin(newSkinKey) {
    this.skinKey = newSkinKey;
    this.buildModel();
  }

  // Combat Trigger: Punch
  doPunch() {
    if (this.state === "defeat" || this.state === "hurt" || this.state === "dodge") return false;
    const now = performance.now();
    
    // Combo check (chain light jab to heavy cross)
    if (now - this.lastAttackTime < 800) {
      this.comboCounter++;
    } else {
      this.comboCounter = 1;
    }
    this.lastAttackTime = now;

    if (this.comboCounter % 2 === 0) {
      this.state = "heavyPunch";
      this.attackDuration = 0.32;
    } else {
      this.state = "lightPunch";
      this.attackDuration = 0.22;
    }
    this.attackTimer = this.attackDuration;
    this.currentAttackId++;
    return true;
  }

  // Combat Trigger: Kick
  doKick() {
    if (this.state === "defeat" || this.state === "hurt" || this.state === "dodge") return false;
    this.state = "kick";
    this.attackDuration = 0.35;
    this.attackTimer = this.attackDuration;
    this.currentAttackId++;
    this.lastAttackTime = performance.now();
    return true;
  }

  // Combat Trigger: Jump
  doJump() {
    if (!this.isGrounded || this.state === "defeat") return false;
    this.velocity.y = 8.5;
    this.isGrounded = false;
    this.state = "jump";
    return true;
  }

  // Combat Trigger: Block
  setBlock(active) {
    if (this.state === "defeat") return;
    this.isBlocking = active;
    if (active && this.state !== "lightPunch" && this.state !== "heavyPunch" && this.state !== "kick") {
      this.state = "block";
    } else if (!active && this.state === "block") {
      this.state = "idle";
    }
  }

  // Combat Trigger: Dodge Dash
  doDodge(moveDir) {
    if (this.state === "defeat" || this.isDodging || this.energy < 20) return false;
    this.energy -= 20;
    this.isDodging = true;
    this.state = "dodge";
    this.attackDuration = 0.3;
    this.attackTimer = this.attackDuration;
    this.invulnerableTimer = 0.35;

    // Fast burst velocity in movement direction
    const dashDir = moveDir.lengthSq() > 0.01 ? moveDir.clone().normalize() : new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
    this.velocity.x = dashDir.x * 16;
    this.velocity.z = dashDir.z * 16;
    return true;
  }

  // Combat Trigger: Special Attack
  doSpecial() {
    if (this.state === "defeat" || this.specialCooldown > 0 || this.energy < 50) return false;
    this.energy -= 50;
    this.specialCooldown = 8.0; // 8s cooldown
    this.state = "special";
    this.attackDuration = 0.7;
    this.attackTimer = this.attackDuration;
    this.currentAttackId++;
    this.invulnerableTimer = 0.7;
    return true;
  }

  // Take Damage
  takeDamage(amount, fromPos) {
    if (this.invulnerableTimer > 0 || this.state === "defeat") return 0;

    let finalDmg = amount;
    if (this.isBlocking) {
      finalDmg = Math.max(1, Math.round(amount * 0.25)); // 75% damage reduction on block
      if (window.tomFightGame && window.tomFightGame.dailyMissions) {
        window.tomFightGame.dailyMissions.onBlock();
      }
    }

    this.hp = Math.max(0, this.hp - finalDmg);
    this.invulnerableTimer = 0.25;

    // Visual hit flash matching audio feedback
    this.flashHit(this.isBlocking);

    if (this.hp <= 0) {
      this.state = "defeat";
    } else if (!this.isBlocking) {
      this.state = "hurt";
      this.attackDuration = 0.2;
      this.attackTimer = 0.2;
    }

    // Knockback
    if (fromPos) {
      const kbDir = this.pos.clone().sub(fromPos).normalize();
      this.velocity.x += kbDir.x * 4;
      this.velocity.z += kbDir.z * 4;
    }

    return finalDmg;
  }

  // Visual Hit Flash for Tom
  flashHit(isBlocking = false) {
    if (!this.matSkin || !this.matGi) return;
    const origSkin = this.matSkin.color.getHex();
    const origGi = this.matGi.color.getHex();

    const flashSkin = isBlocking ? 0x38bdf8 : 0xffffff;
    const flashGi = isBlocking ? 0x0284c7 : 0xef4444;

    this.matSkin.color.setHex(flashSkin);
    this.matGi.color.setHex(flashGi);

    setTimeout(() => {
      if (this.matSkin && this.matGi) {
        this.matSkin.color.setHex(origSkin);
        this.matGi.color.setHex(origGi);
      }
    }, 110);
  }

  // Procedural Skeletal Animation Update Loop
  update(delta, moveInput, world) {
    this.animTime += delta;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= delta;
    if (this.specialCooldown > 0) this.specialCooldown -= delta;

    // Natural Energy Regen
    if (this.energy < this.maxEnergy) {
      this.energy = Math.min(this.maxEnergy, this.energy + delta * 12);
    }

    // Handle Attack & Timers
    if (this.attackTimer > 0) {
      this.attackTimer -= delta;
      if (this.attackTimer <= 0) {
        if (this.isDodging) this.isDodging = false;
        if (this.isBlocking) this.state = "block";
        else this.state = "idle";
      }
    }

    // Movement & Physics
    if (this.state !== "defeat") {
      // Horizontal friction & dampening
      if (this.isDodging) {
        this.velocity.x *= 0.92;
        this.velocity.z *= 0.92;
      } else if (this.state !== "lightPunch" && this.state !== "heavyPunch" && this.state !== "kick") {
        const moveSpeed = (this.state === "block") ? 3.0 : 7.5;
        this.velocity.x = moveInput.x * moveSpeed;
        this.velocity.z = moveInput.z * moveSpeed;

        if (moveInput.lengthSq() > 0.01) {
          this.targetRotationY = Math.atan2(moveInput.x, moveInput.z);
          if (this.isGrounded && this.state !== "block") {
            this.state = moveInput.lengthSq() > 0.5 ? "run" : "walk";
          }
        } else if (this.isGrounded && this.attackTimer <= 0 && !this.isBlocking) {
          this.state = "idle";
        }
      } else {
        // Attack movement slide
        this.velocity.x *= 0.8;
        this.velocity.z *= 0.8;
      }
    }

    // Gravity & Ground Check
    this.velocity.y -= 22 * delta;
    this.pos.y += this.velocity.y * delta;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
      if (this.state === "jump") this.state = "idle";
    }

    // Horizontal Movement & Spatial World Collision
    this.pos.x += this.velocity.x * delta;
    this.pos.z += this.velocity.z * delta;

    if (world) {
      const resolved = world.resolveCollision(this.pos, this.radius);
      this.pos.x = resolved.x;
      this.pos.z = resolved.z;
    }

    // Smooth facing rotation interpolation
    let rotDiff = this.targetRotationY - this.rotationY;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    this.rotationY += rotDiff * Math.min(1.0, delta * 14);

    // Apply Root Transform
    this.rootGroup.position.copy(this.pos);
    this.modelRotator.rotation.y = this.rotationY;

    // Animate Limbs based on state
    this.animateProceduralLimbs(delta);
  }

  animateProceduralLimbs(delta) {
    const t = this.animTime;

    // Reset base rotations
    this.torso.rotation.set(0, 0, 0);
    this.neck.rotation.set(0, 0, 0);
    this.leftShoulder.rotation.set(0, 0, 0);
    this.rightShoulder.rotation.set(0, 0, 0);
    this.leftElbow.rotation.set(0, 0, 0);
    this.rightElbow.rotation.set(0, 0, 0);
    this.leftHip.rotation.set(0, 0, 0);
    this.rightHip.rotation.set(0, 0, 0);
    this.leftKnee.rotation.set(0, 0, 0);
    this.rightKnee.rotation.set(0, 0, 0);
    this.hip.position.y = 0.95;
    this.ribbonTail.rotation.x = 0.3 + Math.sin(t * 8) * 0.15;

    // Block Shield opacity
    if (this.blockShield) {
      this.blockShield.material.opacity = this.isBlocking ? 0.7 : 0.0;
    }

    // Shockwave Ring animation
    if (this.shockRing) {
      if (this.state === "special") {
        const prog = 1.0 - (this.attackTimer / this.attackDuration);
        this.shockRing.scale.set(1 + prog * 4, 1 + prog * 4, 1);
        this.shockRing.material.opacity = (1.0 - prog) * 0.9;
      } else {
        this.shockRing.material.opacity = 0;
      }
    }

    switch (this.state) {
      case "idle":
        // Ready bounce on toes + guarded fists
        this.hip.position.y = 0.95 + Math.sin(t * 5) * 0.04;
        this.torso.rotation.x = 0.05 + Math.sin(t * 5) * 0.02;
        // Left Guard Fist
        this.leftShoulder.rotation.x = -0.8;
        this.leftShoulder.rotation.z = -0.3;
        this.leftElbow.rotation.x = -1.4;
        // Right Guard Fist
        this.rightShoulder.rotation.x = -0.7;
        this.rightShoulder.rotation.z = 0.25;
        this.rightElbow.rotation.x = -1.3;
        // Ready stance feet
        this.leftHip.rotation.x = 0.1;
        this.rightHip.rotation.x = -0.1;
        break;

      case "walk":
        const walkSpeed = 9;
        this.hip.position.y = 0.95 + Math.abs(Math.sin(t * walkSpeed)) * 0.05;
        this.torso.rotation.y = Math.sin(t * walkSpeed) * 0.12;
        // Arms swing
        this.leftShoulder.rotation.x = Math.sin(t * walkSpeed) * 0.6;
        this.rightShoulder.rotation.x = -Math.sin(t * walkSpeed) * 0.6;
        this.leftElbow.rotation.x = -0.4;
        this.rightElbow.rotation.x = -0.4;
        // Legs stride
        this.leftHip.rotation.x = -Math.sin(t * walkSpeed) * 0.65;
        this.rightHip.rotation.x = Math.sin(t * walkSpeed) * 0.65;
        this.leftKnee.rotation.x = Math.max(0, -Math.sin(t * walkSpeed) * 0.5);
        this.rightKnee.rotation.x = Math.max(0, Math.sin(t * walkSpeed) * 0.5);
        break;

      case "run":
        const runSpeed = 15;
        this.hip.position.y = 0.95 + Math.abs(Math.sin(t * runSpeed)) * 0.08;
        this.torso.rotation.x = 0.22; // Aggressive forward lean
        this.torso.rotation.y = Math.sin(t * runSpeed) * 0.2;
        // Dynamic arm pumping
        this.leftShoulder.rotation.x = Math.sin(t * runSpeed) * 1.1;
        this.rightShoulder.rotation.x = -Math.sin(t * runSpeed) * 1.1;
        this.leftElbow.rotation.x = -1.2;
        this.rightElbow.rotation.x = -1.2;
        // Running strides
        this.leftHip.rotation.x = -Math.sin(t * runSpeed) * 1.1;
        this.rightHip.rotation.x = Math.sin(t * runSpeed) * 1.1;
        this.leftKnee.rotation.x = Math.max(0, -Math.sin(t * runSpeed) * 1.0);
        this.rightKnee.rotation.x = Math.max(0, Math.sin(t * runSpeed) * 1.0);
        break;

      case "jump":
        this.torso.rotation.x = 0.1;
        this.leftShoulder.rotation.x = -1.2;
        this.rightShoulder.rotation.x = -1.2;
        this.leftHip.rotation.x = -0.5;
        this.rightHip.rotation.x = -0.5;
        this.leftKnee.rotation.x = 0.8;
        this.rightKnee.rotation.x = 0.8;
        break;

      case "lightPunch":
        // Fast Right Jab
        const lpProgress = 1.0 - (this.attackTimer / this.attackDuration);
        const jabExt = Math.sin(lpProgress * Math.PI);
        this.torso.rotation.y = -jabExt * 0.45;
        this.rightShoulder.rotation.x = -1.5 * jabExt;
        this.rightShoulder.rotation.y = -0.2 * jabExt;
        this.rightElbow.rotation.x = -0.1 * jabExt;
        // Left Guard
        this.leftShoulder.rotation.x = -0.7;
        this.leftElbow.rotation.x = -1.3;
        break;

      case "heavyPunch":
        // Powerful Right Cross
        const hpProgress = 1.0 - (this.attackTimer / this.attackDuration);
        const crossExt = Math.sin(hpProgress * Math.PI);
        this.torso.rotation.y = -crossExt * 0.8;
        this.torso.rotation.x = crossExt * 0.2;
        this.rightShoulder.rotation.x = -1.6 * crossExt;
        this.rightElbow.rotation.x = -0.05;
        // Left arm pulls back
        this.leftShoulder.rotation.x = 0.5 * crossExt;
        this.leftElbow.rotation.x = -1.5;
        break;

      case "kick":
        // High Roundhouse Kick
        const kickProgress = 1.0 - (this.attackTimer / this.attackDuration);
        const kickExt = Math.sin(kickProgress * Math.PI);
        this.torso.rotation.z = kickExt * 0.45;
        this.torso.rotation.y = -kickExt * 0.5;
        // Right leg sweeps high
        this.rightHip.rotation.x = -1.7 * kickExt;
        this.rightHip.rotation.z = -0.4 * kickExt;
        this.rightKnee.rotation.x = 0.2 * (1.0 - kickExt);
        // Arms balance
        this.leftShoulder.rotation.x = -1.0;
        this.rightShoulder.rotation.x = 0.5;
        break;

      case "block":
        this.torso.rotation.x = 0.1;
        // Cross forearms in front of face
        this.leftShoulder.rotation.x = -1.4;
        this.leftShoulder.rotation.z = 0.45;
        this.leftElbow.rotation.x = -1.6;
        this.rightShoulder.rotation.x = -1.4;
        this.rightShoulder.rotation.z = -0.45;
        this.rightElbow.rotation.x = -1.6;
        this.leftHip.rotation.x = 0.2;
        this.rightHip.rotation.x = -0.2;
        break;

      case "dodge":
        // Quick roll / dash lean
        this.torso.rotation.x = 0.6;
        this.hip.position.y = 0.65;
        this.leftHip.rotation.x = -0.7;
        this.rightHip.rotation.x = 0.7;
        break;

      case "special":
        // Leaping Dragon Slam
        const spProgress = 1.0 - (this.attackTimer / this.attackDuration);
        if (spProgress < 0.4) {
          // Leap up with fists high
          this.hip.position.y = 0.95 + spProgress * 3;
          this.leftShoulder.rotation.x = -2.5;
          this.rightShoulder.rotation.x = -2.5;
        } else {
          // Ground slam impact
          this.hip.position.y = 0.6;
          this.torso.rotation.x = 0.8;
          this.leftShoulder.rotation.x = -0.2;
          this.rightShoulder.rotation.x = -0.2;
          this.leftElbow.rotation.x = -0.5;
          this.rightElbow.rotation.x = -0.5;
        }
        break;

      case "hurt":
        // Reeling back
        const hurtProg = Math.sin((this.attackTimer / this.attackDuration) * Math.PI);
        this.torso.rotation.x = -0.5 * hurtProg;
        this.neck.rotation.x = -0.3 * hurtProg;
        this.leftShoulder.rotation.x = 0.6 * hurtProg;
        this.rightShoulder.rotation.x = 0.6 * hurtProg;
        break;

      case "victory":
        // Triumphant right fist in air
        this.rightShoulder.rotation.x = -2.8;
        this.rightElbow.rotation.x = 0;
        this.leftShoulder.rotation.x = -0.5;
        this.leftElbow.rotation.x = -1.4;
        this.torso.rotation.y = -0.2;
        break;

      case "defeat":
        // Collapsed on ground
        this.modelRotator.rotation.x = -Math.PI / 2;
        this.hip.position.y = 0.2;
        break;
    }
  }
}

window.CharacterTom = CharacterTom;
