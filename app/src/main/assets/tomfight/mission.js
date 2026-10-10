// TOM FIGHT - Mission Manager, Objective Progression & Persistent Task Queue
class MissionManager {
  constructor(game) {
    this.game = game;
    this.currentMission = null;
    this.completedMissions = new Set();
    this.unlockedMissions = new Set([1]); // Mission 1 unlocked by default

    // Mission definitions with multiple discrete sub-objectives / phases & difficulty tiers
    this.missionDefs = [
      {
        id: 1,
        title: "Training Day",
        desc: "Learn combat basics in the dojo. Land 5 hits on the Training Dummy.",
        difficulty: "Easy",
        coins: 180,
        xp: 120,
        targetType: "dummy",
        targetCount: 5,
        spawnLoc: { x: 16, z: 16 },
        tasks: [
          { id: "approach", text: "Reach Dojo Training Grounds", target: 1 },
          { id: "light_combo", text: "Land 3 strikes on Training Dummy", target: 3 },
          { id: "mastery", text: "Complete 5 total Dummy hits", target: 5 }
        ]
      },
      {
        id: 2,
        title: "City Street Fight",
        desc: "Defeat 3 Street Fighters causing trouble on Main Avenue.",
        difficulty: "Easy",
        coins: 250,
        xp: 200,
        targetType: "street_fighter",
        targetCount: 3,
        spawns: [
          { type: "street_fighter", x: 0, z: 12 },
          { type: "street_fighter", x: 4, z: 22 },
          { type: "street_fighter", x: -4, z: 28 }
        ],
        tasks: [
          { id: "defeat_first", text: "Engage and defeat 1st Street Fighter", target: 1 },
          { id: "defeat_second", text: "Neutralize 2nd street attacker", target: 2 },
          { id: "clear_avenue", text: "Clear all 3 brawlers on Main Avenue", target: 3 }
        ]
      },
      {
        id: 3,
        title: "Protect the District",
        desc: "Cleanse the Neon Alley district of 2 Street Fighters and 2 Defenders.",
        difficulty: "Hard",
        coins: 480,
        xp: 350,
        targetType: "district_gang",
        targetCount: 4,
        spawns: [
          { type: "street_fighter", x: -14, z: 20 },
          { type: "defender", x: -18, z: 24 },
          { type: "street_fighter", x: -12, z: 30 },
          { type: "defender", x: -16, z: 34 }
        ],
        tasks: [
          { id: "scout_neon", text: "Infiltrate Neon Alley gang territory", target: 1 },
          { id: "break_shields", text: "Break through gang defenders (2 down)", target: 2 },
          { id: "purge_district", text: "Defeat all 4 gang members", target: 4 }
        ]
      },
      {
        id: 4,
        title: "Survival Challenge",
        desc: "Survive 3 waves of relentless enemies in the central plaza.",
        difficulty: "Hard",
        coins: 650,
        xp: 450,
        targetType: "waves",
        totalWaves: 3,
        spawnsPerWave: [
          [{ type: "street_fighter", x: -6, z: 4 }, { type: "street_fighter", x: 6, z: 4 }],
          [{ type: "street_fighter", x: -8, z: 8 }, { type: "defender", x: 0, z: 10 }, { type: "street_fighter", x: 8, z: 8 }],
          [{ type: "defender", x: -6, z: 12 }, { type: "defender", x: 6, z: 12 }, { type: "street_fighter", x: 0, z: 16 }]
        ],
        tasks: [
          { id: "wave_1", text: "Survive Wave 1: Street Brawlers", target: 1 },
          { id: "wave_2", text: "Survive Wave 2: Reinforced Squad", target: 2 },
          { id: "wave_3", text: "Survive Wave 3: Heavy Defender Assault", target: 3 }
        ]
      },
      {
        id: 5,
        title: "Mini-Boss Battle",
        desc: "Enter the sacred Boss Arena and defeat Titan Kuro in mortal combat!",
        difficulty: "Boss",
        coins: 1000,
        xp: 750,
        targetType: "boss",
        targetCount: 1,
        spawns: [
          { type: "boss", x: 44, z: -44 }
        ],
        tasks: [
          { id: "enter_arena", text: "Locate and enter Titan Kuro's Boss Arena", target: 1 },
          { id: "break_titan", text: "Weaken Titan Kuro below 50% health", target: 2 },
          { id: "defeat_titan", text: "Defeat Titan Kuro in mortal combat", target: 3 }
        ]
      }
    ];

    // Runtime tracking
    this.progress = 0;
    this.currentWave = 0;
    this.dummyHits = 0;

    // Generated Bounties with varying difficulty levels (Easy, Hard, Boss)
    this.generatedMissions = [];
    this.generateBountyMissions(false);

    // Dedicated Task Queue Tracker Module Integration
    this.tracker = (typeof MissionTracker !== "undefined")
      ? new MissionTracker(this)
      : null;
  }

