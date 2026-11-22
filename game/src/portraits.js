// game/src/portraits.js
// Painted canvas portraits for "KIBERA RISING" — make.fun gta6-01, round 8.
// Original code written for this entry. Small head-and-shoulders portraits
// (120x150) in a simple shaded style, one per crew member plus a dispatch
// officer, returned as dataURL strings usable as <img> src.

export function makePortraits() {
  function paint({ skin, hair, shirt, hairStyle, cap = false, badge = false }) {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');

    // Dark golden-hour backdrop.
    const bg = ctx.createLinearGradient(0, 0, 0, 150);
    bg.addColorStop(0, '#2b2118');
    bg.addColorStop(1, '#171310');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 120, 150);
    // Warm rim light on one side.
    const rim = ctx.createLinearGradient(0, 0, 120, 0);
    rim.addColorStop(0, 'rgba(255,180,90,0)');
    rim.addColorStop(1, 'rgba(255,180,90,0.28)');
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, 120, 150);

    // Shoulders / shirt block.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(8, 150);
    ctx.quadraticCurveTo(18, 108, 60, 104);
    ctx.quadraticCurveTo(102, 108, 112, 150);
    ctx.closePath();
    ctx.fill();
    // Shirt shading + collar.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.moveTo(60, 104);
    ctx.lineTo(78, 150);
    ctx.lineTo(112, 150);
    ctx.quadraticCurveTo(102, 108, 60, 104);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(48, 106);
    ctx.lineTo(60, 122);
    ctx.lineTo(72, 106);
    ctx.closePath();
    ctx.fill();

    // Neck.
    ctx.fillStyle = skin;
    ctx.fillRect(51, 84, 18, 24);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(51, 84, 18, 6);

    // Face: oval with a soft cheek shade.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(60, 58, 27, 33, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(74, 62, 12, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.ellipse(50, 48, 9, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears.
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(33, 60, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(87, 60, 5, 8, 0, 0, Math.PI * 2); ctx.fill();

    // Hair per style.
    ctx.fillStyle = hair;
    if (hairStyle === 'bun') {
      // Long hair framing the face + a bun on top.
      ctx.beginPath();
      ctx.ellipse(60, 34, 29, 20, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(31, 34, 7, 52);
      ctx.fillRect(82, 34, 7, 52);
      ctx.beginPath();
      ctx.arc(60, 18, 11, 0, Math.PI * 2);
      ctx.fill();
    } else if (hairStyle === 'long') {
      ctx.beginPath();
      ctx.ellipse(60, 36, 29, 22, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(30, 36, 9, 62);
      ctx.fillRect(81, 36, 9, 62);
    } else if (hairStyle === 'messy') {
      ctx.beginPath();
      ctx.ellipse(60, 32, 28, 18, 0, Math.PI, 0);
      ctx.fill();
      for (const [x, y, r] of [[38, 30, 7], [48, 22, 8], [62, 20, 8], [76, 24, 7], [84, 32, 6]]) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // Short cap-swept hair.
      ctx.beginPath();
      ctx.ellipse(60, 32, 28, 17, 0, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(60, 30, 24, 10, 0, Math.PI, 0);
      ctx.fill();
    }

    // Brows, eyes, nose, mouth.
    ctx.strokeStyle = hair;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(44, 52); ctx.lineTo(55, 50); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(65, 50); ctx.lineTo(76, 52); ctx.stroke();
    ctx.fillStyle = '#1c1410';
    ctx.beginPath(); ctx.ellipse(49, 58, 3.4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(71, 58, 3.4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(50, 57, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(72, 57, 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(60, 60); ctx.lineTo(58, 70); ctx.lineTo(61, 71); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,20,10,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(52, 79); ctx.quadraticCurveTo(60, 83, 68, 79); ctx.stroke();

    if (cap) {
      // Navy officer cap with gold band.
      ctx.fillStyle = '#0d1b3e';
      ctx.beginPath();
      ctx.ellipse(60, 30, 30, 12, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(30, 28, 60, 6);
      ctx.fillStyle = '#ffd97a';
      ctx.fillRect(30, 32, 60, 3);
      ctx.fillStyle = '#0d1b3e';
      ctx.beginPath();
      ctx.ellipse(60, 34, 22, 5, 0, 0, Math.PI);
      ctx.fill();
    }
    if (badge) {
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath();
      ctx.moveTo(92, 122); ctx.lineTo(97, 128); ctx.lineTo(92, 136); ctx.lineTo(87, 128);
      ctx.closePath();
      ctx.fill();
    }
    return canvas.toDataURL('image/png');
  }

  return {
    Mika: paint({ skin: '#a96e50', hair: '#14100c', shirt: '#24416d', hairStyle: 'cap' }),
    Tomo: paint({ skin: '#b98063', hair: '#241a12', shirt: '#ab2628', hairStyle: 'messy' }),
    Inez: paint({ skin: '#c98f6b', hair: '#2a1d16', shirt: '#8a9a7b', hairStyle: 'bun' }),
    Rafi: paint({ skin: '#8a5a3b', hair: '#1a1210', shirt: '#c98a2e', hairStyle: 'cap' }),
    Suri: paint({ skin: '#d9a986', hair: '#3a2a1e', shirt: '#6b4fa0', hairStyle: 'long' }),
    dispatch: paint({ skin: '#b98063', hair: '#14100c', shirt: '#16264f', hairStyle: 'cap', cap: true, badge: true }),
  };
}
