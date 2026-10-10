// TOM FIGHT - Real-time 2D Mini-Map & Radar UI Component (Street View vs Neighborhood View)
class MiniMap {
  constructor(game) {
    this.game = game;
    this.container = document.getElementById("minimap-container");
    this.canvas = document.getElementById("minimap-canvas");
    this.tagEl = document.getElementById("minimap-tag");
    this.zoomBadgeEl = document.getElementById("minimap-zoom-badge");
    this.compassEl = document.getElementById("minimap-compass");
    this.compassArrowEl = document.getElementById("compass-arrow");
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext("2d");

    // Zoom Levels: "street" (2.4x tactical close-up centered on Tom) vs "neighborhood" (1.0x wide city overview)
    this.zoomLevel = "street";
    this.streetZoomFactor = 2.4;

    // Offscreen canvas cache for static city layout (streets, districts, buildings, grid)
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");

    // World dimension range (-65 to 65 -> 130 total width)
    this.worldBounds = {
      minX: -65,
      maxX: 65,
      minZ: -65,
      maxZ: 65,
      size: 130
    };

    // Cached building footprints for 2D rendering
    this.cityBuildings = [
      // Northeast
      { x: 22, z: 22, w: 16, d: 16, color: "#1e293b", stroke: "#38bdf8" },
      { x: 42, z: 22, w: 14, d: 14, color: "#1e293b", stroke: "#475569" },
      { x: 22, z: 42, w: 14, d: 14, color: "#1e293b", stroke: "#475569" },
      { x: 42, z: 42, w: 16, d: 16, color: "#1e293b", stroke: "#38bdf8" },

      // Northwest (Downtown Neon)
      { x: -22, z: 22, w: 16, d: 16, color: "#1e293b", stroke: "#f43f5e" },
      { x: -42, z: 22, w: 14, d: 14, color: "#1e293b", stroke: "#06b6d4" },
      { x: -22, z: 42, w: 14, d: 14, color: "#1e293b", stroke: "#8b5cf6" },
      { x: -42, z: 42, w: 16, d: 16, color: "#1e293b", stroke: "#f43f5e" },

      // Southwest
      { x: -22, z: -22, w: 16, d: 16, color: "#1e293b", stroke: "#475569" },
      { x: -42, z: -22, w: 14, d: 14, color: "#1e293b", stroke: "#475569" },
      { x: -22, z: -42, w: 14, d: 14, color: "#1e293b", stroke: "#475569" },
      { x: -42, z: -42, w: 16, d: 16, color: "#1e293b", stroke: "#475569" },

      // Southeast
      { x: 22, z: -22, w: 14, d: 14, color: "#1e293b", stroke: "#475569" },
      { x: 44, z: -22, w: 16, d: 14, color: "#1e293b", stroke: "#ef4444" },
      { x: 22, z: -44, w: 14, d: 16, color: "#1e293b", stroke: "#475569" }
    ];

    this.bindEvents();
    this.updateZoomUI();

    // Initial render of the static city layout onto the offscreen cache
    this.updateStaticCache();
  }

