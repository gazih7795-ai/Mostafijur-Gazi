// TOM FIGHT - Enemy AI, Archetypes & State Machine
class Enemy {
  constructor(scene, type = "street_fighter", spawnPos = { x: 0, z: 0 }, id = 0) {
    this.scene = scene;
    this.type = type; // "street_fighter", "defender", "boss"
    this.id = id;

    this.pos = new THREE.Vector3(spawnPos.x, 0, spawnPos.z);
    this.spawnPos = new THREE.Vector3(spawnPos.x, 0, spawnPos.z);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotationY = 0;
    this.targetRotationY = 0;

    // Archetype Attributes
    this.initArchetype();

    // AI State Machine
    this.state = "idle"; // idle, patrol, chase, windup, attack, block, hurt, dead
    this.stateTimer = 0;
    this.attackCooldown = 0;
    this.hurtTimer = 0;
    this.animTime = Math.random() * 10;
    this.currentAttackId = 0;
    this.hasHitTomThisAttack = false;

    // Build Enemy 3D Model
    this.buildModel();
  }

  initArchetype() {
    switch (this.type) {
      case "defender":
        this.name = "Defender Brawler";
        this.maxHp = 180;
        this.hp = 180;
        this.attackPower = 16;
        this.moveSpeed = 4.2;
        this.detectRange = 15;
        this.attackRange = 2.4;
        this.scale = 1.15;
        this.radius = 0.65;
        this.canBlock = true;
        this.isBlocking = false;
        this.xpReward = 80;
        this.coinReward = 35;
        break;

      case "boss":
        this.name = "TITAN KURO";
        this.maxHp = 450;
        this.hp = 450;
        this.attackPower = 28;
        this.moveSpeed = 4.8;
        this.detectRange = 28;
        this.attackRange = 3.2;
        this.scale = 1.7;
        this.radius = 1.1;
        this.canBlock = false;
        this.isBlocking = false;
        this.xpReward = 300;
        this.coinReward = 150;
        break;

      case "street_fighter":
      default:
        this.name = "Street Fighter";
        this.maxHp = 100;
        this.hp = 100;
        this.attackPower = 12;
        this.moveSpeed = 5.2;
        this.detectRange = 14;
        this.attackRange = 2.0;
        this.scale = 1.0;
        this.radius = 0.5;
        this.canBlock = false;
        this.isBlocking = false;
        this.xpReward = 45;
        this.coinReward = 20;
        break;
    }
  }

  buildModel() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.scale.set(this.scale, this.scale, this.scale);
    this.scene.add(this.rootGroup);

    this.modelRotator = new THREE.Group();
    this.rootGroup.add(this.modelRotator);

    let skinColor, clothesColor, pantsColor, armorColor;
    if (this.type === "boss") {
      skinColor = 0x831843; // Demonic dark crimson titan
      clothesColor = 0x0f172a; // Dark obsidian
      pantsColor = 0x18181b;
      armorColor = 0xf59e0b; // Gold spiked horns & plates
    } else if (this.type === "defender") {
      skinColor = 0xd4a373;
      clothesColor = 0x334155; // Slate armor vest
      pantsColor = 0x1e293b;
      armorColor = 0x64748b; // Steel bracers
    } else {
      skinColor = 0xffdbac;
      clothesColor = 0xb91c1c; // Red street hoodie
      pantsColor = 0x374151;
      armorColor = 0x111827;
    }

    this.matSkin = new THREE.MeshLambertMaterial({ color: skinColor });
    this.matClothes = new THREE.MeshLambertMaterial({ color: clothesColor });
    this.matPants = new THREE.MeshLambertMaterial({ color: pantsColor });
    this.matArmor = new THREE.MeshLambertMaterial({ color: armorColor });