  /**
   * Generates dynamic bounty missions with distinct difficulty levels (Easy, Hard, Boss)
   * and varying coin rewards that scale with challenge.
   */
  generateBountyMissions(force = false) {
    if (this.generatedMissions && this.generatedMissions.length > 0 && !force) {
      return this.generatedMissions;
    }

    const bountyPool = [
      // --- EASY TIER (180 - 260 Coins) ---
      {
        id: 101,
        title: "Dojo Strike Practice",
        desc: "Hone your speed and striking form. Land 6 clean strikes on the Training Dummy.",
        difficulty: "Easy",
        coins: 190,
        xp: 130,
        targetType: "dummy",
        targetCount: 6,
        spawnLoc: { x: 16, z: 16 },
        tasks: [
          { id: "b101_approach", text: "Reach Dojo Training Grounds", target: 1 },
          { id: "b101_strikes", text: "Land 6 strikes on Training Dummy", target: 6 }
        ]
      },
      {
        id: 102,
        title: "South Plaza Patrol",
        desc: "Patrol the south plaza and eliminate 2 wandering street fighters.",
        difficulty: "Easy",
        coins: 240,
        xp: 180,
        targetType: "bounty_gang",
        targetCount: 2,
        spawns: [
          { type: "street_fighter", x: 6, z: 16 },
          { type: "street_fighter", x: -6, z: 20 }
        ],
        tasks: [
          { id: "b102_f1", text: "Engage and defeat 1st Street Fighter", target: 1 },
          { id: "b102_f2", text: "Clear South Plaza perimeter", target: 2 }
        ]
      },
      {
        id: 103,
        title: "Alley Brawler Skirmish",
        desc: "Neutralize 3 aggressive street fighters disturbing the neon district.",
        difficulty: "Easy",
        coins: 260,
        xp: 190,
        targetType: "bounty_gang",
        targetCount: 3,
        spawns: [
          { type: "street_fighter", x: -12, z: 18 },
          { type: "street_fighter", x: -16, z: 24 },
          { type: "street_fighter", x: -10, z: 28 }
        ],
        tasks: [
          { id: "b103_scout", text: "Locate Alley Brawlers", target: 1 },
          { id: "b103_defeat", text: "Defeat 3 Alley Brawlers", target: 3 }
        ]
      },

      // --- HARD TIER (480 - 650 Coins) ---
      {
        id: 201,
        title: "Syndicate Ambush",
        desc: "Infiltrate Neon Alley and neutralize a 4-man squad: 2 Heavy Defenders & 2 Street Fighters.",
        difficulty: "Hard",
        coins: 520,
        xp: 380,
        targetType: "bounty_gang",
        targetCount: 4,
        spawns: [
          { type: "street_fighter", x: -14, z: 20 },
          { type: "defender", x: -18, z: 24 },
          { type: "defender", x: -12, z: 30 },
          { type: "street_fighter", x: -16, z: 34 }
        ],
        tasks: [
          { id: "b201_scout", text: "Infiltrate Syndicate Alley", target: 1 },
          { id: "b201_defenders", text: "Break through gang defenders (2 down)", target: 2 },
          { id: "b201_clear", text: "Defeat all 4 Syndicate operatives", target: 4 }
        ]
      },
      {
        id: 202,
        title: "Courtyard Wave Siege",
        desc: "Survive 3 relentless waves of coordinated street fighters and heavy defenders.",
        difficulty: "Hard",
        coins: 620,
        xp: 460,
        targetType: "waves",
        totalWaves: 3,
        spawnsPerWave: [
          [{ type: "street_fighter", x: -6, z: 6 }, { type: "street_fighter", x: 6, z: 6 }],
          [{ type: "defender", x: 0, z: 8 }, { type: "street_fighter", x: 8, z: 10 }],
          [{ type: "defender", x: -8, z: 12 }, { type: "defender", x: 8, z: 12 }, { type: "street_fighter", x: 0, z: 16 }]
        ],
        tasks: [
          { id: "b202_w1", text: "Survive Wave 1: Brawler vanguard", target: 1 },
          { id: "b202_w2", text: "Survive Wave 2: Reinforced squad", target: 2 },
          { id: "b202_w3", text: "Survive Wave 3: Heavy Defender assault", target: 3 }
        ]
      },

      // --- BOSS TIER (950 - 1400 Coins) ---
      {
        id: 301,
        title: "Titan Kuro: Blood Moon Duel",
        desc: "Titan Kuro awaits in the Boss Arena with enraged power. Slay the champion!",
        difficulty: "Boss",
        coins: 1100,
        xp: 800,
        targetType: "boss",
        targetCount: 1,
        spawns: [
          { type: "boss", x: 44, z: -44 }
        ],
        tasks: [
          { id: "b301_enter", text: "Enter Boss Arena", target: 1 },
          { id: "b301_weaken", text: "Weaken Titan Kuro below 50% HP", target: 2 },
          { id: "b301_defeat", text: "Defeat Titan Kuro in mortal combat", target: 3 }
        ]
      },
      {
        id: 302,
        title: "Grandmaster Warlord Duel",
        desc: "Surpass the ultimate test: breach 2 elite defenders guarding Titan Kuro, then fell the Boss!",
        difficulty: "Boss",
        coins: 1350,
        xp: 950,
        targetType: "boss_gauntlet",
        targetCount: 3,
        spawns: [
          { type: "defender", x: 40, z: -40 },
          { type: "defender", x: 48, z: -40 },
          { type: "boss", x: 44, z: -46 }
        ],
        tasks: [
          { id: "b302_guards", text: "Neutralize 2 Titan Guard Defenders", target: 2 },
          { id: "b302_boss", text: "Defeat Titan Kuro for Grandmaster Bounty", target: 3 }
        ]
      }
    ];

    this.generatedMissions = bountyPool;
    // Bounties are always unlocked for immediate replayability
    bountyPool.forEach(b => this.unlockedMissions.add(b.id));
    return this.generatedMissions;
  }

