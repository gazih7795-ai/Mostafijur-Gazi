// TOM FIGHT - Daily Mission System (daily-missions.js)
// Generates three specific, randomized tasks each day for the user to complete
// to earn substantial bonus coins and accelerate progression.
// Features:
// 1. Daily Task Generator: selects 3 distinct tasks each day from a rich combat/objective pool.
// 2. Persistent Storage: tracks per-day task state, completion, and claimed rewards.
// 3. Real-Time Tracking: hooks into punches, kicks, blocks, dodges, specials, combos, and defeats.
// 4. Multi-Tier Rewards: coin rewards per task plus an All-3 "Triple Crown" Daily Grand Bonus.
// 5. Seamless HUD & Modal UI: interactive cards with animated progress bars & claim buttons.

class DailyMissionManager {
  constructor(game) {
    this.game = game;
    this.storageKey = "tom_fight_daily_missions_v1";
    this.tasks = [];
    this.currentDate = this.getTodayDateString();
    this.allBonusClaimed = false;
    this.allBonusReward = 300; // Grand bonus coins for completing all 3 daily tasks

    // Master pool of candidate tasks
    this.taskPool = [
      {
        id: "daily_punch_15",
        type: "punch",
        title: "Iron Knuckles",
        desc: "Land 15 Punches on any targets or training dummy",
        target: 15,
        reward: 160,
        icon: "👊",
        badge: "COMBAT"
      },
      {
        id: "daily_kick_10",
        type: "kick",
        title: "Dragon Kick Drill",
        desc: "Execute 10 Kicks on enemies or the training dummy",
        target: 10,
        reward: 180,
        icon: "🦵",
        badge: "AGILITY"
      },
      {
        id: "daily_block_5",
        type: "block",
        title: "Unbreakable Guard",
        desc: "Successfully block 5 enemy attacks with your shield",
        target: 5,
        reward: 150,
        icon: "🛡️",
        badge: "DEFENSE"
      },
      {
        id: "daily_dodge_4",
        type: "dodge",
        title: "Shadow Dash",
        desc: "Perform 4 tactical Dodge Dashes during combat",
        target: 4,
        reward: 140,
        icon: "💨",
        badge: "EVASION"
      },
      {
        id: "daily_special_3",
        type: "special",
        title: "Overdrive Surge",
        desc: "Unleash 3 Special AoE shockwave attacks",
        target: 3,
        reward: 200,
        icon: "⚡",
        badge: "ENERGY"
      },
      {
        id: "daily_thugs_3",
        type: "defeat_thugs",
        title: "Street Sweeper",
        desc: "Defeat 3 Street Thugs or Minions in the city",
        target: 3,
        reward: 220,
        icon: "🥷",
        badge: "BOUNTY"
      },
      {
        id: "daily_boss_1",
        type: "defeat_boss",
        title: "Titan Slayer",
        desc: "Defeat Titan Kuro or an Elite Boss in combat",
        target: 1,
        reward: 350,
        icon: "👑",
        badge: "BOSS"
      },
      {
        id: "daily_combo_6",
        type: "combo",
        title: "Combo Virtuoso",
        desc: "Chain a 6-Hit or higher Combo in battle",
        target: 6,
        reward: 180,
        icon: "🔥",
        badge: "SKILL"
      },
      {
        id: "daily_coins_5",
        type: "coins",
        title: "Urban Scavenger",
        desc: "Collect 5 open-world Gold Coins across the city",
        target: 5,
        reward: 150,
        icon: "🪙",
        badge: "EXPLORE"
      },
      {
        id: "daily_dummy_12",
        type: "dummy",
        title: "Dojo Discipline",
        desc: "Land 12 strikes on the Dojo Training Dummy",
        target: 12,
        reward: 140,
        icon: "🎯",
        badge: "TRAINING"
      },
      {
        id: "daily_mission_1",
        type: "complete_mission",
        title: "Contract Finisher",
        desc: "Complete any Mission or Bounty on the board",
        target: 1,
        reward: 250,
        icon: "📜",
        badge: "CONTRACT"
      },
      {
        id: "daily_heavy_punch_8",
        type: "heavy_punch",
        title: "Heavy Impact",
        desc: "Land 8 Heavy Punches on combat targets",
        target: 8,
        reward: 170,
        icon: "💥",
        badge: "POWER"
      }
    ];

    this.init();
  }

  getTodayDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  init() {
    this.loadDailyTasks();
  }

  /**
   * Generates three specific, randomized tasks for the current day.
   * If today's tasks already exist and match today's date, they are preserved.
   */
  generateDailyTasks(forceNew = false) {
    const today = this.getTodayDateString();

    if (!forceNew && this.tasks && this.tasks.length === 3 && this.currentDate === today) {
      return this.tasks;
    }

    // Shuffle task pool to pick 3 distinct randomized tasks
    const poolCopy = [...this.taskPool];
    for (let i = poolCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [poolCopy[i], poolCopy[j]] = [poolCopy[j], poolCopy[i]];
    }

    const selected = poolCopy.slice(0, 3).map((template, idx) => ({
      id: `${template.id}_${today}_${idx}`,
      type: template.type,
      title: template.title,
      desc: template.desc,
      target: template.target,
      current: 0,
      reward: template.reward,
      icon: template.icon,
      badge: template.badge,
      completed: false,
      claimed: false
    }));

    this.currentDate = today;
    this.tasks = selected;
    this.allBonusClaimed = false;
    this.saveDailyTasks();

    console.log("DailyMissionManager: Generated 3 fresh tasks for", today, this.tasks);
    return this.tasks;
  }

  loadDailyTasks() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const today = this.getTodayDateString();

      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.date === today && Array.isArray(parsed.tasks) && parsed.tasks.length === 3) {
          this.currentDate = parsed.date;
          this.tasks = parsed.tasks;
          this.allBonusClaimed = !!parsed.allBonusClaimed;
          return;
        }
      }
    } catch (e) {
      console.warn("DailyMissionManager: Error reading storage, generating new:", e);
    }

    // Generate new tasks if absent or date has rolled over
    this.generateDailyTasks(true);
  }

  saveDailyTasks() {
    try {
      const payload = {
        date: this.currentDate,
        tasks: this.tasks,
        allBonusClaimed: this.allBonusClaimed
      };
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
      if (this.game && typeof this.game.saveData === "function") {
        this.game.saveData();
      }
    } catch (e) {
      console.warn("DailyMissionManager: Error saving daily tasks:", e);
    }
  }

  /**
   * Universal progress recorder for daily mission objectives
   */
  recordProgress(type, amount = 1) {
    if (!this.tasks || this.tasks.length === 0) return;

    let hasChanged = false;

    this.tasks.forEach(task => {
      if (task.claimed) return;

      let matched = false;

      if (task.type === type) {
        matched = true;
      } else if (task.type === "punch" && type === "heavy_punch") {
        // Heavy punches also count toward regular punches
        matched = true;
      }

      if (matched) {
        const prev = task.current;
        if (task.type === "combo") {
          task.current = Math.min(task.target, Math.max(task.current, amount));
        } else {
          task.current = Math.min(task.target, task.current + amount);
        }

        if (task.current !== prev) {
          hasChanged = true;
          if (task.current >= task.target && !task.completed) {
            task.completed = true;
            this.onTaskCompleted(task);
          }
        }
      }
    });

    if (hasChanged) {
      this.saveDailyTasks();
      this.refreshUIIfVisible();
    }
  }

  onTaskCompleted(task) {
    if (this.game) {
      if (this.game.audio && typeof this.game.audio.playMissionComplete === "function") {
        this.game.audio.playMissionComplete();
      }
      if (typeof this.game.showToast === "function") {
        this.game.showToast(`⭐ DAILY MISSION COMPLETE: ${task.title}! Claim +${task.reward} Coins in Mission Board!`);
      }
      // Also advance the player's daily streak if they haven't completed any mission today
      if (this.game.missions && this.game.missions.tracker) {
        this.game.missions.tracker.onMissionCompleted({
          id: `daily_${task.id}`,
          title: `Daily: ${task.title}`,
          coins: task.reward,
          xp: 80
        });
      }
    }
  }

  // --- Event Trigger Hooks ---
  onPunch(isHeavy = false) {
    this.recordProgress(isHeavy ? "heavy_punch" : "punch", 1);
  }

  onKick() {
    this.recordProgress("kick", 1);
  }

  onBlock() {
    this.recordProgress("block", 1);
  }

  onDodge() {
    this.recordProgress("dodge", 1);
  }

  onSpecial() {
    this.recordProgress("special", 1);
  }

  onCombo(hitCount) {
    this.recordProgress("combo", hitCount);
  }

  onCoinCollected() {
    this.recordProgress("coins", 1);
  }

  onDummyHit() {
    this.recordProgress("dummy", 1);
  }

  onEnemyDefeated(enemy) {
    if (!enemy) return;
    if (enemy.type === "boss" || enemy.isBoss) {
      this.recordProgress("defeat_boss", 1);
    } else {
      this.recordProgress("defeat_thugs", 1);
    }
  }

  onMissionCompleted(mission) {
    this.recordProgress("complete_mission", 1);
  }

  /**
   * Claim coin reward for a specific completed daily task
   */
  claimReward(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return false;

    if (!task.completed || task.claimed) {
      return false;
    }

    task.claimed = true;

    if (this.game) {
      if (typeof this.game.addCoins === "function") {
        this.game.addCoins(task.reward);
      }
      if (this.game.audio && typeof this.game.audio.playCoin === "function") {
        this.game.audio.playCoin();
      }
      if (typeof this.game.showToast === "function") {
        this.game.showToast(`🪙 Claimed +${task.reward} Coins for '${task.title}'!`);
      }
    }

    this.saveDailyTasks();
    this.refreshUIIfVisible();

    // Check if all 3 tasks are now completed
    const allDone = this.tasks.every(t => t.completed);
    if (allDone && !this.allBonusClaimed) {
      if (this.game && typeof this.game.showToast === "function") {
        setTimeout(() => {
          this.game.showToast(`👑 TRIPLE CROWN UNLOCKED! Claim your +${this.allBonusReward} Grand Bonus!`);
        }, 1200);
      }
    }

    return true;
  }

  /**
   * Claim the All-3 Daily Mission "Triple Crown" Grand Bonus
   */
  claimAllBonus() {
    const allDone = this.tasks.length === 3 && this.tasks.every(t => t.completed);
    if (!allDone || this.allBonusClaimed) {
      return false;
    }

    this.allBonusClaimed = true;

    if (this.game) {
      if (typeof this.game.addCoins === "function") {
        this.game.addCoins(this.allBonusReward);
      }
      if (this.game.audio && typeof this.game.audio.playMissionComplete === "function") {
        this.game.audio.playMissionComplete();
      }
      if (typeof this.game.showToast === "function") {
        this.game.showToast(`🎉 TRIPLE CROWN BONUS CLAIMED! +${this.allBonusReward} Coins awarded!`);
      }
    }

    this.saveDailyTasks();
    this.refreshUIIfVisible();
    return true;
  }

  getCompletedCount() {
    return this.tasks.filter(t => t.completed).length;
  }

  getClaimedCount() {
    return this.tasks.filter(t => t.claimed).length;
  }

  refreshUIIfVisible() {
    const container = document.getElementById("daily-missions-container");
    if (container && container.offsetParent !== null) {
      this.renderDailyMissions(container);
    }

    // Also update HUD daily indicator pill if present
    const hudPill = document.getElementById("hud-daily-counter");
    if (hudPill) {
      hudPill.innerText = `${this.getCompletedCount()}/3`;
    }
  }

  /**
   * Renders the Daily Mission widget inside the provided DOM element
   */
  renderDailyMissions(containerEl) {
    if (!containerEl) {
      containerEl = document.getElementById("daily-missions-container");
    }
    if (!containerEl) return;

    const completedCount = this.getCompletedCount();
    const claimedCount = this.getClaimedCount();
    const allDone = this.tasks.length === 3 && completedCount === 3;

    let cardsHtml = "";
    this.tasks.forEach(task => {
      const pct = Math.min(100, Math.round((task.current / task.target) * 100));
      const isDone = task.completed;
      const isClaimed = task.claimed;

      let btnHtml = "";
      if (isClaimed) {
        btnHtml = `<button class="btn-daily-claim btn-daily-claimed" disabled>✅ CLAIMED</button>`;
      } else if (isDone) {
        btnHtml = `<button class="btn-daily-claim btn-daily-ready" data-task-id="${task.id}">CLAIM +${task.reward} 🪙</button>`;
      } else {
        btnHtml = `<button class="btn-daily-claim btn-daily-progress" disabled>${task.current}/${task.target}</button>`;
      }

      cardsHtml += `
        <div class="daily-task-card ${isDone ? "completed" : ""} ${isClaimed ? "claimed" : ""}">
          <div class="daily-task-header">
            <div class="daily-task-icon-wrap">
              <span class="daily-task-icon">${task.icon}</span>
            </div>
            <div class="daily-task-info">
              <div class="daily-task-title-row">
                <span class="daily-task-badge">${task.badge}</span>
                <span class="daily-task-title">${task.title}</span>
              </div>
              <div class="daily-task-desc">${task.desc}</div>
            </div>
            <div class="daily-task-reward-tag">
              🪙 +${task.reward}
            </div>
          </div>

          <div class="daily-task-progress-wrap">
            <div class="daily-task-progress-bar">
              <div class="daily-task-progress-fill" style="width: ${pct}%;"></div>
            </div>
            <div class="daily-task-progress-text">${task.current} / ${task.target} (${pct}%)</div>
          </div>

          <div class="daily-task-action-row">
            ${btnHtml}
          </div>
        </div>
      `;
    });

    // Grand Triple Bonus Section
    let grandBonusHtml = "";
    if (this.allBonusClaimed) {
      grandBonusHtml = `
        <div class="daily-grand-bonus-banner bonus-claimed">
          <div class="grand-bonus-left">
            <span class="grand-bonus-icon">👑</span>
            <div class="grand-bonus-text">
              <div class="grand-bonus-title">TRIPLE CROWN BONUS CLAIMED</div>
              <div class="grand-bonus-sub">All 3 daily missions completed for today (+${this.allBonusReward} Coins)</div>
            </div>
          </div>
          <div class="grand-bonus-tag">COMPLETED ✓</div>
        </div>
      `;
    } else if (allDone) {
      grandBonusHtml = `
        <div class="daily-grand-bonus-banner bonus-ready">
          <div class="grand-bonus-left">
            <span class="grand-bonus-icon">👑</span>
            <div class="grand-bonus-text">
              <div class="grand-bonus-title">ALL 3 DAILIES COMPLETED!</div>
              <div class="grand-bonus-sub">Triple Crown Bonus is ready to collect!</div>
            </div>
          </div>
          <button id="btn-claim-grand-daily" class="btn-primary btn-claim-grand-daily">
            CLAIM +${this.allBonusReward} 🪙 BONUS
          </button>
        </div>
      `;
    } else {
      grandBonusHtml = `
        <div class="daily-grand-bonus-banner bonus-pending">
          <div class="grand-bonus-left">
            <span class="grand-bonus-icon">👑</span>
            <div class="grand-bonus-text">
              <div class="grand-bonus-title">TRIPLE CROWN BONUS (+${this.allBonusReward} COINS)</div>
              <div class="grand-bonus-sub">Complete all 3 randomized tasks today to unlock the grand reward!</div>
            </div>
          </div>
          <div class="grand-bonus-tag">${completedCount}/3 COMPLETED</div>
        </div>
      `;
    }

    containerEl.innerHTML = `
      <div class="daily-missions-panel">
        <div class="daily-missions-panel-header">
          <div class="daily-panel-title-group">
            <span class="daily-star-icon">⭐</span>
            <div>
              <div class="daily-panel-title">TODAY'S DAILY MISSIONS</div>
              <div class="daily-panel-sub">3 Randomized Tasks Each Day • Bonus Coins Reward</div>
            </div>
          </div>
          <div class="daily-panel-status-pill ${allDone ? "done" : "active"}">
            ${completedCount}/3 COMPLETED
          </div>
        </div>

        <div class="daily-tasks-grid">
          ${cardsHtml}
        </div>

        ${grandBonusHtml}
      </div>
    `;

    // Bind individual claim buttons
    containerEl.querySelectorAll(".btn-daily-ready").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.taskId;
        if (taskId) {
          this.claimReward(taskId);
        }
      });
    });

    // Bind grand bonus claim button
    const grandBtn = containerEl.querySelector("#btn-claim-grand-daily");
    if (grandBtn) {
      grandBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.claimAllBonus();
      });
    }
  }
}

window.DailyMissionManager = DailyMissionManager;