  bindEvents() {
    if (!this.container) return;
    this.container.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleZoom();
    });
  }

  toggleZoom() {
    // Toggle between Street View (close-up) and Neighborhood View (full city)
    this.zoomLevel = (this.zoomLevel === "street") ? "neighborhood" : "street";
    this.updateZoomUI();

    if (this.game && this.game.audio) {
      this.game.audio.playDodge();
    }
  }

  updateZoomUI() {
    if (this.tagEl) {
      this.tagEl.innerText = (this.zoomLevel === "street") ? "STREET VIEW" : "NEIGHBORHOOD";
    }
    if (this.zoomBadgeEl) {
      this.zoomBadgeEl.innerText = (this.zoomLevel === "street") ? "2.4x" : "1.0x";
    }
    if (this.container) {
      if (this.zoomLevel === "street") {
        this.container.classList.add("street-view");
        this.container.classList.remove("neighborhood-view");
      } else {
        this.container.classList.add("neighborhood-view");
        this.container.classList.remove("street-view");
      }
    }
  }

  // Convert 3D world (X, Z) to base canvas coords (X, Y)
  worldToMap(wx, wz, pad, mapW, mapH) {
    const scaleX = (mapW - 2 * pad) / this.worldBounds.size;
    const scaleZ = (mapH - 2 * pad) / this.worldBounds.size;
    return {
      x: pad + (wx - this.worldBounds.minX) * scaleX,
      y: pad + (wz - this.worldBounds.minZ) * scaleZ
    };
  }

  // Render static elements (grid, roads, districts, building footprints) ONCE to offscreen canvas
  updateStaticCache() {
    if (!this.offscreenCtx || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.offscreenCtx;
    const pad = 6;

    this.offscreenCanvas.width = w;
    this.offscreenCanvas.height = h;

    ctx.clearRect(0, 0, w, h);

    // 1. Radar Background & Outer Fill
    ctx.fillStyle = "rgba(10, 13, 24, 0.95)";
    ctx.fillRect(0, 0, w, h);

    // Subtle radar grid lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, pad);
    ctx.lineTo(w / 2, h - pad);
    ctx.moveTo(pad, h / 2);
    ctx.lineTo(w - pad, h / 2);
    ctx.stroke();

    // Concentric radar circles
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, (w - 2 * pad) * 0.45, 0, Math.PI * 2);
    ctx.arc(w / 2, h / 2, (w - 2 * pad) * 0.25, 0, Math.PI * 2);
    ctx.stroke();

    // 2. City Layout: Main Roads & Streets
    const centerPoint = this.worldToMap(0, 0, pad, w, h);
    const roadHalfWidth = 14 * ((w - 2 * pad) / this.worldBounds.size) * 0.5;

    // Asphalt Main Roads
    ctx.fillStyle = "#1e2230";
    // North-South Avenue
    ctx.fillRect(centerPoint.x - roadHalfWidth, pad, roadHalfWidth * 2, h - 2 * pad);
    // East-West Cross Street
    ctx.fillRect(pad, centerPoint.y - roadHalfWidth, w - 2 * pad, roadHalfWidth * 2);

    // Yellow Divider Lines
    ctx.strokeStyle = "rgba(250, 204, 21, 0.65)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(centerPoint.x, pad);
    ctx.lineTo(centerPoint.x, h - pad);
    ctx.moveTo(pad, centerPoint.y);
    ctx.lineTo(w - pad, centerPoint.y);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // 3. Special District Zones
    // A. Training Dojo (Northeast around 16, 16)
    const dojoPt = this.worldToMap(16, 16, pad, w, h);
    const dojoRadius = 14 * ((w - 2 * pad) / this.worldBounds.size) * 0.5;
    ctx.fillStyle = "rgba(245, 158, 11, 0.22)";
    ctx.strokeStyle = "rgba(245, 158, 11, 0.75)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.rect(dojoPt.x - dojoRadius, dojoPt.y - dojoRadius, dojoRadius * 2, dojoRadius * 2);
    ctx.fill();
    ctx.stroke();

    // B. Boss Arena (Southeast around 44, -44)
    const bossPt = this.worldToMap(44, -44, pad, w, h);
    const bossRadius = 18 * ((w - 2 * pad) / this.worldBounds.size) * 0.5;
    ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
    ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(bossPt.x, bossPt.y, bossRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // C. Downtown Neon District (Northwest around -28, 28)
    const neonPt = this.worldToMap(-28, 28, pad, w, h);
    const neonRadius = 18 * ((w - 2 * pad) / this.worldBounds.size) * 0.5;
    ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
    ctx.strokeStyle = "rgba(6, 182, 212, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(neonPt.x - neonRadius, neonPt.y - neonRadius, neonRadius * 2, neonRadius * 2);
    ctx.fill();
    ctx.stroke();

    // 4. City Buildings Footprints
    this.cityBuildings.forEach(b => {
      const bMin = this.worldToMap(b.x - b.w / 2, b.z - b.d / 2, pad, w, h);
      const bMax = this.worldToMap(b.x + b.w / 2, b.z + b.d / 2, pad, w, h);
      const bW = bMax.x - bMin.x;
      const bH = bMax.y - bMin.y;

      ctx.fillStyle = b.color;
      ctx.fillRect(bMin.x, bMin.y, bW, bH);
      ctx.strokeStyle = b.stroke;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(bMin.x, bMin.y, bW, bH);
    });
  }

  update(delta, time) {
    if (!this.ctx || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    const pad = 6;
    const tomPos = this.game.player ? this.game.player.pos : new THREE.Vector3(0, 0, 0);

    // Camera angle: keeps camera forward facing forward relative to player
    const camAngle = this.game.cameraYaw || 0;

    // Update compass arrow rotation so it indicates North relative to camera
    if (this.compassArrowEl) {
      const compassDeg = camAngle * (180 / Math.PI);
      this.compassArrowEl.style.transform = `rotate(${compassDeg}deg)`;
    }

    // Ensure offscreen cache dimensions match
    if (this.offscreenCanvas.width !== w || this.offscreenCanvas.height !== h) {
      this.updateStaticCache();
    }

    // 1. Clear Canvas Background
    ctx.fillStyle = "rgba(10, 13, 24, 0.95)";
    ctx.fillRect(0, 0, w, h);

    const tomMap = this.worldToMap(tomPos.x, tomPos.z, pad, w, h);
    const scaleFactor = (this.zoomLevel === "street") ? this.streetZoomFactor : 1.0;

    // 2. RENDER ROTATED WORLD WITH OFFSCREEN CACHE
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, pad, w - 2 * pad, h - 2 * pad);
    ctx.clip();

    if (this.zoomLevel === "street") {
      // Tactical Street View: Zoomed in 2.4x, centered on Tom, rotating with camera
      ctx.translate(w / 2, h / 2);
      ctx.rotate(camAngle);
      ctx.scale(this.streetZoomFactor, this.streetZoomFactor);
      ctx.translate(-tomMap.x, -tomMap.y);
    } else {
      // Neighborhood View: Full city overview rotating with camera
      ctx.translate(w / 2, h / 2);
      ctx.rotate(camAngle);
      ctx.translate(-w / 2, -h / 2);
    }

    // Draw cached static city layout
    ctx.drawImage(this.offscreenCanvas, 0, 0);

    // 3. DYNAMIC WORLD ELEMENTS
    // A. Uncollected Gold Coins
    if (this.game.world && this.game.world.coins) {
      ctx.fillStyle = "#facc15";
      const cr = (this.zoomLevel === "street" ? 1.5 : 1.1) / scaleFactor;
      this.game.world.coins.forEach(coin => {
        if (!coin.collected) {
          const cp = this.worldToMap(coin.pos.x, coin.pos.z, pad, w, h);
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, cr, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // B. Mission Beacons
    if (this.game.world && this.game.world.missionBeacons) {
      const activeMissionId = this.game.missions && this.game.missions.currentMission
        ? this.game.missions.currentMission.id
        : null;

      this.game.world.missionBeacons.forEach(b => {
        const bp = this.worldToMap(b.pos.x, b.pos.z, pad, w, h);
        const isActive = activeMissionId === b.id;
        const colorHex = this.getBeaconColor(b.id);
        const isBossBeacon = b.id === 5;

        if (isBossBeacon) {
          // Unique Prominent Marker for Mini-Boss Battle Location
          this.drawBossMarker(ctx, bp.x, bp.y, time, isActive ? "TITAN (ACTIVE)" : "BOSS ARENA", scaleFactor, camAngle);
        } else {
          // Standard Mission Beacon
          if (isActive) {
            const pulse = (2.5 + Math.sin(time * 6) * 1.5) / scaleFactor;
            ctx.fillStyle = "rgba(250, 204, 21, 0.35)";
            ctx.beginPath();
            ctx.arc(bp.x, bp.y, (5.0 / scaleFactor) + pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#facc15";
            ctx.lineWidth = 1.5 / scaleFactor;
            ctx.beginPath();
            ctx.arc(bp.x, bp.y, (4.0 / scaleFactor) + pulse, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.fillStyle = colorHex;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.0 / scaleFactor;
          ctx.beginPath();
          const r = (isActive ? 4.5 : 3.2) / scaleFactor;
          ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Beacon number label (counter-rotated so text remains horizontal)
          ctx.save();
          ctx.translate(bp.x, bp.y);
          ctx.rotate(-camAngle);
          ctx.fillStyle = "#ffffff";
          const fSize = Math.max(6.5, Math.round(7.5 / scaleFactor));
          ctx.font = `bold ${fSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`M${b.id}`, 0, -(6.5 / scaleFactor));
          ctx.restore();
        }
      });
    }

    // C. Active Enemies within 50-unit radius of Tom
    if (this.game.enemies && this.game.player) {
      const enemyRadius = 50.0; // 50-unit detection radius from Tom

      this.game.enemies.forEach(enemy => {
        if (enemy.state !== "dead") {
          const distToTom = enemy.pos.distanceTo(tomPos);
          const isBoss = enemy.type === "boss";

          if (isBoss || distToTom <= enemyRadius) {
            const ep = this.worldToMap(enemy.pos.x, enemy.pos.z, pad, w, h);

            if (isBoss) {
              // Unique Prominent Marker for Mini-Boss "Titan Kuro"
              this.drawBossMarker(ctx, ep.x, ep.y, time, "TITAN KURO", scaleFactor, camAngle);
            } else {
              // Regular enemy: Small red dot with pulsing threat halo
              const pulse = (0.8 + Math.sin(time * 8 + (enemy.id || 0)) * 0.5) / scaleFactor;
              const r = 2.4 / scaleFactor;

              ctx.fillStyle = "rgba(239, 68, 68, 0.45)";
              ctx.beginPath();
              ctx.arc(ep.x, ep.y, r + pulse, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = enemy.isBlocking ? "#38bdf8" : "#ef4444";
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 0.8 / scaleFactor;
              ctx.beginPath();
              ctx.arc(ep.x, ep.y, r, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          }
        }
      });
    }

    // D. Tom (Player Character)
    if (this.game.player) {
      const tp = tomMap;
      const r = 3.4 / scaleFactor;

      // In Street View, draw central radar crosshairs
      if (this.zoomLevel === "street") {
        ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
        ctx.lineWidth = 0.8 / scaleFactor;
        ctx.beginPath();
        ctx.moveTo(tp.x - 7 / scaleFactor, tp.y);
        ctx.lineTo(tp.x + 7 / scaleFactor, tp.y);
        ctx.moveTo(tp.x, tp.y - 7 / scaleFactor);
        ctx.lineTo(tp.x, tp.y + 7 / scaleFactor);
        ctx.stroke();
      }

      // Glowing Cyan Halo
      ctx.fillStyle = "rgba(56, 189, 248, 0.45)";
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, (5.5 / scaleFactor) + Math.sin(time * 5) * (1.2 / scaleFactor), 0, Math.PI * 2);
      ctx.fill();

      // Directional Facing Cone / Arrow
      const heading = this.game.player.rotationY;
      const arrowLength = (this.zoomLevel === "street" ? 8.5 : 7.0) / scaleFactor;
      const arrowTipX = tp.x + Math.sin(heading) * arrowLength;
      const arrowTipY = tp.y - Math.cos(heading) * arrowLength;

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.0 / scaleFactor;
      ctx.beginPath();
      ctx.moveTo(tp.x, tp.y);
      ctx.lineTo(arrowTipX, arrowTipY);
      ctx.stroke();

      // Tom's center dot in bright gold & cyan
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2 / scaleFactor;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore(); // Restore clipped & rotated context

    // 4. OFFSCREEN BOSS NAVIGATION POINTER (In Street View when boss is outside close-up view)
    if (this.zoomLevel === "street" && this.game.player) {
      const bossEnemy = this.game.enemies && this.game.enemies.find(e => e.type === "boss" && e.state !== "dead");
      if (bossEnemy) {
        const distToTom = bossEnemy.pos.distanceTo(tomPos);
        if (distToTom > 22.0) {
          this.drawBossOffscreenPointer(ctx, w, h, pad, bossEnemy.pos, tomPos, "TITAN KURO", camAngle);
        }
      } else if (this.game.world && this.game.world.missionBeacons) {
        const bossBeacon = this.game.world.missionBeacons.find(b => b.id === 5);
        if (bossBeacon) {
          const distToTom = bossBeacon.pos.distanceTo(tomPos);
          if (distToTom > 22.0) {
            this.drawBossOffscreenPointer(ctx, w, h, pad, bossBeacon.pos, tomPos, "BOSS ARENA", camAngle);
          }
        }
      }
    }
  }

  // Unique prominent icon/marker for mini-boss location (Titan Kuro & Boss Arena)
  drawBossMarker(ctx, x, y, time, label, scaleFactor = 1.0, camAngle = 0) {
    const pulse = (Math.sin(time * 6) * 2.5) / scaleFactor;
    const pulseOuter = (Math.sin(time * 4) * 4.0) / scaleFactor;
    const r = 6.5 / scaleFactor;

    // 1. Pulsing danger halo
    ctx.fillStyle = "rgba(239, 68, 68, 0.28)";
    ctx.beginPath();
    ctx.arc(x, y, (11.0 / scaleFactor) + pulseOuter, 0, Math.PI * 2);
    ctx.fill();

    // 2. High-threat glowing outer ring
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.8 / scaleFactor;
    ctx.beginPath();
    ctx.arc(x, y, (8.5 / scaleFactor) + pulse, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Spiked diamond boss badge
    ctx.fillStyle = "#b91c1c";
    ctx.strokeStyle = "#facc15"; // Golden crown border
    ctx.lineWidth = 1.4 / scaleFactor;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.3);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r * 1.3);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Counter-rotate label & symbol so it is always horizontal & legible
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-camAngle);

    // Inner Skull symbol
    ctx.fillStyle = "#facc15";
    const symbolSize = Math.max(7, Math.round(8 / scaleFactor));
    ctx.font = `bold ${symbolSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("☠", 0, 0);

    // 5. Boss Name Label with Dark Badge
    if (label) {
      const fontSize = Math.max(6.5, Math.round(7.5 / scaleFactor));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const tw = ctx.measureText(label).width;
      const bw = tw + (6 / scaleFactor);
      const bh = 10 / scaleFactor;
      const by = -(14 / scaleFactor);

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 0.8 / scaleFactor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-bw / 2, by - bh / 2, bw, bh, 3 / scaleFactor);
      } else {
        ctx.rect(-bw / 2, by - bh / 2, bw, bh);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fca5a5";
      ctx.fillText(label, 0, by);
    }

    ctx.restore();
  }

  // Off-screen Boss Navigation Pointer in Street View
  drawBossOffscreenPointer(ctx, w, h, pad, targetWorldPos, tomWorldPos, label, camAngle = 0) {
    const dx = targetWorldPos.x - tomWorldPos.x;
    const dz = targetWorldPos.z - tomWorldPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1) return;

    // Relative angle in canvas screen space (0 is UP, pointing in camera forward direction)
    const relAngle = Math.atan2(dx, -dz) + camAngle;

    const centerX = w / 2;
    const centerY = h / 2;
    const maxRadius = (Math.min(w, h) / 2) - pad - 6;

    const pointerX = centerX + Math.sin(relAngle) * maxRadius;
    const pointerY = centerY - Math.cos(relAngle) * maxRadius;

    // Draw prominent pointing chevron toward the boss
    ctx.save();
    ctx.translate(pointerX, pointerY);
    ctx.rotate(relAngle);

    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 3);
    ctx.lineTo(0, 1);
    ctx.lineTo(-4, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Distance badge near pointer
    const distText = `☠ ${Math.round(dist)}m`;
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const dtw = ctx.measureText(distText).width;

    const badgeX = Math.max(pad + dtw / 2 + 2, Math.min(w - pad - dtw / 2 - 2, pointerX));
    const badgeY = pointerY > centerY ? pointerY - 10 : pointerY + 10;

    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(badgeX - dtw / 2 - 2, badgeY - 5, dtw + 4, 10, 2);
    } else {
      ctx.rect(badgeX - dtw / 2 - 2, badgeY - 5, dtw + 4, 10);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#facc15";
    ctx.fillText(distText, badgeX, badgeY);
  }

  getBeaconColor(id) {
    switch (id) {
      case 1: return "#38bdf8"; // Training Day (Cyan)
      case 2: return "#f59e0b"; // Street Fight (Amber)
      case 3: return "#10b981"; // District Defense (Emerald)
      case 4: return "#8b5cf6"; // Survival Challenge (Purple)
      case 5: return "#ef4444"; // Titan Kuro (Crimson)
      default: return "#facc15";
    }
  }
}

window.MiniMap = MiniMap;