  startMission(id) {
    let def = this.missionDefs.find(m => m.id === id);
    if (!def && this.generatedMissions) {
      def = this.generatedMissions.find(m => m.id === id);
    }
    if (!def) return false;

    // Clean up any previously spawned mission enemies
    this.abortMission();

    this.currentMission = def;
    this.progress = 0;
    this.currentWave = 0;
    this.dummyHits = 0;

    // Spawn initial enemies
    if (def.targetType === "waves") {
      this.spawnWave(0);
    } else if (def.spawns) {
      def.spawns.forEach(s => {
        this.game.spawnEnemy(s.type, s.x, s.z);
      });
    }

    // Inform tracker that a mission has started to dynamically push sub-objectives
    if (this.tracker) {
      this.tracker.onMissionStarted(def);
    }

    this.updateHUD();
    return true;
  }

  spawnWave(waveIndex) {
    if (!this.currentMission || !this.currentMission.spawnsPerWave) return;
    const wave = this.currentMission.spawnsPerWave[waveIndex];
    if (wave) {
      wave.forEach(s => {
        this.game.spawnEnemy(s.type, s.x, s.z);
      });
    }
  }

  onEnemyDefeated(enemy) {
    if (!this.currentMission) return;

    if (this.currentMission.targetType === "boss" && enemy.type === "boss") {
      this.progress++;
      if (this.tracker) this.tracker.onMilestoneReached(`boss_kill`, "Titan Kuro Defeated!");
      this.checkCompletion();
    } else if (this.currentMission.targetType === "boss_gauntlet") {
      this.progress++;
      if (enemy.type === "boss") {
        if (this.tracker) this.tracker.onMilestoneReached(`boss_kill`, "Titan Kuro Defeated!");
      } else {
        if (this.tracker) this.tracker.onMilestoneReached(`guard_${this.progress}`, "Titan Escort neutralized");
      }
      this.checkCompletion();
    } else if (this.currentMission.targetType === "waves") {
      // Check if all enemies in wave defeated
      const activeEnemies = this.game.enemies.filter(e => e.state !== "dead");
      if (activeEnemies.length === 0) {
        this.currentWave++;
        if (this.tracker) this.tracker.onMilestoneReached(`wave_${this.currentWave}`, `Wave ${this.currentWave} cleared!`);
        if (this.currentWave >= this.currentMission.totalWaves) {
          this.checkCompletion();
        } else {
          // Spawn next wave after a brief pause
          setTimeout(() => {
            if (this.currentMission) {
              this.spawnWave(this.currentWave);
              this.updateHUD();
            }
          }, 1200);
        }
      }
    } else if (this.currentMission.targetType !== "dummy") {
      this.progress++;
      if (this.tracker) this.tracker.onMilestoneReached(`progress_${this.progress}`, `Sub-objective updated`);
      this.checkCompletion();
    }

    this.updateHUD();
  }

