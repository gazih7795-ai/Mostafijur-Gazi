// TOM FIGHT - MissionTracker Module (mission-tracker.js)
// Manages:
// 1. Persistent 'Task Queue' HUD updates (sub-objectives, checkboxes, milestone pulses).
// 2. 'Daily Mission Streak' System: Tracks consecutive days with >= 1 mission completed,
//    awards bonus coin multipliers for daily streaks, and renders a persistent calendar widget.

class MissionTracker {
  constructor(missionManager) {
    this.missions = missionManager;
    this.container = document.getElementById("task-queue-container");
    this.listEl = document.getElementById("task-queue-list");
    this.progressEl = document.getElementById("task-queue-progress");
    this.cachedTasksHash = "";
    this.lastMilestoneNotification = "";

    // Daily Mission Streak state
    this.dailyMissionStreak = 0;
    this.lastMissionCompletedDate = null;
    this.completedMissionDates = new Set();

    // Calendar navigation state (defaults to current date)
    const now = new Date();
    this.viewCalendarYear = now.getFullYear();
    this.viewCalendarMonth = now.getMonth(); // 0-indexed

    // Initialize from local storage or cached storage
    this.loadStreakData();
  }

  /**
   * Helper to format a Date object into 'YYYY-MM-DD'
   */
  getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  getTodayDateString() {
    return this.getLocalDateString(new Date());
  }