    // Hip
    this.hip = new THREE.Group();
    this.hip.position.y = 0.95;
    this.modelRotator.add(this.hip);

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.35), this.matPants);
    pelvis.castShadow = true;
    this.hip.add(pelvis);

    // Torso
    this.torso = new THREE.Group();
    this.torso.position.y = 0.2;
    this.hip.add(this.torso);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.55, 0.4), this.matClothes);
    chest.position.y = 0.27;
    chest.castShadow = true;
    this.torso.add(chest);

    // Head
    this.neck = new THREE.Group();
    this.neck.position.y = 0.55;
    this.torso.add(this.neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.38, 0.35), this.matSkin);
    head.position.y = 0.2;
    head.castShadow = true;
    this.neck.add(head);

    // Special Boss Accents: Horns & Glowing Eyes
    if (this.type === "boss") {
      const hornGeo = new THREE.ConeGeometry(0.12, 0.45, 8);
      const lHorn = new THREE.Mesh(hornGeo, this.matArmor);
      lHorn.position.set(-0.2, 0.45, 0);
      lHorn.rotation.z = 0.4;
      this.neck.add(lHorn);

      const rHorn = new THREE.Mesh(hornGeo, this.matArmor);
      rHorn.position.set(0.2, 0.45, 0);
      rHorn.rotation.z = -0.4;
      this.neck.add(rHorn);

      // Glowing Red Eye band
      const eyeBand = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      eyeBand.position.set(0, 0.22, 0.02);
      this.neck.add(eyeBand);
    }

    // Left Arm
    this.leftShoulder = new THREE.Group();
    this.leftShoulder.position.set(-0.38, 0.45, 0);
    this.torso.add(this.leftShoulder);

    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), this.matClothes);
    lArm.position.y = -0.15;
    this.leftShoulder.add(lArm);

    this.leftElbow = new THREE.Group();
    this.leftElbow.position.y = -0.3;
    this.leftShoulder.add(this.leftElbow);

    const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.18), this.matArmor);
    lForearm.position.y = -0.15;
    this.leftElbow.add(lForearm);

    // Right Arm (Attacking Arm)
    this.rightShoulder = new THREE.Group();
    this.rightShoulder.position.set(0.38, 0.45, 0);
    this.torso.add(this.rightShoulder);

    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), this.matClothes);
    rArm.position.y = -0.15;
    this.rightShoulder.add(rArm);

    this.rightElbow = new THREE.Group();
    this.rightElbow.position.y = -0.3;
    this.rightShoulder.add(this.rightElbow);

    const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.18), this.matArmor);
    rForearm.position.y = -0.15;
    this.rightElbow.add(rForearm);

    // Left Leg
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(-0.16, -0.12, 0);
    this.hip.add(this.leftHip);

    const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.22), this.matPants);
    lThigh.position.y = -0.2;
    this.leftHip.add(lThigh);

    this.leftKnee = new THREE.Group();
    this.leftKnee.position.y = -0.4;
    this.leftHip.add(this.leftKnee);

    const lShin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.2), this.matArmor);
    lShin.position.y = -0.2;
    this.leftKnee.add(lShin);

    // Right Leg
    this.rightHip = new THREE.Group();
    this.rightHip.position.set(0.16, -0.12, 0);
    this.hip.add(this.rightHip);

    const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.22), this.matPants);
    rThigh.position.y = -0.2;
    this.rightHip.add(rThigh);

    this.rightKnee = new THREE.Group();
    this.rightKnee.position.y = -0.4;
    this.rightHip.add(this.rightKnee);

    const rShin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.2), this.matArmor);
    rShin.position.y = -0.2;
    this.rightKnee.add(rShin);

    // 3D Floating Health Bar above head (for non-boss enemies)
    if (this.type !== "boss") {
      this.hpBarGroup = new THREE.Group();
      this.hpBarGroup.position.y = 2.4;
      this.rootGroup.add(this.hpBarGroup);

      const bgGeo = new THREE.PlaneGeometry(1.2, 0.15);
      const bgMat = new THREE.MeshBasicMaterial({ color: 0x18181b, side: THREE.DoubleSide });
      const hpBg = new THREE.Mesh(bgGeo, bgMat);
      this.hpBarGroup.add(hpBg);

      const fillGeo = new THREE.PlaneGeometry(1.16, 0.11);
      const fillMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
      this.hpFillMesh = new THREE.Mesh(fillGeo, fillMat);
      this.hpFillMesh.position.z = 0.01;
      this.hpBarGroup.add(this.hpFillMesh);
    }
  }

  takeDamage(amount, fromPos) {
    if (this.state === "dead") return 0;

    let finalDmg = amount;
    if (this.isBlocking) {
      finalDmg = Math.max(1, Math.round(amount * 0.3));
    }

    this.hp = Math.max(0, this.hp - finalDmg);
    this.hurtTimer = 0.22;
    this.state = "hurt";

    // Defender chance to trigger block when struck
    if (this.canBlock && Math.random() < 0.45) {
      this.isBlocking = true;
      this.state = "block";
      this.stateTimer = 1.2;
    }

    // Hit flash red
    this.flashRed();

    // Knockback
    if (fromPos) {
      const kb = this.pos.clone().sub(fromPos).normalize();
      const kbForce = this.type === "boss" ? 1.5 : 4.5;
      this.velocity.x += kb.x * kbForce;
      this.velocity.z += kb.z * kbForce;
    }

    if (this.hp <= 0) {
      this.die();
    }

    return finalDmg;
  }

  flashRed() {
    if (!this.matSkin) return;
    const origSkin = this.matSkin.color.getHex();
    const origClothes = this.matClothes.color.getHex();
    const flashSkin = this.isBlocking ? 0x38bdf8 : 0xffffff;
    const flashClothes = this.isBlocking ? 0x0284c7 : 0xff0000;
    this.matSkin.color.setHex(flashSkin);
    this.matClothes.color.setHex(flashClothes);
    setTimeout(() => {
      if (this.matSkin && this.matClothes) {
        this.matSkin.color.setHex(origSkin);
        this.matClothes.color.setHex(origClothes);
      }
    }, 120);
  }

  die() {
    this.state = "dead";
    this.stateTimer = 1.8; // Time before cleanup
  }

  update(delta, player, otherEnemies, world, camera) {
    this.animTime += delta;
    if (this.attackCooldown > 0) this.attackCooldown -= delta;

    if (this.state === "dead") {
      this.stateTimer -= delta;
      this.modelRotator.rotation.x = -Math.PI / 2;
      this.hip.position.y = 0.2;
      this.rootGroup.position.y = -Math.max(0, (1.8 - this.stateTimer) * 0.8);
      return this.stateTimer <= 0; // return true when ready to remove
    }

    // Orient 3D HP bar toward camera
    if (this.hpBarGroup && camera) {
      this.hpBarGroup.quaternion.copy(camera.quaternion);
      const hpRatio = Math.max(0, this.hp / this.maxHp);
      this.hpFillMesh.scale.x = hpRatio;
      this.hpFillMesh.position.x = -(1 - hpRatio) * 0.58;
    }

    // AI Logic
    const distToPlayer = this.pos.distanceTo(player.pos);
    const playerDir = player.pos.clone().sub(this.pos);
    playerDir.y = 0;

    if (this.hurtTimer > 0) {
      this.hurtTimer -= delta;
      if (this.hurtTimer <= 0 && this.state === "hurt") {
        this.state = "chase";
      }
    } else if (this.state === "block") {
      this.stateTimer -= delta;
      if (this.stateTimer <= 0) {
        this.isBlocking = false;
        this.state = "chase";
      }
    } else if (this.state === "windup") {
      this.stateTimer -= delta;
      if (this.stateTimer <= 0) {
        this.state = "attack";
        this.stateTimer = this.type === "boss" ? 0.4 : 0.3;
        this.currentAttackId++;
        this.hasHitTomThisAttack = false;
      }
    } else if (this.state === "attack") {
      this.stateTimer -= delta;
      if (this.stateTimer <= 0) {
        this.state = "chase";
        this.attackCooldown = this.type === "boss" ? 1.5 : 1.2;
      }
    } else {
      // Exploration / Detection
      if (distToPlayer <= this.detectRange && player.state !== "defeat") {
        this.targetRotationY = Math.atan2(playerDir.x, playerDir.z);

        if (distToPlayer <= this.attackRange) {
          // In attack range
          this.velocity.x *= 0.5;
          this.velocity.z *= 0.5;
          if (this.attackCooldown <= 0) {
            this.state = "windup";
            this.stateTimer = this.type === "boss" ? 0.5 : 0.35;
          } else {
            this.state = "idle";
          }
        } else {
          // Chase player
          this.state = "chase";
          const moveDir = playerDir.clone().normalize();
          this.velocity.x = moveDir.x * this.moveSpeed;
          this.velocity.z = moveDir.z * this.moveSpeed;
        }
      } else {
        // Idle / Patrol near spawn
        this.state = "idle";
        this.velocity.x *= 0.8;
        this.velocity.z *= 0.8;
      }
    }

    // Enemy Separation behavior (prevent clustering)
    if (otherEnemies) {
      otherEnemies.forEach(other => {
        if (other !== this && other.state !== "dead") {
          const sepDist = this.pos.distanceTo(other.pos);
          const minSep = this.radius + other.radius + 0.2;
          if (sepDist < minSep && sepDist > 0.01) {
            const push = this.pos.clone().sub(other.pos).normalize().multiplyScalar((minSep - sepDist) * 3);
            this.velocity.x += push.x;
            this.velocity.z += push.z;
          }
        }
      });
    }

    // Physics & World Collision
    this.pos.x += this.velocity.x * delta;
    this.pos.z += this.velocity.z * delta;

    if (world) {
      const resolved = world.resolveCollision(this.pos, this.radius);
      this.pos.x = resolved.x;
      this.pos.z = resolved.z;
    }

    // Smooth rotation
    let rotDiff = this.targetRotationY - this.rotationY;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    this.rotationY += rotDiff * Math.min(1.0, delta * 10);

    this.rootGroup.position.copy(this.pos);
    this.modelRotator.rotation.y = this.rotationY;

    // Procedural Animations
    this.animateLimbs(delta);

    return false; // Not ready to remove
  }

  animateLimbs(delta) {
    const t = this.animTime;

    // Reset base transforms
    this.torso.rotation.set(0, 0, 0);
    this.leftShoulder.rotation.set(0, 0, 0);
    this.rightShoulder.rotation.set(0, 0, 0);
    this.leftElbow.rotation.set(0, 0, 0);
    this.rightElbow.rotation.set(0, 0, 0);
    this.leftHip.rotation.set(0, 0, 0);
    this.rightHip.rotation.set(0, 0, 0);
    this.leftKnee.rotation.set(0, 0, 0);
    this.rightKnee.rotation.set(0, 0, 0);
    this.hip.position.y = 0.95;

    switch (this.state) {
      case "idle":
        this.hip.position.y = 0.95 + Math.sin(t * 4) * 0.03;
        this.leftShoulder.rotation.x = -0.5;
        this.rightShoulder.rotation.x = -0.5;
        break;

      case "chase":
        const runSpeed = 12;
        this.hip.position.y = 0.95 + Math.abs(Math.sin(t * runSpeed)) * 0.06;
        this.torso.rotation.x = 0.15;
        this.leftShoulder.rotation.x = Math.sin(t * runSpeed) * 0.8;
        this.rightShoulder.rotation.x = -Math.sin(t * runSpeed) * 0.8;
        this.leftHip.rotation.x = -Math.sin(t * runSpeed) * 0.8;
        this.rightHip.rotation.x = Math.sin(t * runSpeed) * 0.8;
        this.leftKnee.rotation.x = Math.max(0, -Math.sin(t * runSpeed) * 0.6);
        this.rightKnee.rotation.x = Math.max(0, Math.sin(t * runSpeed) * 0.6);
        break;

      case "windup":
        // Pull arm far back
        this.torso.rotation.y = 0.4;
        this.rightShoulder.rotation.x = 0.6;
        this.rightElbow.rotation.x = -1.2;
        this.leftShoulder.rotation.x = -0.8;
        break;

      case "attack":
        // Powerful swing forward
        this.torso.rotation.y = -0.7;
        this.rightShoulder.rotation.x = -1.6;
        this.rightElbow.rotation.x = -0.2;
        this.leftShoulder.rotation.x = 0.4;
        break;

      case "block":
        this.torso.rotation.x = 0.1;
        this.leftShoulder.rotation.x = -1.4;
        this.rightShoulder.rotation.x = -1.4;
        this.leftElbow.rotation.x = -1.5;
        this.rightElbow.rotation.x = -1.5;
        break;

      case "hurt":
        this.torso.rotation.x = -0.4;
        this.leftShoulder.rotation.x = 0.5;
        this.rightShoulder.rotation.x = 0.5;
        break;
    }
  }

  destroy() {
    if (this.rootGroup) {
      this.scene.remove(this.rootGroup);
    }
  }
}

window.Enemy = Enemy;