  onDummyHit() {
    if (!this.currentMission || this.currentMission.targetType !== "dummy") return;
    this.dummyHits++;
    this.progress = this.dummyHits;
    if (this.tracker) this.tracker.onMilestoneReached(`dummy_${this.dummyHits}`, `Dummy hit registered`);
    this.updateHUD();
    this.checkCompletion();
  }

  checkCompletion() {
    if (!this.currentMission) return;
    let complete = false;

    if (this.currentMission.targetType === "dummy") {
      complete = this.dummyHits >= this.currentMission.targetCount;
    } else if (this.currentMission.targetType === "waves") {
      complete = this.currentWave >= this.currentMission.totalWaves;
    } else {
      complete = this.progress >= this.currentMission.targetCount;
    }

    if (complete) {
      this.completeMission();
    }
  }

  completeMission() {
    const mission = this.currentMission;
    this.completedMissions.add(mission.id);

    // Unlock next campaign mission if this is a campaign story mission (IDs 1-5)
    if (typeof mission.id === "number" && mission.id < 100) {
      const nextId = mission.id + 1;
      if (nextId <= this.missionDefs.length) {
        this.unlockedMissions.add(nextId);
      }
    }

    // Award Rewards
    this.game.addCoins(mission.coins);
    this.game.addXP(mission.xp);
    this.game.audio.playMissionComplete();

    // Advance Daily Mission Streak & claim bonus if today's first mission
    let streakResult = null;
    if (this.tracker && typeof this.tracker.onMissionCompleted === "function") {
      streakResult = this.tracker.onMissionCompleted(mission);
    }

    // Advance Daily Mission task for mission completion
    if (this.game && this.game.dailyMissions) {
      this.game.dailyMissions.onMissionCompleted(mission);
    }

    this.game.saveData();

    // Show Completion Modal
    const modal = document.getElementById("mission-complete-modal");
    const title = document.getElementById("complete-modal-title");
    const reward = document.getElementById("complete-modal-reward");

    if (modal && title && reward) {
      const diffTag = mission.difficulty ? `[${mission.difficulty.toUpperCase()}] ` : "";
      title.innerText = `${diffTag}${mission.title} COMPLETE!`;

      let rewardText = `+${mission.coins} Coins  |  +${mission.xp} EXP`;
      if (streakResult && streakResult.isNewDayForStreak && streakResult.bonusCoins > 0) {
        rewardText += `  •  🔥 Day ${streakResult.streak} Streak Bonus: +${streakResult.bonusCoins} Coins!`;
      }
      reward.innerText = rewardText;
      modal.style.display = "flex";
    }

    this.currentMission = null;
    this.updateHUD();
  }

  abortMission() {
    if (!this.currentMission) return;
    this.currentMission = null;
    this.game.clearEnemies();
    this.updateHUD();
  }