  getYesterdayDateString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return this.getLocalDateString(d);
  }

  hasCompletedMissionToday() {
    return this.lastMissionCompletedDate === this.getTodayDateString();
  }

  /**
   * Calculate daily streak coin reward based on streak day
   */
  getStreakBonus(streakDay) {
    if (streakDay <= 0) return 0;
    const rewards = [0, 60, 120, 180, 250, 350, 450, 600];
    if (streakDay <= 7) return rewards[streakDay];
    // Past day 7: 600 base + 50 per day, capped at 1200
    return Math.min(1200, 600 + (streakDay - 7) * 50);
  }

  loadStreakData() {
    try {
      const raw = localStorage.getItem("tom_fight_mission_streak_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.dailyMissionStreak !== undefined) {
          this.dailyMissionStreak = Number(parsed.dailyMissionStreak) || 0;
        }
        if (parsed.lastMissionCompletedDate) {
          this.lastMissionCompletedDate = String(parsed.lastMissionCompletedDate);
        }
        if (Array.isArray(parsed.completedMissionDates)) {
          this.completedMissionDates = new Set(parsed.completedMissionDates);
        }
      }
    } catch (e) {
      console.warn("MissionTracker: Error reading streak data:", e);
    }
  }

  saveStreakData() {
    try {
      const data = {
        dailyMissionStreak: this.dailyMissionStreak,
        lastMissionCompletedDate: this.lastMissionCompletedDate,
        completedMissionDates: Array.from(this.completedMissionDates)
      };
      localStorage.setItem("tom_fight_mission_streak_v1", JSON.stringify(data));
      if (this.missions && this.missions.game && typeof this.missions.game.saveData === "function") {
        this.missions.game.saveData();
      }
    } catch (e) {
      console.warn("MissionTracker: Error saving streak data:", e);
    }
  }

  /**
   * Called whenever any mission is successfully completed by MissionManager.
   * Increments daily streak if this is the first completion of the day,
   * grants bonus coins, records date, and updates the calendar widget.
   */
  onMissionCompleted(mission) {
    const todayStr = this.getTodayDateString();
    const yesterdayStr = this.getYesterdayDateString();
    let isNewDayForStreak = false;
    let awardedCoins = 0;

    this.completedMissionDates.add(todayStr);

    if (this.lastMissionCompletedDate === todayStr) {
      // Already credited streak for today; maintain streak count
      isNewDayForStreak = false;
    } else {
      isNewDayForStreak = true;
      if (this.lastMissionCompletedDate === yesterdayStr) {
        // Maintained consecutive streak
        this.dailyMissionStreak += 1;
      } else {
        // Missed one or more days, start streak at 1
        this.dailyMissionStreak = 1;
      }

      this.lastMissionCompletedDate = todayStr;
      awardedCoins = this.getStreakBonus(this.dailyMissionStreak);

      if (this.missions && this.missions.game) {
        if (typeof this.missions.game.addCoins === "function" && awardedCoins > 0) {
          this.missions.game.addCoins(awardedCoins);
        }
        if (typeof this.missions.game.showToast === "function") {
          this.missions.game.showToast(`🔥 DAILY MISSION STREAK: Day ${this.dailyMissionStreak}! +${awardedCoins} Streak Coins!`);
        }
        if (this.missions.game.audio && typeof this.missions.game.audio.playCoin === "function") {
          this.missions.game.audio.playCoin();
        }
      }
    }

    this.saveStreakData();

    // Re-render calendar widget if open in mission modal
    const calContainer = document.getElementById("mission-streak-calendar");
    if (calContainer) {
      this.renderCalendarWidget(calContainer);
    }

    return {
      isNewDayForStreak,
      streak: this.dailyMissionStreak,
      bonusCoins: awardedCoins
    };
  }

  /**
   * Renders the persistent Daily Mission Streak Calendar Widget into the provided container.
   */
  renderCalendarWidget(containerEl) {
    if (!containerEl) {
      containerEl = document.getElementById("mission-streak-calendar");
    }
    if (!containerEl) return;

    const today = new Date();
    const todayStr = this.getTodayDateString();
    const isCompletedToday = this.hasCompletedMissionToday();
    const currentStreak = this.dailyMissionStreak;
    const nextBonus = this.getStreakBonus(isCompletedToday ? currentStreak + 1 : currentStreak || 1);

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Current month view info
    const year = this.viewCalendarYear;
    const month = this.viewCalendarMonth;
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    // 7-Day Cycle Progress (1-7)
    const cycleDay = currentStreak === 0 ? 0 : ((currentStreak - 1) % 7) + 1;

    // Build 7-Day Milestone Nodes
    const milestones = [
      { day: 1, reward: 60, icon: "🪙" },
      { day: 2, reward: 120, icon: "🪙" },
      { day: 3, reward: 180, icon: "🪙" },
      { day: 4, reward: 250, icon: "🪙" },
      { day: 5, reward: 350, icon: "⚡" },
      { day: 6, reward: 450, icon: "🔥" },
      { day: 7, reward: 600, icon: "👑" }
    ];

    const milestoneHtml = milestones.map(m => {
      const isClaimed = cycleDay >= m.day;
      const isCurrent = cycleDay === m.day;
      const statusClass = isClaimed ? "claimed" : (isCurrent ? "current" : "upcoming");
      return `
        <div class="streak-step ${statusClass}" title="Day ${m.day}: +${m.reward} Coins">
          <div class="streak-step-circle">
            ${isClaimed ? "✓" : m.icon}
          </div>
          <div class="streak-step-label">D${m.day}</div>
          <div class="streak-step-reward">+${m.reward}</div>
        </div>
      `;
    }).join("");

    // Build Calendar Day Grid cells
    let dayCellsHtml = "";
    // Empty prefix cells
    for (let i = 0; i < firstDayIndex; i++) {
      dayCellsHtml += `<div class="cal-day-cell cal-empty"></div>`;
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = this.getLocalDateString(dateObj);
      const isToday = dateStr === todayStr;
      const isCompleted = this.completedMissionDates.has(dateStr);
      const isFuture = dateObj > today && !isToday;
      const isPast = dateObj < today && !isToday;

      let cellClass = "cal-day-cell";
      if (isToday) cellClass += " cal-today";
      if (isCompleted) cellClass += " cal-completed";
      if (isFuture) cellClass += " cal-future";
      if (isPast && !isCompleted) cellClass += " cal-missed";

      dayCellsHtml += `
        <div class="${cellClass}" data-date="${dateStr}">
          <span class="cal-day-num">${d}</span>
          ${isCompleted ? `<span class="cal-day-stamp">🔥</span>` : (isToday ? `<span class="cal-today-dot"></span>` : "")}
        </div>
      `;
    }

    // Compose Full Widget Markup
    containerEl.innerHTML = `
      <div class="streak-calendar-card">
        <!-- Top Streak Banner -->
        <div class="streak-card-header">
          <div class="streak-badge-left">
            <span class="streak-flame-icon">🔥</span>
            <div class="streak-info-text">
              <div class="streak-count-title">${currentStreak} DAY STREAK</div>
              <div class="streak-sub-text">
                ${isCompletedToday ? "Mission completed today! Streak preserved." : "Complete 1 mission today to extend streak!"}
              </div>
            </div>
          </div>
          <div class="streak-status-pill ${isCompletedToday ? "status-done" : "status-pending"}">
            ${isCompletedToday ? "✅ TODAY COMPLETE" : "⏳ TODAY PENDING"}
          </div>
        </div>

        <!-- 7-Day Reward Cycle Track -->
        <div class="streak-milestones-track">
          <div class="streak-track-header">
            <span>7-DAY STREAK CYCLE REWARDS</span>
            <span class="next-reward-tag">Next Bonus: 🪙 +${nextBonus}</span>
          </div>
          <div class="streak-steps-row">
            ${milestoneHtml}
          </div>
        </div>

        <!-- Month Navigation Bar -->
        <div class="cal-nav-bar">
          <button id="cal-nav-prev" class="cal-nav-btn" title="Previous Month">◀</button>
          <div class="cal-month-title">${monthNames[month].toUpperCase()} ${year}</div>
          <button id="cal-nav-next" class="cal-nav-btn" title="Next Month">▶</button>
          <button id="cal-nav-today" class="cal-today-btn">TODAY</button>
        </div>

        <!-- Days of Week Header -->
        <div class="cal-week-row">
          <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
        </div>

        <!-- Calendar Month Grid -->
        <div class="cal-grid">
          ${dayCellsHtml}
        </div>

        <!-- Bottom Legend & Helpful Hint -->
        <div class="cal-legend-bar">
          <div class="cal-legend-item">
            <span class="cal-legend-dot dot-completed"></span>
            <span>Mission Completed</span>
          </div>
          <div class="cal-legend-item">
            <span class="cal-legend-dot dot-today"></span>
            <span>Today</span>
          </div>
          <div class="cal-legend-item">
            <span class="cal-legend-dot dot-missed"></span>
            <span>No Mission</span>
          </div>
        </div>
      </div>
    `;

    // Bind Month Navigation Events
    const prevBtn = containerEl.querySelector("#cal-nav-prev");
    const nextBtn = containerEl.querySelector("#cal-nav-next");
    const todayBtn = containerEl.querySelector("#cal-nav-today");

    if (prevBtn) {
      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.viewCalendarMonth--;
        if (this.viewCalendarMonth < 0) {
          this.viewCalendarMonth = 11;
          this.viewCalendarYear--;
        }
        this.renderCalendarWidget(containerEl);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.viewCalendarMonth++;
        if (this.viewCalendarMonth > 11) {
          this.viewCalendarMonth = 0;
          this.viewCalendarYear++;
        }
        this.renderCalendarWidget(containerEl);
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const n = new Date();
        this.viewCalendarYear = n.getFullYear();
        this.viewCalendarMonth = n.getMonth();
        this.renderCalendarWidget(containerEl);
      });
    }
  }

  /**
   * Called whenever a new mission starts.
   * Resets internal caching and immediately renders the fresh sub-objectives.
   */
  onMissionStarted(mission) {
    this.cachedTasksHash = "";
    this.lastMilestoneNotification = "";
    this.update();

    if (this.container) {
      this.container.classList.remove("pulse-milestone");
      void this.container.offsetWidth; // Force reflow
      this.container.classList.add("pulse-milestone");
    }
  }

  /**
   * Called when an objective milestone is achieved or progress updates.
   */
  onMilestoneReached(milestoneKey, notificationText) {
    if (this.lastMilestoneNotification !== milestoneKey) {
      this.lastMilestoneNotification = milestoneKey;
      if (this.container) {
        this.container.classList.remove("pulse-milestone");
        void this.container.offsetWidth; // Force reflow
        this.container.classList.add("pulse-milestone");
      }
    }
    this.update();
  }

  /**
   * Dynamically pushes sub-objectives into the #task-queue-list container
   * with accurate completion states, checkboxes, progress badges, and animations.
   */
  update() {
    if (!this.listEl || !this.missions) return;

    const items = this.missions.getTaskQueueItems();
    const completedCount = items.filter(t => t.completed).length;

    if (this.progressEl) {
      this.progressEl.innerText = `${completedCount}/${items.length}`;
      if (completedCount === items.length && items.length > 0) {
        this.progressEl.classList.add("all-done");
      } else {
        this.progressEl.classList.remove("all-done");
      }
    }

    // Generate a hash to prevent needless DOM replacement if items haven't changed
    const currentHash = items.map(t => `${t.id}:${t.completed}:${t.current}/${t.target}`).join("|");
    if (currentHash === this.cachedTasksHash) {
      return;
    }
    this.cachedTasksHash = currentHash;

    // Find the first non-completed sub-objective to highlight as active
    let foundActive = false;

    this.listEl.innerHTML = items.map(task => {
      let statusClass = "pending";
      if (task.completed) {
        statusClass = "completed";
      } else if (!foundActive) {
        statusClass = "active";
        foundActive = true;
      }

      const checkMark = task.completed ? "✓" : "";
      const countText = (task.target > 1 && !task.completed)
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

window.MissionTracker = MissionTracker;
