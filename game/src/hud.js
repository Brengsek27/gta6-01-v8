// game/src/hud.js
// Dual-layout HUD for "KIBERA RISING" — make.fun gta6-01, round 8.
// Original code written for this entry. Builds all HUD DOM inside the #hud
// root element; styling arrives via style.css class names (session 3), so
// this file uses the exact class contract and no inline layout styles beyond
// dynamic values such as bar widths.

import { WEAPONS, RADIO, MISSIONS, rank, completion } from './systems.js';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

function img(src, cls) {
  const n = document.createElement('img');
  n.src = src;
  if (cls) n.className = cls;
  n.alt = '';
  return n;
}

function bar(cls) {
  const b = el('div', 'bar ' + cls);
  const f = el('div', 'fill');
  b.appendChild(f);
  return { bar: b, fill: f };
}

/**
 * Build the HUD.
 * @param {object} city City handle (used for radar street data).
 * @param {object} sim Simulation handle from makeSimulation.
 * @param {object} portrait makePortraits() map of dataURL portraits.
 * @returns {{update:Function, drive:HTMLElement, foot:HTMLElement, root:HTMLElement}}
 */
export function makeHUD(city, sim, portrait) {
  const root = document.getElementById('hud');
  if (!root) throw new Error('makeHUD: no #hud element');
  root.innerHTML = '';

  const st = sim.state;

  // ================= DRIVING LAYOUT =================
  const drive = el('div', 'hud-drive');

  // Left column: mission card + loadout card.
  const colLeft = el('div', 'hud-col-left');
  const missionCard = el('div', 'card mission-card');
  missionCard.appendChild(el('div', 'm-title', 'KIBERA RISING'));
  const district = el('div', 'm-district', 'Pasaru');
  missionCard.appendChild(district);
  const cashRow = el('div', 'm-cash-row');
  const cashEl = el('span', 'm-cash', '$7,270');
  const timeEl = el('span', 'm-time', '17:42');
  cashRow.appendChild(cashEl);
  cashRow.appendChild(timeEl);
  missionCard.appendChild(cashRow);
  colLeft.appendChild(missionCard);

  const loadoutCard = el('div', 'card loadout-card');
  loadoutCard.appendChild(el('div', 'card-title', 'LOADOUT'));
  const weaponRows = [];
  for (const w of WEAPONS) {
    const row = el('div', 'weapon-row');
    row.appendChild(el('span', 'w-name', w));
    const ammoEl = el('span', 'w-ammo', '—');
    row.appendChild(ammoEl);
    loadoutCard.appendChild(row);
    weaponRows.push({ row, ammoEl, name: w });
  }
  const hpWrap = el('div', 'hp-wrap');
  hpWrap.appendChild(el('span', 'hp-label', 'HP'));
  const hp = bar('hp');
  hpWrap.appendChild(hp.bar);
  const hpVal = el('span', 'hp-val', '100');
  hpWrap.appendChild(hpVal);
  loadoutCard.appendChild(hpWrap);
  const arWrap = el('div', 'ar-wrap');
  arWrap.appendChild(el('span', 'ar-label', 'AR'));
  const ar = bar('ar');
  arWrap.appendChild(ar.bar);
  const arVal = el('span', 'ar-val', '50');
  arWrap.appendChild(arVal);
  loadoutCard.appendChild(arWrap);
  colLeft.appendChild(loadoutCard);
  drive.appendChild(colLeft);

  // Top-centre: wanted stars + pursuit pill + heli tag.
  const starsWrap = el('div', 'stars-wrap');
  const stars = [];
  for (let i = 0; i < 5; i++) {
    const s = el('span', 'star', '★');
    starsWrap.appendChild(s);
    stars.push(s);
  }
  const pill = el('div', 'pill', 'ACTIVE PURSUIT');
  pill.style.display = 'none';
  starsWrap.appendChild(pill);
  starsWrap.appendChild(el('div', 'heli-tag', 'ELANG-1'));
  drive.appendChild(starsWrap);

  // Right column: tracker, response, crew chips.
  const colRight = el('div', 'hud-col-right');
  const trackerCard = el('div', 'card tracker-card');
  const trMission = el('div', 't-mission', 'Market Squeeze');
  trackerCard.appendChild(trMission);
  const trStage = el('div', 't-stage', 'STAGE 1/3');
  trackerCard.appendChild(trStage);
  const trObjective = el('div', 't-objective', '');
  trackerCard.appendChild(trObjective);
  const trNext = el('div', 't-next', '');
  trackerCard.appendChild(trNext);
  const trProg = bar('progress');
  trackerCard.appendChild(trProg.bar);
  colRight.appendChild(trackerCard);

  const responseCard = el('div', 'card response-card');
  responseCard.appendChild(el('div', 'card-title', 'RESPONSE'));
  const responseRows = [];
  for (let i = 0; i < 3; i++) {
    const row = el('div', 'resp-row');
    row.appendChild(el('span', 'resp-callsign', '—'));
    row.appendChild(el('span', 'resp-role chip', '—'));
    row.appendChild(el('span', 'resp-dist', '—'));
    responseCard.appendChild(row);
    responseRows.push(row);
  }
  colRight.appendChild(responseCard);

  const crewChips = el('div', 'crew-chips');
  const chipDefs = [
    { ability: 'SWAP PLATES', name: 'Mika', role: 'Driver', key: 'F', img: portrait.Mika },
    { ability: 'QUICK FIX', name: 'Rafi', role: 'Mechanic', key: 'G', img: portrait.Rafi },
    { ability: 'EYES OUT', name: 'Suri', role: 'Lookout', key: 'C', img: portrait.Suri },
  ];
  for (const c of chipDefs) {
    const chip = el('div', 'card crew-chip');
    chip.appendChild(img(c.img, 'chip-portrait'));
    chip.appendChild(el('div', 'chip-ability', c.ability));
    chip.appendChild(el('div', 'chip-name', c.name + ' · ' + c.role + ' — ' + c.key));
    crewChips.appendChild(chip);
  }
  colRight.appendChild(crewChips);
  drive.appendChild(colRight);

  // Bottom-left: radar.
  const radarWrap = el('div', 'radar-wrap');
  const radarCanvas = document.createElement('canvas');
  radarCanvas.className = 'radar';
  radarCanvas.width = 148;
  radarCanvas.height = 148;
  radarWrap.appendChild(radarCanvas);
  radarWrap.appendChild(el('div', 'radar-district', 'Pasaru'));
  drive.appendChild(radarWrap);

  // Bottom-centre: comms + dialogue.
  const dialogueWrap = el('div', 'dialogue-wrap');
  const commsLine = el('div', 'comms-line', '');
  dialogueWrap.appendChild(commsLine);
  const dialogueCard = el('div', 'card dialogue-card');
  const dlgImg = img(portrait.Mika, 'dlg-portrait');
  dialogueCard.appendChild(dlgImg);
  const dlgBody = el('div', 'dlg-body');
  const dlgSpeaker = el('div', 'dlg-speaker', 'Mika Kessang');
  const dlgText = el('div', 'dlg-text', '');
  dlgBody.appendChild(dlgSpeaker);
  dlgBody.appendChild(dlgText);
  dialogueCard.appendChild(dlgBody);
  dialogueWrap.appendChild(dialogueCard);
  drive.appendChild(dialogueWrap);

  // Bottom-right: speed cluster.
  const speedCluster = el('div', 'speed-cluster');
  const radioEl = el('div', 'radio-line', 'Kibera 101.9 · Strand Transmission');
  speedCluster.appendChild(radioEl);
  const speedNum = el('div', 'speed-number', '0');
  speedCluster.appendChild(speedNum);
  speedCluster.appendChild(el('div', 'speed-unit', 'KM/H'));
  const carLine = el('div', 'car-line', 'Sable GT · 100%');
  speedCluster.appendChild(carLine);
  const cond = bar('condition');
  speedCluster.appendChild(cond.bar);
  speedCluster.appendChild(el('div', 'key-hint', 'F · SWAP PLATES'));
  drive.appendChild(speedCluster);

  root.appendChild(drive);

  // ================= ON-FOOT LAYOUT =================
  const foot = el('div', 'hud-foot');

  const footMission = el('div', 'card mission-card big');
  footMission.appendChild(el('div', 'm-eyebrow', 'CAMPAIGN / STORY'));
  footMission.appendChild(el('div', 'm-number', 'MISSION 4'));
  footMission.appendChild(el('div', 'm-title', 'MISSION 4 - MARKET SQUEEZE'));
  footMission.appendChild(el('div', 'm-stage', 'STAGE 2/3 CLEAR THE AISLES'));
  const taskList = el('div', 'task-list');
  const taskRows = [];
  const taskDefs = [
    { mark: '✓', cls: 'done', text: 'Enter Pasaru' },
    { mark: '▶', cls: 'current', text: 'Clear the aisles' },
    { mark: '○', cls: 'open', text: 'Extract with Tomo' },
  ];
  for (const td of taskDefs) {
    const row = el('div', 'task-row ' + td.cls);
    row.appendChild(el('span', 'task-mark', td.mark));
    row.appendChild(el('span', 'task-text', td.text));
    taskList.appendChild(row);
    taskRows.push(row);
  }
  footMission.appendChild(taskList);
  const footProgRow = el('div', 'm-progress-row');
  footProgRow.appendChild(el('span', 'm-progress-label', 'PROGRESS'));
  const footProgVal = el('span', 'm-progress-val', '0%');
  footProgRow.appendChild(footProgVal);
  const footStars = el('span', 'm-stars', '★★★');
  footProgRow.appendChild(footStars);
  footMission.appendChild(footProgRow);
  const footProg = bar('progress');
  footMission.appendChild(footProg.bar);
  foot.appendChild(footMission);

  // Right column: funds, crew, action.
  const footRight = el('div', 'hud-col-right');
  const fundsCard = el('div', 'card crew-funds');
  fundsCard.appendChild(el('div', 'f-label', 'CREW FUNDS'));
  const fundsRow = el('div', 'f-row');
  fundsRow.appendChild(el('span', 'f-bag', '💰'));
  fundsRow.appendChild(el('span', 'f-money', '7,270'));
  fundsCard.appendChild(fundsRow);
  const fundsStars = el('div', 'f-stars');
  for (let i = 0; i < 5; i++) fundsStars.appendChild(el('span', 'star', '★'));
  fundsCard.appendChild(fundsStars);
  fundsCard.appendChild(el('div', 'f-units-label', 'UNITS RESPONDING'));
  const fundsUnits = el('div', 'f-units', '3');
  fundsCard.appendChild(fundsUnits);
  const fundsMeter = bar('units');
  fundsCard.appendChild(fundsMeter.bar);
  const fundsTop = el('div', 'f-top-unit', 'KPD-7 · Interceptor');
  fundsCard.appendChild(fundsTop);
  footRight.appendChild(fundsCard);

  const crewCard = el('div', 'card crew-card');
  crewCard.appendChild(img(portrait.Tomo, 'crew-portrait'));
  crewCard.appendChild(el('div', 'crew-eyebrow', 'WHEELMAN'));
  crewCard.appendChild(el('div', 'crew-name', 'Tomo Sagara'));
  crewCard.appendChild(el('div', 'crew-status', 'On your six'));
  footRight.appendChild(crewCard);

  const actionCard = el('div', 'card action-card');
  const actionHeader = el('div', 'a-header', 'CLEAR THE AISLES · Compact');
  actionCard.appendChild(actionHeader);
  const actionRows = [
    { ability: 'SWAP PLATES', desc: 'Lower police heat', key: 'F' },
    { ability: 'QUICK FIX', desc: '₹350 · Restore condition', key: 'G' },
  ];
  for (const ar2 of actionRows) {
    const row = el('div', 'action-row');
    row.appendChild(el('span', 'a-ability', ar2.ability));
    row.appendChild(el('span', 'a-desc', ar2.desc));
    row.appendChild(el('span', 'a-key', ar2.key));
    actionCard.appendChild(row);
  }
  footRight.appendChild(actionCard);
  foot.appendChild(footRight);

  // Bottom-left: small radar + compact HP/AR.
  const footRadarWrap = el('div', 'radar-wrap small');
  const footRadar = document.createElement('canvas');
  footRadar.className = 'radar';
  footRadar.width = 148;
  footRadar.height = 148;
  footRadarWrap.appendChild(footRadar);
  footRadarWrap.appendChild(el('div', 'radar-district', 'Pasaru'));
  foot.appendChild(footRadarWrap);

  const footHpAr = el('div', 'hp-ar');
  const fHp = bar('hp');
  const fAr = bar('ar');
  footHpAr.appendChild(el('span', 'hp-label', 'HP'));
  footHpAr.appendChild(fHp.bar);
  footHpAr.appendChild(el('span', 'ar-label', 'AR'));
  footHpAr.appendChild(fAr.bar);
  foot.appendChild(footHpAr);

  // Bottom-centre: dialogue (Mika / MARKET_LINE).
  const footDlgWrap = el('div', 'dialogue-wrap');
  const footComms = el('div', 'comms-line', '');
  footDlgWrap.appendChild(footComms);
  const footDlg = el('div', 'card dialogue-card');
  footDlg.appendChild(img(portrait.Mika, 'dlg-portrait'));
  const footDlgBody = el('div', 'dlg-body');
  footDlgBody.appendChild(el('div', 'dlg-speaker', 'MIKA KESSANG'));
  footDlgBody.appendChild(el('div', 'dlg-text', ''));
  footDlg.appendChild(footDlgBody);
  footDlgWrap.appendChild(footDlg);
  foot.appendChild(footDlgWrap);

  root.appendChild(foot);

  // ---- radar drawing ----
  function drawRadar(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    ctx.clearRect(0, 0, W, H);
    // Dark disc.
    ctx.fillStyle = 'rgba(8,14,20,0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, 72, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 72, 0, Math.PI * 2);
    ctx.clip();
    // Street grid (approximate city grid).
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    for (let gx = -60; gx <= 60; gx += 20) {
      const px = cx + gx * 0.55;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    }
    for (let gz = -60; gz <= 60; gz += 20) {
      const py = cy + gz * 0.55;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
    }
    // Coast edge (west side, blue).
    ctx.strokeStyle = 'rgba(80,180,220,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 58, 0); ctx.lineTo(cx - 58, H); ctx.stroke();
    // Avenue (vertical, amber).
    ctx.strokeStyle = 'rgba(255,180,80,0.7)';
    ctx.beginPath(); ctx.moveTo(cx - 12, 0); ctx.lineTo(cx - 12, H); ctx.stroke();
    // Objective: amber diamond at the market.
    const ox = cx + 18;
    const oy = cy + 26;
    ctx.fillStyle = '#ffb020';
    ctx.beginPath();
    ctx.moveTo(ox, oy - 6); ctx.lineTo(ox + 6, oy); ctx.lineTo(ox, oy + 6); ctx.lineTo(ox - 6, oy);
    ctx.closePath(); ctx.fill();
    // Blips: hero white, units blue/red.
    const heroPos = sim.hero ? sim.hero.group.position : null;
    if (heroPos) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    (sim.units || []).forEach((u, i) => {
      if (!u.active) return;
      const p = u.car.group.position;
      ctx.fillStyle = i % 2 === 0 ? '#3f8cff' : '#ff4444';
      ctx.beginPath();
      ctx.arc(cx + (p.x - (heroPos ? heroPos.x : 0)) * 0.55, cy + (p.z - (heroPos ? heroPos.z : 0)) * 0.55, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    // Rim + north indicator.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(cx, cy, 72, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, 14);
  }

  let tick = 0;
  function update(time = 0) {
    tick++;
    const onFoot = st.tableau === 'market';
    drive.style.display = onFoot ? 'none' : '';
    foot.style.display = onFoot ? '' : 'none';

    const mission = MISSIONS[st.mission] || MISSIONS[3];
    const [level, title] = rank(st.rp || 0);
    void level; void title;

    // Driving layout.
    cashEl.textContent = '$' + (st.cash || 0).toLocaleString('en-US');
    const mins = 17 * 60 + 42 + Math.floor((time || 0) / 60);
    timeEl.textContent = String(Math.floor(mins / 60) % 24).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    const dKey = city && city.districtAt
      ? city.districtAt(sim.hero.group.position.x, sim.hero.group.position.z)
      : 'pasaru';
    const dNames = { kumala: 'Kumala Strand', pasaru: 'Pasaru', lomboro: 'Lomboro Wharf', banyan: 'Banyan Green', lantawa: 'Lantawa Centre' };
    district.textContent = dNames[dKey] || 'Pasaru';
    const wIdx = WEAPONS.indexOf(st.weapon);
    for (const wr of weaponRows) {
      const idx = WEAPONS.indexOf(wr.name);
      const active = idx === wIdx;
      wr.row.classList.toggle('active', active);
      const a = st.ammo ? st.ammo[idx] : 0;
      const r = st.reserves ? st.reserves[idx] : 0;
      wr.ammoEl.textContent = wr.name === 'Unarmed' ? '—' : (a + ' / ' + r);
    }
    hp.fill.style.width = Math.max(0, Math.min(100, st.health)) + '%';
    hpVal.textContent = String(Math.round(st.health));
    ar.fill.style.width = Math.max(0, Math.min(100, st.armour)) + '%';
    arVal.textContent = String(Math.round(st.armour));
    stars.forEach((s, i) => s.classList.toggle('lit', i < st.wanted));
    pill.style.display = st.wanted >= 4 ? '' : 'none';
    trMission.textContent = mission.name;
    trStage.textContent = 'STAGE ' + (st.stage || 1) + '/3';
    trObjective.textContent = mission.objective;
    trNext.textContent = 'Next: ' + (mission.stages[Math.min(st.stage || 1, 2)] || mission.stages[mission.stages.length - 1]);
    trProg.fill.style.width = completion(st) + '%';
    responseRows.forEach((row, i) => {
      const r = st.response[i];
      const cs = row.querySelector('.resp-callsign');
      const role = row.querySelector('.resp-role');
      const dist = row.querySelector('.resp-dist');
      if (r) {
        cs.textContent = r.callsign;
        role.textContent = r.role;
        dist.textContent = r.distance + 'm';
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
    const radio = RADIO[st.radio || 0] || RADIO[0];
    radioEl.textContent = radio[0] + ' · ' + radio[1];
    speedNum.textContent = String(Math.round(st.speed || 0));
    carLine.textContent = 'Sable GT · ' + Math.round(st.condition ?? 100) + '%';
    cond.fill.style.width = Math.max(0, Math.min(100, st.condition ?? 100)) + '%';

    // Dialogue (both layouts share the same state).
    const dlg = st.dialogue;
    const showDlg = !!dlg;
    dialogueCard.style.display = showDlg ? '' : 'none';
    footDlg.style.display = showDlg ? '' : 'none';
    if (dlg) {
      dlgSpeaker.textContent = dlg.speaker || '';
      dlgText.textContent = dlg.text || '';
      const body = footDlg.querySelector('.dlg-text');
      if (body) body.textContent = dlg.text || '';
      const spk = footDlg.querySelector('.dlg-speaker');
      if (spk) spk.textContent = (dlg.speaker || '').toUpperCase();
      const imgEl = dialogueCard.querySelector('img');
      if (imgEl) {
        const key = (dlg.speaker || '').split(' ')[0];
        if (portrait[key]) imgEl.src = portrait[key];
      }
    }
    commsLine.textContent = st.comms || '';
    footComms.textContent = st.comms || '';

    // On-foot layout.
    footProgVal.textContent = completion(st) + '%';
    footProg.fill.style.width = completion(st) + '%';
    taskRows.forEach((row, i) => {
      const stageIdx = st.stage || 1;
      row.classList.toggle('done', i < stageIdx - 0 && i < stageIdx);
      row.classList.toggle('current', i === stageIdx - 1 || (stageIdx === 2 && i === 1));
      row.classList.toggle('open', i > stageIdx - 1 && !(stageIdx === 2 && i === 1));
    });
    fundsCard.querySelector('.f-money').textContent = (st.cash || 0).toLocaleString('en-US');
    const fStars = fundsCard.querySelectorAll('.f-stars .star');
    fStars.forEach((s, i) => s.classList.toggle('lit', i < st.wanted));
    fundsUnits.textContent = String(st.response ? st.response.length : 0);
    fundsMeter.fill.style.width = Math.min(100, (st.response ? st.response.length : 0) * 33) + '%';
    const top = st.response && st.response[0];
    fundsTop.textContent = top ? top.callsign + ' · ' + top.role + ' · ' + top.distance + 'm' : 'No units responding';
    actionHeader.textContent = 'CLEAR THE AISLES · ' + (st.weapon || 'Compact');
    fHp.fill.style.width = Math.max(0, Math.min(100, st.health)) + '%';
    fAr.fill.style.width = Math.max(0, Math.min(100, st.armour)) + '%';

    // Radar (throttled: every 3rd update).
    if (tick % 3 === 1) {
      drawRadar(radarCanvas);
      drawRadar(footRadar);
    }
  }

  return { update, drive, foot, root };
}