  // Get live status for all sub-tasks in current mission or open world
  getTaskQueueItems() {
    if (!this.currentMission) {
      const openWorldTasks = [
        {
          id: "ow_coins",
          text: "Collect Street Coins",
          completed: this.game.coins >= 50,
          current: Math.min(50, this.game.coins),
          target: 50,
          unit: ""
        },
        {
          id: "ow_beacon",
          text: "Locate Glowing Mission Beacon",
          completed: Boolean(this.game.nearbyBeacon),
          current: this.game.nearbyBeacon ? 1 : 0,
          target: 1,
          unit: ""
        },
        {
          id: "ow_upgrade",
          text: "Visit Dojo Upgrades in HUD",
          completed: (this.game.upgrades.hpTier > 0 || this.game.upgrades.attackTier > 0 || this.game.upgrades.specialTier > 0),
          current: (this.game.upgrades.hpTier > 0 || this.game.upgrades.attackTier > 0 || this.game.upgrades.specialTier > 0) ? 1 : 0,
          target: 1,
          unit: ""
        }
      ];
      return openWorldTasks;
    }

    const mission = this.currentMission;

    switch (mission.id) {
      case 1: { // Training Day
        const dummyPos = new THREE.Vector3(16, 0.4, 16);
        const playerNearDummy = this.game.player.pos.distanceTo(dummyPos) <= 6.0 || this.dummyHits > 0;
        return [
          {
            id: "t1_approach",
            text: "Reach Dojo Training Grounds",
            completed: playerNearDummy,
            current: playerNearDummy ? 1 : 0,
            target: 1,
            unit: ""
          },
          {
            id: "t1_strike",
            text: "Land 3 strikes on Training Dummy",
            completed: this.dummyHits >= 3,
            current: Math.min(3, this.dummyHits),
            target: 3,
            unit: ""
          },
          {
            id: "t1_mastery",
            text: "Complete 5 total Dummy hits",
            completed: this.dummyHits >= 5,
            current: Math.min(5, this.dummyHits),
            target: 5,
            unit: ""
          }
        ];
      }

      case 2: { // City Street Fight
        return [
          {
            id: "t2_fighter1",
            text: "Defeat 1st Street Fighter",
            completed: this.progress >= 1,
            current: Math.min(1, this.progress),
            target: 1,
            unit: ""
          },
          {
            id: "t2_fighter2",
            text: "Neutralize 2nd street attacker",
            completed: this.progress >= 2,
            current: Math.min(2, this.progress),
            target: 2,
            unit: ""
          },
          {
            id: "t2_clear",
            text: "Clear all 3 brawlers on Main Avenue",
            completed: this.progress >= 3,
            current: Math.min(3, this.progress),
            target: 3,
            unit: ""
          }
        ];
      }

      case 3: { // Protect the District
        return [
          {
            id: "t3_gang1",
            text: "Neutralize initial scout brawler",
            completed: this.progress >= 1,
            current: Math.min(1, this.progress),
            target: 1,
            unit: ""
          },
          {
            id: "t3_defenders",
            text: "Break through gang defenders (2 down)",
            completed: this.progress >= 2,
            current: Math.min(2, this.progress),
            target: 2,
            unit: ""
          },
          {
            id: "t3_clear",
            text: "Defeat all 4 Neon Alley gang members",
            completed: this.progress >= 4,
            current: Math.min(4, this.progress),
            target: 4,
            unit: ""
          }
        ];
      }

      case 4: { // Survival Challenge
        return [
          {
            id: "t4_w1",
            text: "Survive Wave 1: Street Brawlers",
            completed: this.currentWave >= 1,
            current: Math.min(1, this.currentWave),
            target: 1,
            unit: ""
          },
          {
            id: "t4_w2",
            text: "Survive Wave 2: Reinforced Squad",
            completed: this.currentWave >= 2,
            current: Math.min(2, this.currentWave),
            target: 2,
            unit: ""
          },
          {
            id: "t4_w3",
            text: "Survive Wave 3: Heavy Defender Assault",
            completed: this.currentWave >= 3,
            current: Math.min(3, this.currentWave),
            target: 3,
            unit: ""
          }
        ];
      }

      case 5: { // Mini-Boss Battle Titan Kuro
        const arenaCenter = new THREE.Vector3(44, 0, -44);
        const inArena = this.game.player.pos.distanceTo(arenaCenter) <= 22.0 || this.progress > 0;
        const bossEnemy = this.game.enemies.find(e => e.type === "boss");
        const bossBelowHalf = bossEnemy ? (bossEnemy.hp <= bossEnemy.maxHp * 0.5) : (this.progress >= 1);
        const bossDefeated = this.progress >= 1;

        return [
          {
            id: "t5_arena",
            text: "Enter Titan Kuro's Boss Arena",
            completed: inArena,
            current: inArena ? 1 : 0,
            target: 1,
            unit: ""
          },
          {
            id: "t5_half",
            text: "Weaken Titan Kuro below 50% health",
            completed: bossBelowHalf || bossDefeated,
            current: (bossBelowHalf || bossDefeated) ? 1 : (bossEnemy ? Math.round(bossEnemy.hp) : 0),
            target: 1,
            unit: ""
          },
          {
            id: "t5_defeat",
            text: "Defeat Titan Kuro in mortal combat",
            completed: bossDefeated,
            current: bossDefeated ? 1 : 0,
            target: 1,
            unit: ""
          }
        ];
      }

      default: {
        if (mission.tasks && mission.tasks.length > 0) {
          return mission.tasks.map((task, idx) => {
            let isDone = false;
            let current = 0;
            if (mission.targetType === "dummy") {
              current = Math.min(task.target, this.dummyHits);
              isDone = this.dummyHits >= task.target;
            } else if (mission.targetType === "waves") {
              current = Math.min(task.target, this.currentWave);
              isDone = this.currentWave >= task.target;
            } else if (mission.targetType === "boss") {
              if (idx === 0) {
                const inArena = this.game.player.pos.distanceTo(new THREE.Vector3(44, 0, -44)) <= 22.0 || this.progress > 0;
                current = inArena ? 1 : 0;
                isDone = inArena;
              } else if (idx === 1) {
                const boss = this.game.enemies.find(e => e.type === "boss");
                const half = boss ? (boss.hp <= boss.maxHp * 0.5) : (this.progress >= 1);
                current = (half || this.progress >= 1) ? 1 : 0;
                isDone = half || this.progress >= 1;
              } else {
                current = this.progress >= 1 ? 1 : 0;
                isDone = this.progress >= 1;
              }
            } else {
              current = Math.min(task.target, this.progress);
              isDone = this.progress >= task.target;
            }
            return {
              id: task.id || `task_${idx}`,
              text: task.text,
              completed: isDone,
              current: current,
              target: task.target,
              unit: ""
            };
          });
        }
        return [
          {
            id: "default_task",
            text: `Complete mission: ${mission.title}`,
            completed: this.progress >= (mission.targetCount || 1),
            current: this.progress,
            target: mission.targetCount || 1,
            unit: ""
          }
        ];
      }
    }
  }

