// TOM FIGHT - 3D Open-World City Generator & Spatial Collision Engine
class CityWorld {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // AABB bounding boxes: { minX, maxX, minZ, maxZ, name }
    this.coins = [];     // Array of spinning coin meshes: { mesh, collected, pos }
    this.missionBeacons = []; // Mission beacon points: { id, pos, mesh, ring }
    this.trainingDummy = null;
    this.cityBounds = { minX: -65, maxX: 65, minZ: -65, maxZ: 65 };
    
    this.buildCity();
  }

  buildCity() {
    this.createLighting();
    this.createGroundAndStreets();
    this.createBuildings();
    this.createTrainingDojo();
    this.createDowntownCombatDistrict();
    this.createBossArena();
    this.createPropsAndDecorations();
    this.createCoins();
    this.createMissionBeacons();
  }

  createLighting() {
    // Ambient soft fill
    const ambientLight = new THREE.AmbientLight(0xd4d8f0, 0.65);
    this.scene.add(ambientLight);

    // Directional Sun / Moonlight
    const sunLight = new THREE.DirectionalLight(0xfff7e6, 0.9);
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 150;
    const d = 60;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.001;
    this.scene.add(sunLight);
    this.sunLight = sunLight;

    // Atmospheric City Fog
    this.scene.fog = new THREE.FogExp2(0x111326, 0.012);
    this.scene.background = new THREE.Color(0x111326);
  }

  createGroundAndStreets() {
    // Main asphalt ground base
    const groundGeo = new THREE.PlaneGeometry(160, 160);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x1e2029 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Main Avenue Road (North-South: Z axis)
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x111217 });
    const mainRoadGeo = new THREE.PlaneGeometry(14, 130);
    const mainRoad = new THREE.Mesh(mainRoadGeo, roadMat);
    mainRoad.rotation.x = -Math.PI / 2;
    mainRoad.position.set(0, 0.02, 0);
    mainRoad.receiveShadow = true;
    this.scene.add(mainRoad);

    // Cross Street (East-West: X axis)
    const crossRoadGeo = new THREE.PlaneGeometry(130, 14);
    const crossRoad = new THREE.Mesh(crossRoadGeo, roadMat);
    crossRoad.rotation.x = -Math.PI / 2;
    crossRoad.position.set(0, 0.03, 0);
    crossRoad.receiveShadow = true;
    this.scene.add(crossRoad);

    // Road Divider Yellow Lines
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let z = -55; z <= 55; z += 5) {
      if (Math.abs(z) < 8) continue; // skip intersection
      const lineGeo = new THREE.PlaneGeometry(0.3, 3);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.04, z);
      this.scene.add(line);
    }

    for (let x = -55; x <= 55; x += 5) {
      if (Math.abs(x) < 8) continue;
      const lineGeo = new THREE.PlaneGeometry(3, 0.3);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.04, 0);
      this.scene.add(line);
    }

    // Sidewalks
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x333745 });
    const sidewalks = [
      { w: 4, h: 120, x: -9, z: 0 },
      { w: 4, h: 120, x: 9, z: 0 },
      { w: 120, h: 4, x: 0, z: -9 },
      { w: 120, h: 4, x: 0, z: 9 }
    ];
    sidewalks.forEach(sw => {
      const geo = new THREE.BoxGeometry(sw.w, 0.25, sw.h);
      const mesh = new THREE.Mesh(geo, sidewalkMat);
      mesh.position.set(sw.x, 0.12, sw.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    });

    // Outer Boundary Walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x0f111a });
    const wallHeight = 6;
    const boundaryConfigs = [
      { w: 140, h: wallHeight, d: 2, x: 0, z: 66 },
      { w: 140, h: wallHeight, d: 2, x: 0, z: -66 },
      { w: 2, h: wallHeight, d: 140, x: 66, z: 0 },
      { w: 2, h: wallHeight, d: 140, x: -66, z: 0 }
    ];
    boundaryConfigs.forEach(b => {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(b.x, b.h / 2, b.z);
      this.scene.add(mesh);
      this.addCollider(b.x, b.z, b.w, b.d, "WorldBoundary");
    });
  }

  createBuildings() {
    const buildingColors = [
      0x252b3b, 0x1f2937, 0x312e81, 0x1e1b4b, 0x1e3a5f, 0x374151, 0x2b2d42
    ];
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const neonMats = [
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
      new THREE.MeshBasicMaterial({ color: 0x10b981 }),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
    ];

    // Array of city building definitions (avoiding roads and arenas)
    const buildingData = [
      // Northeast Block
      { x: 22, z: 22, w: 16, h: 24, d: 16, color: 0x1f2937, neon: "TOM GYM" },
      { x: 42, z: 22, w: 14, h: 32, d: 14, color: 0x252b3b, neon: "PUNCH LAB" },
      { x: 22, z: 42, w: 14, h: 20, d: 14, color: 0x312e81, neon: "HOTEL" },
      { x: 42, z: 42, w: 16, h: 28, d: 16, color: 0x1e1b4b, neon: "ROOFTOP" },

      // Northwest Block (Downtown Combat Alley)
      { x: -22, z: 22, w: 16, h: 22, d: 16, color: 0x2b2d42, neon: "FIGHT CLUB" },
      { x: -42, z: 22, w: 14, h: 36, d: 14, color: 0x1e3a5f, neon: "CYBER ARCADE" },
      { x: -22, z: 42, w: 14, h: 26, d: 14, color: 0x374151, neon: "BAR 99" },
      { x: -42, z: 42, w: 16, h: 30, d: 16, color: 0x1f2937, neon: "RAMEN" },

      // Southwest Block
      { x: -22, z: -22, w: 16, h: 24, d: 16, color: 0x1e1b4b, neon: "HQ TOWER" },
      { x: -42, z: -22, w: 14, h: 28, d: 14, color: 0x252b3b, neon: "BANK" },
      { x: -22, z: -42, w: 14, h: 22, d: 14, color: 0x312e81, neon: "PHARMA" },
      { x: -42, z: -42, w: 16, h: 34, d: 16, color: 0x1e3a5f, neon: "MATRIX" },

      // Southeast side buildings (near Boss Arena)
      { x: 22, z: -22, w: 14, h: 22, d: 14, color: 0x2b2d42, neon: "TITAN GATE" },
      { x: 44, z: -22, w: 16, h: 26, d: 14, color: 0x1f2937, neon: "WATCHTOWER" },
      { x: 22, z: -44, w: 14, h: 28, d: 16, color: 0x374151, neon: "ARMORY" }
    ];

    buildingData.forEach((b, i) => {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const mat = new THREE.MeshLambertMaterial({ color: b.color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Register collision box
      this.addCollider(b.x, b.z, b.w, b.d, `Building_${i}`);

      // Windows strips
      const winGeo = new THREE.PlaneGeometry(b.w * 0.7, 0.4);
      for (let y = 3; y < b.h - 2; y += 3) {
        const winFront = new THREE.Mesh(winGeo, windowMat);
        winFront.position.set(b.x, y, b.z + b.d / 2 + 0.05);
        this.scene.add(winFront);
      }

      // Neon Sign Box above entrance
      const neonMat = neonMats[i % neonMats.length];
      const signGeo = new THREE.BoxGeometry(Math.min(b.w * 0.5, 6), 1.2, 0.4);
      const signMesh = new THREE.Mesh(signGeo, neonMat);
      signMesh.position.set(b.x, 3.5, b.z + b.d / 2 + 0.3);
      this.scene.add(signMesh);

      // Rooftop water tank or helipad
      if (i % 2 === 0) {
        const tankGeo = new THREE.CylinderGeometry(1.5, 1.5, 3, 12);
        const tankMat = new THREE.MeshLambertMaterial({ color: 0x854d0e });
        const tank = new THREE.Mesh(tankGeo, tankMat);
        tank.position.set(b.x + 2, b.h + 1.5, b.z + 2);
        this.scene.add(tank);
      }
    });
  }

  createTrainingDojo() {
    // Training Dojo Area in Northeast plaza (+14, +14)
    const dojoPlatformGeo = new THREE.BoxGeometry(16, 0.4, 16);
    const dojoMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
    const dojoMesh = new THREE.Mesh(dojoPlatformGeo, dojoMat);
    dojoMesh.position.set(16, 0.2, 16);
    dojoMesh.receiveShadow = true;
    this.scene.add(dojoMesh);

    // Red Fighting Ring Mat
    const matGeo = new THREE.PlaneGeometry(12, 12);
    const matColor = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
    const ringMat = new THREE.Mesh(matGeo, matColor);
    ringMat.rotation.x = -Math.PI / 2;
    ringMat.position.set(16, 0.42, 16);
    this.scene.add(ringMat);

    // Bamboo / Wooden Corner Pillars
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const corners = [
      { x: 10, z: 10 }, { x: 22, z: 10 }, { x: 10, z: 22 }, { x: 22, z: 22 }
    ];
    corners.forEach(c => {
      const pGeo = new THREE.CylinderGeometry(0.3, 0.3, 4, 8);
      const p = new THREE.Mesh(pGeo, pillarMat);
      p.position.set(c.x, 2, c.z);
      this.scene.add(p);
      this.addCollider(c.x, c.z, 0.8, 0.8, "DojoPillar");
    });

    // Interactive Training Dummy
    this.createTrainingDummy(16, 16);
  }

  createTrainingDummy(x, z) {
    const dummyGroup = new THREE.Group();
    dummyGroup.position.set(x, 0.4, z);

    // Base Post
    const postGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.2, 12);
    const woodMat = new THREE.MeshLambertMaterial({ color: 0xa16207 });
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.y = 1.1;
    dummyGroup.add(post);

    // Head
    const headGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const head = new THREE.Mesh(headGeo, woodMat);
    head.position.y = 2.1;
    dummyGroup.add(head);

    // Cross Arm Bar
    const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8);
    const arm = new THREE.Mesh(armGeo, woodMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.y = 1.4;
    dummyGroup.add(arm);

    // Red Target Pad on chest
    const padGeo = new THREE.BoxGeometry(0.5, 0.6, 0.2);
    const padMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, 1.3, 0.2);
    dummyGroup.add(pad);

    this.scene.add(dummyGroup);

    this.trainingDummy = {
      group: dummyGroup,
      pos: new THREE.Vector3(x, 0.4, z),
      hp: 9999,
      maxHp: 9999,
      isDummy: true,
      wobble: 0,
      hit: (dmg, isCrit = false, attackType = "punch") => {
        dummyGroup.rotation.z = (Math.random() - 0.5) * (isCrit ? 0.6 : 0.4);
        dummyGroup.rotation.x = (Math.random() - 0.5) * (isCrit ? 0.6 : 0.4);
        // Visual hit flash matching impact audio
        const flashColor = (attackType === "special") ? 0xec4899 : (isCrit ? 0xfff066 : 0xffffff);
        padMat.color.setHex(flashColor);
        setTimeout(() => {
          padMat.color.setHex(0xef4444);
        }, 110);
      }
    };

    this.addCollider(x, z, 1.0, 1.0, "TrainingDummy");
  }

  createDowntownCombatDistrict() {
    // Alleyway decorative trash bins, wooden crates, and barriers at (-16, 20)
    const crateMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
    const crateConfigs = [
      { x: -14, z: 15, s: 1.2 },
      { x: -14, z: 16.3, s: 1.0 },
      { x: -14, z: 15.2, s: 0.9, y: 1.2 },
      { x: -15, z: 28, s: 1.4 },
      { x: -15, z: 34, s: 1.2 }
    ];
    crateConfigs.forEach(c => {
      const geo = new THREE.BoxGeometry(c.s, c.s, c.s);
      const mesh = new THREE.Mesh(geo, crateMat);
      mesh.position.set(c.x, (c.y || 0) + c.s / 2, c.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      if (!c.y) this.addCollider(c.x, c.z, c.s + 0.2, c.s + 0.2, "Crate");
    });
  }

  createBossArena() {
    // Grand Boss Arena in Southeast (+44, -44)
    const arenaCenter = { x: 44, z: -44 };
    const arenaRadius = 18;

    // Stone Platform
    const arenaGeo = new THREE.CylinderGeometry(arenaRadius, arenaRadius + 1, 1, 32);
    const arenaMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const arena = new THREE.Mesh(arenaGeo, arenaMat);
    arena.position.set(arenaCenter.x, 0.5, arenaCenter.z);
    arena.receiveShadow = true;
    this.scene.add(arena);

    // Inner Battle Crest
    const crestGeo = new THREE.RingGeometry(4, 12, 24);
    const crestMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    const crest = new THREE.Mesh(crestGeo, crestMat);
    crest.rotation.x = -Math.PI / 2;
    crest.position.set(arenaCenter.x, 1.02, arenaCenter.z);
    this.scene.add(crest);

    // Surrounding Stone Pillars with Fire Torches
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const px = arenaCenter.x + Math.cos(angle) * (arenaRadius - 1);
      const pz = arenaCenter.z + Math.sin(angle) * (arenaRadius - 1);

      // Pillar
      const pGeo = new THREE.BoxGeometry(1.6, 6, 1.6);
      const pillar = new THREE.Mesh(pGeo, pillarMat);
      pillar.position.set(px, 3, pz);
      this.scene.add(pillar);
      this.addCollider(px, pz, 1.8, 1.8, `BossPillar_${i}`);

      // Fire Bowl
      const fireGeo = new THREE.SphereGeometry(0.5, 8, 8);
      const fire = new THREE.Mesh(fireGeo, fireMat);
      fire.position.set(px, 6.4, pz);
      this.scene.add(fire);
    }
  }

  createPropsAndDecorations() {
    // Street Lamps along main roads
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const lampPositions = [
      { x: -6.5, z: -35 }, { x: 6.5, z: -35 },
      { x: -6.5, z: -15 }, { x: 6.5, z: -15 },
      { x: -6.5, z: 15 },  { x: 6.5, z: 15 },
      { x: -6.5, z: 35 },  { x: 6.5, z: 35 },
      { x: -35, z: -6.5 }, { x: -35, z: 6.5 },
      { x: 35, z: -6.5 },  { x: 35, z: 6.5 }
    ];

    lampPositions.forEach(p => {
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 5, 8);
      const pole = new THREE.Mesh(poleGeo, lampMat);
      pole.position.set(p.x, 2.5, p.z);
      this.scene.add(pole);

      const lampHeadGeo = new THREE.SphereGeometry(0.35, 8, 8);
      const lampHead = new THREE.Mesh(lampHeadGeo, glowMat);
      lampHead.position.set(p.x, 5.1, p.z);
      this.scene.add(lampHead);

      this.addCollider(p.x, p.z, 0.6, 0.6, "StreetLamp");
    });

    // Park Trees & Benches in Southwest Plaza (-14, -14)
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const leavesMat = new THREE.MeshLambertMaterial({ color: 0x15803d });
    const treePositions = [
      { x: -12, z: -12 }, { x: -16, z: -14 }, { x: -13, z: -17 }
    ];
    treePositions.forEach(tp => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.5, 8), trunkMat);
      trunk.position.set(tp.x, 1.25, tp.z);
      this.scene.add(trunk);

      const leaves = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 8), leavesMat);
      leaves.position.set(tp.x, 3.8, tp.z);
      this.scene.add(leaves);

      this.addCollider(tp.x, tp.z, 1.0, 1.0, "Tree");
    });
  }

  createCoins() {
    const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16);
    const coinMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    // 24 Coins scattered in accessible exploration spots
    const coinPositions = [
      { x: 0, z: -10 }, { x: 0, z: 10 }, { x: 0, z: 25 }, { x: 0, z: -25 },
      { x: -10, z: 0 }, { x: 10, z: 0 }, { x: -25, z: 0 }, { x: 25, z: 0 },
      { x: 16, z: 12 }, { x: 12, z: 16 }, { x: 20, z: 16 }, // Dojo
      { x: -12, z: 24 }, { x: -16, z: 22 }, { x: -14, z: 30 }, // Alley
      { x: -12, z: -10 }, { x: -16, z: -12 }, // Park
      { x: 38, z: -38 }, { x: 44, z: -34 }, { x: 50, z: -44 }, // Boss Arena
      { x: 8, z: 30 }, { x: -8, z: -30 }, { x: 30, z: 8 }, { x: -30, z: -8 }
    ];

    coinPositions.forEach((pos, idx) => {
      const mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(pos.x, 1.1, pos.z);
      this.scene.add(mesh);
      this.coins.push({
        id: idx,
        mesh: mesh,
        pos: new THREE.Vector3(pos.x, 1.1, pos.z),
        collected: false
      });
    });
  }

  createMissionBeacons() {
    // 5 Mission Locations
    const missionLocs = [
      { id: 1, name: "Training Day", x: 16, z: 13, color: 0x38bdf8 },
      { id: 2, name: "City Street Fight", x: 0, z: 18, color: 0xf59e0b },
      { id: 3, name: "Protect the District", x: -14, z: 24, color: 0x10b981 },
      { id: 4, name: "Survival Challenge", x: -8, z: -8, color: 0x8b5cf6 },
      { id: 5, name: "Mini-Boss Battle", x: 44, z: -40, color: 0xef4444 }
    ];

    missionLocs.forEach(m => {
      const group = new THREE.Group();
      group.position.set(m.x, 0.05, m.z);

      // Pulsating Ground Ring
      const ringGeo = new THREE.RingGeometry(1.4, 1.9, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: m.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);

      // Vertical Light Beam
      const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 10, 16);
      const beamMat = new THREE.MeshBasicMaterial({
        color: m.color,
        transparent: true,
        opacity: 0.35
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 5;
      group.add(beam);

      // Floating Crystal Marker
      const crystalGeo = new THREE.OctahedronGeometry(0.8, 0);
      const crystalMat = new THREE.MeshBasicMaterial({ color: m.color });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.y = 3.2;
      group.add(crystal);

      this.scene.add(group);
      this.missionBeacons.push({
        id: m.id,
        name: m.name,
        pos: new THREE.Vector3(m.x, 0, m.z),
        group: group,
        crystal: crystal,
        ring: ring
      });
    });
  }

  addCollider(cx, cz, w, d, name = "Obstacle") {
    const halfW = w / 2;
    const halfD = d / 2;
    this.colliders.push({
      minX: cx - halfW,
      maxX: cx + halfW,
      minZ: cz - halfD,
      maxZ: cz + halfD,
      name: name
    });
  }

  // Check collision for a sphere at pos with radius r; returns resolved position
  resolveCollision(pos, radius = 0.5) {
    let resolvedX = pos.x;
    let resolvedZ = pos.z;

    // World bounds clamping
    resolvedX = Math.max(this.cityBounds.minX + radius, Math.min(this.cityBounds.maxX - radius, resolvedX));
    resolvedZ = Math.max(this.cityBounds.minZ + radius, Math.min(this.cityBounds.maxZ - radius, resolvedZ));

    // AABB obstacle check
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      // Closest point on AABB to pos
      const closestX = Math.max(c.minX, Math.min(c.maxX, resolvedX));
      const closestZ = Math.max(c.minZ, Math.min(c.maxZ, resolvedZ));

      const dx = resolvedX - closestX;
      const dz = resolvedZ - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = (radius - dist) / dist;
          resolvedX += dx * push;
          resolvedZ += dz * push;
        } else {
          // Inside center, push out towards closest edge
          const left = Math.abs(resolvedX - c.minX);
          const right = Math.abs(resolvedX - c.maxX);
          const top = Math.abs(resolvedZ - c.minZ);
          const bottom = Math.abs(resolvedZ - c.maxZ);
          const minD = Math.min(left, right, top, bottom);
          if (minD === left) resolvedX = c.minX - radius;
          else if (minD === right) resolvedX = c.maxX + radius;
          else if (minD === top) resolvedZ = c.minZ - radius;
          else resolvedZ = c.maxZ + radius;
        }
      }
    }

    return { x: resolvedX, z: resolvedZ };
  }

  update(delta, time) {
    // Animate spinning coins
    this.coins.forEach(coin => {
      if (!coin.collected && coin.mesh) {
        coin.mesh.rotation.z += 2.5 * delta;
        coin.mesh.position.y = 1.1 + Math.sin(time * 3 + coin.id) * 0.15;
      }
    });

    // Animate mission beacons
    this.missionBeacons.forEach(b => {
      if (b.crystal) {
        b.crystal.rotation.y += 1.8 * delta;
        b.crystal.position.y = 3.2 + Math.sin(time * 2.5 + b.id) * 0.25;
      }
      if (b.ring) {
        const scale = 1.0 + Math.sin(time * 4 + b.id) * 0.15;
        b.ring.scale.set(scale, scale, 1);
      }
    });

    // Animate training dummy wobble decay
    if (this.trainingDummy && this.trainingDummy.group) {
      this.trainingDummy.group.rotation.x *= 0.88;
      this.trainingDummy.group.rotation.z *= 0.88;
    }
  }
}

window.CityWorld = CityWorld;