  updateHUD() {
    const banner = document.getElementById("mission-hud-banner");
    const titleEl = document.getElementById("mission-hud-title");
    const objEl = document.getElementById("mission-hud-obj");
    const distEl = document.getElementById("mission-hud-dist");

    // Task Queue HUD elements
    const queueList = document.getElementById("task-queue-list");
    const queueProgress = document.getElementById("task-queue-progress");

    if (!this.currentMission) {
      if (titleEl) titleEl.innerText = "OPEN WORLD";
      if (objEl) objEl.innerText = "Explore the city, collect coins & find mission beacons!";
      if (distEl) distEl.innerText = "";
    } else {
      if (titleEl) titleEl.innerText = this.currentMission.title;

      if (this.currentMission.targetType === "dummy") {
        if (objEl) objEl.innerText = `Hit Training Dummy: ${this.dummyHits}/${this.currentMission.targetCount}`;
      } else if (this.currentMission.targetType === "waves") {
        if (objEl) objEl.innerText = `Wave ${Math.min(this.currentMission.totalWaves, this.currentWave + 1)}/${this.currentMission.totalWaves} - Defeat all enemies!`;
      } else {
        if (objEl) objEl.innerText = `Defeat enemies: ${this.progress}/${this.currentMission.targetCount}`;
      }

      if (distEl) distEl.innerText = "";
    }

    // Render persistent Task Queue sub-objectives with checkboxes via MissionTracker
    if (this.tracker) {
      this.tracker.update();
    } else if (queueList) {
      const items = this.getTaskQueueItems();
      const completedCount = items.filter(t => t.completed).length;

      if (queueProgress) {
        queueProgress.innerText = `${completedCount}/${items.length}`;
      }

      // Find first incomplete task to mark as active
      let foundActive = false;

      queueList.innerHTML = items.map(task => {
        let statusClass = "pending";
        if (task.completed) {
          statusClass = "completed";
        } else if (!foundActive) {
          statusClass = "active";
          foundActive = true;
        }

        const checkMark = task.completed ? "✓" : "";
        const countText = task.target > 1 && !task.completed
          ? `<span class="task-queue-item-count">(${task.current}/${task.target})</span>`
          : "";

        return `
          <li class="task-queue-item ${statusClass}" data-task-id="${task.id}">
            <div class="task-checkbox">${checkMark}</div>
            <span class="task-queue-item-text">${task.text}</span>
            ${countText}
          </li>
        `;
      }).join("");
    }
  }
}

window.MissionManager = MissionManager;
