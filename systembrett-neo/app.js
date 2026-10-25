/**
 * VIRTUELLES SYSTEMBRETT
 * Systemische Aufstellungen & Coaching
 * 
 * Klassisches Holz-Systembrett mit gewellter Trennlinie, gelaserter Randlinie
 * und Figuren mit aufgemalten Augen.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. STATE & KONFIGURATION
  // ==========================================================================

  const STATE = {
    sessionTitle: 'Neue Aufstellung',
    boardType: 'classic',           // 'classic' | 'single' | 'round' | 'split'
    splitDistance: 0,               // DEFAULT: 0 mm = EIN GANZES ZUSAMMENHÄNGENDES BRETT!
    showLaserBorder: true,          // DEFAULT: true (gelaserte Randlinie)
    woodType: 'buche-hell',         // DEFAULT: Helle Buche / Birke
    viewMode: '2d',                 // '2d' | '25d'
    showCones: true,
    showSightLines: false,
    showGrid: false,
    soundEnabled: true,
    
    // Zoom & Pan
    autoFit: true,                  // true = Brett wird automatisch bildschirmfüllend eingepasst
    viewYaw: -16,                   // 3D: Drehung des Bretts (Grad)
    viewTilt: 46,                   // 3D: Neigung des Bretts (Grad)
    isRotatingView: false,
    fastRender: false,              // Touch-Bedienung: Figuren vereinfacht zeichnen, solange der Finger aufliegt
    rotStart: null,
    forceFlat: false,               // true = Figuren flach zeichnen (z. B. für den PNG-Export)
    solidKey: null,
    viewRotation: 0,                // Drehung der Ansicht (Perspektivenwechsel: Blickrichtung zeigt nach oben)
    povPrevView: null,
    povCamRot: null,
    relationHoverId: null,
    pointerClient: null,
    focusMode: false,
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isPanning: false,
    startPanX: 0,
    startPanY: 0,

    // Interaktionszustand
    selectedFigureId: null,
    povFigureId: null,
    draggingFigureId: null,
    dragOffset: { x: 0, y: 0 },
    rotatingFigureId: null,
    activeRelationMode: null,
    relationFirstFigureId: null,

    // Phasen
    currentPhaseIndex: 0,
    phases: [
      {
        id: 'phase_1',
        name: '1. Ausgangsbild (Setting)',
        figures: [],
        relations: []
      }
    ],

    // Protokoll & Notizen
    notes: {
      client: '',
      problem: '',
      hypothesis: '',
      solution: ''
    }
  };

  // Brett-Abmessungen im SVG-Koordinatensystem (quadratisch)
  const BOARD_GEO = {
    cx: 800,
    cy: 600,
    width: 820,
    height: 820,
    radius: 390,
    halfWidth: 410,
    waveA: 55,         // Amplitude der geschwungenen Trennlinie
    laserInset: 20,    // Abstand der gelaserten Randlinie vom Rand
    cornerR: 18        // Eckenabrundung
  };

  const SIZE_MAP = {
    gross: 36,
    mittel: 27,
    klein: 19
  };

  // Systemische Fragen
  const SYSTEMIC_QUESTIONS = [
    { cat: 'zirkulaer', q: 'Wenn diese Figur sprechen könnte: Was würde sie über den Abstand zu den anderen sagen?' },
    { cat: 'zirkulaer', q: 'Was vermutet Figur A, wie Figur B ihren Blickkontakt deutet?' },
    { cat: 'zirkulaer', q: 'Wer im System würde sich am meisten wundern, wenn sich diese Figur um 180° umdreht?' },
    { cat: 'zirkulaer', q: 'Wer leidet am meisten unter der aktuellen Positionierung auf dem Brett?' },
    { cat: 'zirkulaer', q: 'Wenn die Person ganz links eine Botschaft an die Person ganz rechts hätte: Wie würde sie lauten?' },
    { cat: 'skalierung', q: 'Auf einer Skala von 1 bis 10: Wie viel Kraft hat diese Figur an ihrem aktuellen Platz?' },
    { cat: 'skalierung', q: 'Was müsste geschehen, damit sich das Befinden dieser Figur von 4 auf 6 verbessert?' },
    { cat: 'skalierung', q: 'Wie sicher fühlt sich diese Figur an ihrem Platz (1 = schutzlos, 10 = vollkommen geborgen)?' },
    { cat: 'ressource', q: 'Welche Kraft oder Ressource fehlt noch im Rücken dieser Figur?' },
    { cat: 'ressource', q: 'Wer in diesem System könnte der Figur als Kraftquelle oder Verbündeter dienen?' },
    { cat: 'ressource', q: 'Was bräuchte es auf dem Brett, damit der Blick nach vorne frei wird?' },
    { cat: 'wunder', q: 'Angenommen, über Nacht geschieht ein Wunder und das Problem löst sich: Wo stünde diese Figur am nächsten Morgen?' },
    { cat: 'wunder', q: 'Woran würde die am weitesten entfernte Figur als Erstes merken, dass das Wunder geschehen ist?' },
    { cat: 'loesung', q: 'Welche minimale Verschiebung um nur wenige Zentimeter würde bereits spürbare Erleichterung bringen?' },
    { cat: 'loesung', q: 'Was passiert mit dem Gesamtsystem, wenn die beiden Bretthälften vorsichtig getrennt werden?' },
    { cat: 'loesung', q: 'Wer darf sich entspannen, wenn das Lösungsbild eingenommen wird?' }
  ];

  // ==========================================================================
  // 2. AUDIO SYNTHESIZER
  // ==========================================================================

  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playWoodClick(pitchMod = 1.0) {
    if (!STATE.soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      osc.type = 'triangle';
      const baseFreq = 420 * pitchMod;
      osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.04);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800 * pitchMod, audioCtx.currentTime);
      filter.Q.setValueAtTime(3.5, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.06);
    } catch (e) {
      console.warn('Audio click error:', e);
    }
  }

  // ==========================================================================
  // 3. MATHEMATIK & GEOMETRIE
  // ==========================================================================

  function normalizeAngle(angle) {
    let a = angle % 360;
    if (a < 0) a += 360;
    return a;
  }

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function radToDeg(rad) {
    return (rad * 180) / Math.PI;
  }

  function getAngleToTarget(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    let deg = radToDeg(Math.atan2(dy, dx)) + 90;
    return normalizeAngle(deg);
  }

  function getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function isTargetInView(observer, target, coneAngle = 70) {
    if (observer.id === target.id) return false;
    const angleToTarget = getAngleToTarget(observer.x, observer.y, target.x, target.y);
    const diff = Math.abs(normalizeAngle(angleToTarget - observer.rotation));
    const normalizedDiff = diff > 180 ? 360 - diff : diff;
    return normalizedDiff <= (coneAngle / 2);
  }

  function isTargetBehind(observer, target) {
    if (observer.id === target.id) return false;
    const angleToTarget = getAngleToTarget(observer.x, observer.y, target.x, target.y);
    const diff = Math.abs(normalizeAngle(angleToTarget - observer.rotation));
    const normalizedDiff = diff > 180 ? 360 - diff : diff;
    return normalizedDiff >= 135;
  }

  function isPointOnBoard(x, y) {
    const { cx, cy, width, height, radius, halfWidth, waveA } = BOARD_GEO;
    const y_top = cy - height / 2;
    const y_bottom = cy + height / 2;

    if (STATE.boardType === 'round') {
      return getDistance(x, y, cx, cy) <= radius;
    } else if (STATE.boardType === 'single') {
      return (
        x >= cx - width / 2 &&
        x <= cx + width / 2 &&
        y >= y_top &&
        y <= y_bottom
      );
    } else if (STATE.boardType === 'classic') {
      if (y < y_top || y > y_bottom) return false;
      const x_left = cx - width / 2;
      const x_right = cx + width / 2;
      const gap = STATE.splitDistance;

      // Wellenkontur am Punkt y
      const t = (y - y_top) / height;
      const waveX = cx - waveA * Math.sin(2 * Math.PI * t);

      const inLeft = (x >= x_left - gap / 2) && (x <= waveX - gap / 2);
      const inRight = (x >= waveX + gap / 2) && (x <= x_right + gap / 2);
      return inLeft || inRight;
    } else {
      // Split Board (gerade geteilt)
      const gap = STATE.splitDistance;
      const inLeft = x >= (cx - gap / 2 - halfWidth) && x <= (cx - gap / 2) && y >= y_top && y <= y_bottom;
      const inRight = x >= (cx + gap / 2) && x <= (cx + gap / 2 + halfWidth) && y >= y_top && y <= y_bottom;
      return inLeft || inRight;
    }
  }

  function getWoodColors(woodType) {
    switch (woodType) {
      case 'buche-hell':
      default:
        return {
          base: '#f6ebd9',
          gradLeft: 'url(#birchGradLeft)',
          gradRight: 'url(#birchGradRight)',
          gradFull: 'url(#birchGradFull)',
          grainOpacity: 0.05,
          border: '#bfa17c',
          laser: '#6d4826',
          seam: '#7a542b'
        };
      case 'eiche':
        return {
          base: '#b48a56',
          gradLeft: '#c49a65',
          gradRight: '#b48a56',
          gradFull: '#bc9160',
          grainOpacity: 0.05,
          border: '#6c4b24',
          laser: '#4a2f13',
          seam: '#5c3a19'
        };
      case 'walnuss':
        return {
          base: '#5c3a21',
          gradLeft: '#6e4729',
          gradRight: '#5c3a21',
          gradFull: '#653f25',
          grainOpacity: 0.04,
          border: '#2d1a0c',
          laser: '#1e1006',
          seam: '#2d1a0c'
        };
      case 'slate':
        return {
          base: '#334155',
          gradLeft: '#475569',
          gradRight: '#334155',
          gradFull: '#3b4a5f',
          grainOpacity: 0.12,
          border: '#0f172a',
          laser: '#090d16',
          seam: '#0f172a'
        };
    }
  }

  function getCurrentPhase() {
    return STATE.phases[STATE.currentPhaseIndex];
  }

  function getFigureById(id) {
    const phase = getCurrentPhase();
    return phase ? phase.figures.find(f => f.id === id) : null;
  }

  // ==========================================================================
  // 4. SVG ZEICHENLOGIK (BRETT, GITTER, FIGUREN, SICHTKEGEL)
  // ==========================================================================

  const svgElem = document.getElementById('boardSvg');
  const boardGraphicsGroup = document.getElementById('boardGraphicsGroup');
  const boardGridGroup = document.getElementById('boardGridGroup');
  const sightConesGroup = document.getElementById('sightConesGroup');
  const relationshipLinesGroup = document.getElementById('relationshipLinesGroup');
  const sightLinesGroup = document.getElementById('sightLinesGroup');
  const figuresGroup = document.getElementById('figuresGroup');
  const controlsOverlayGroup = document.getElementById('controlsOverlayGroup');

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(k => el.setAttribute(k, attrs[k]));
    return el;
  }

  // Holzmaserung als Overlay: Kopie der Brettform, gefüllt durch den Faser-Filter
  function makeGrain(el, colors) {
    const g = el.cloneNode(false);
    ['class', 'stroke', 'stroke-width', 'fill'].forEach(a => g.removeAttribute(a));
    if (STATE.grainImageReady) {
      // vorberechnete Maserung (Touchgeräte): kein Rauschfilter bei jeder Neuzeichnung
      g.setAttribute('fill', 'url(#boardGrainImg)');
    } else {
      g.setAttribute('fill', '#000');
      g.setAttribute('filter', 'url(#woodGrainTex)');
    }
    g.setAttribute('opacity', colors.grainOpacity !== undefined ? colors.grainOpacity : 0.5);
    g.setAttribute('pointer-events', 'none');
    g.setAttribute('class', 'board-grain');
    return g;
  }

  // Brett-Einstellungen im Menü immer passend zum aktuellen Zustand anzeigen
  function syncBoardSettingsUI() {
    document.querySelectorAll('.board-shape-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-shape') === STATE.boardType);
    });
    document.querySelectorAll('.wood-choice').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-wood') === STATE.woodType);
    });
    const laser = document.getElementById('checkLaserBorder');
    if (laser) laser.checked = !!STATE.showLaserBorder;
    const canSplit = STATE.boardType === 'classic' || STATE.boardType === 'split';
    ['splitDistanceGroup', 'boardStateGroup'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = canSplit ? '' : 'none';
    });
  }

  // Maserung einmal in ein Bild rechnen (gleiche Koordinaten wie der Live-Filter, also identische Optik).
  // Auf Mobilgeräten spart das bei jeder Neuzeichnung den teuren Rauschfilter.
  function prepareBoardGrainImage() {
    if (STATE.grainImageReady || !window.matchMedia('(pointer: coarse)').matches) return;
    const X0 = 250, Y0 = 50, SZ = 1100, SC = 1.25;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SZ * SC}" height="${SZ * SC}" viewBox="${X0} ${Y0} ${SZ} ${SZ}">
      <defs><filter id="g" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.0016 0.075" numOctaves="3" seed="11" result="fine"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.006" numOctaves="2" seed="4" result="warp"/>
        <feDisplacementMap in="fine" in2="warp" scale="22" xChannelSelector="R" yChannelSelector="G" result="wavy"/>
        <feColorMatrix in="wavy" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.5 0 0 0 -0.62" result="mask"/>
        <feFlood flood-color="#6b4220" result="col"/>
        <feComposite in="col" in2="mask" operator="in" result="streaks"/>
        <feComposite in="streaks" in2="SourceAlpha" operator="in"/>
      </filter></defs>
      <rect x="${X0}" y="${Y0}" width="${SZ}" height="${SZ}" fill="#000" filter="url(#g)"/></svg>`;
    const urlApi = window.URL || window.webkitURL;
    const blobURL = urlApi.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SZ * SC;
        canvas.height = SZ * SC;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        const pat = svgEl('pattern', { id: 'boardGrainImg', patternUnits: 'userSpaceOnUse', x: X0, y: Y0, width: SZ, height: SZ });
        const image = svgEl('image', { x: 0, y: 0, width: SZ, height: SZ, preserveAspectRatio: 'none' });
        image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
        image.setAttribute('href', dataUrl);
        pat.appendChild(image);
        svgElem.querySelector('defs').appendChild(pat);
        STATE.grainImageReady = true;
        renderBoard();
      } catch (err) { /* Filter-Variante bleibt aktiv */ }
      urlApi.revokeObjectURL(blobURL);
    };
    img.onerror = () => urlApi.revokeObjectURL(blobURL);
    img.src = blobURL;
  }

  function renderBoard() {
    syncBoardSettingsUI();
    const { cx, cy, width, height, radius, halfWidth, waveA, laserInset, cornerR } = BOARD_GEO;
    const colors = getWoodColors(STATE.woodType);
    boardGraphicsGroup.innerHTML = '';

    if (STATE.boardType === 'classic') {
      // KLASSISCHES BRETT MIT GEWELLTER TRENNLINIE
      const x_left = cx - width / 2;
      const x_right = cx + width / 2;
      const y_top = cy - height / 2;
      const y_bottom = cy + height / 2;
      const gap = STATE.splitDistance;     // 0 = vereint, >0 = getrennt

      const c1y = y_top + height * 0.22;
      const c2y = y_top + height * 0.38;
      const c3y = cy + height * 0.12;
      const c4y = cy + height * 0.28;

      const waveForward = `C ${cx - waveA},${c1y} ${cx - waveA},${c2y} ${cx},${cy} C ${cx + waveA},${c3y} ${cx + waveA},${c4y} ${cx},${y_bottom}`;
      const waveReverse = `C ${cx + waveA},${c4y} ${cx + waveA},${c3y} ${cx},${cy} C ${cx - waveA},${c2y} ${cx - waveA},${c1y} ${cx},${y_top}`;
      const lr = cornerR * 0.7;

      if (gap === 0) {
        // ---- EIN GANZES BRETT: nur Außenkante + eine schmale Naht ----
        const full = svgEl('rect', {
          x: x_left, y: y_top, width: width, height: height, rx: cornerR,
          fill: colors.gradFull || colors.base,
          stroke: colors.border, 'stroke-width': 4, class: 'board-half'
        });
        boardGraphicsGroup.appendChild(full);
        boardGraphicsGroup.appendChild(makeGrain(full, colors));

        if (STATE.showLaserBorder) {
          boardGraphicsGroup.appendChild(svgEl('rect', {
            x: x_left + laserInset, y: y_top + laserInset,
            width: width - 2 * laserInset, height: height - 2 * laserInset, rx: lr,
            class: 'laser-border-line', stroke: colors.laser
          }));
        }

        // Die einzige sichtbare Trennlinie: schmale, feine Naht
        boardGraphicsGroup.appendChild(svgEl('path', {
          d: `M ${cx},${y_top} ${waveForward}`,
          fill: 'none', stroke: colors.seam || '#704928',
          'stroke-width': 1.1, 'stroke-linecap': 'round',
          opacity: 0.55, 'pointer-events': 'none', class: 'board-seam'
        }));

      } else {
        // ---- GETRENNT: zwei einzelne Bretthälften ----
        const leftPath = `M ${cx},${y_top} ${waveForward} L ${x_left + cornerR},${y_bottom} A ${cornerR},${cornerR} 0 0,1 ${x_left},${y_bottom - cornerR} L ${x_left},${y_top + cornerR} A ${cornerR},${cornerR} 0 0,1 ${x_left + cornerR},${y_top} Z`;
        const rightPath = `M ${cx},${y_top} L ${x_right - cornerR},${y_top} A ${cornerR},${cornerR} 0 0,1 ${x_right},${y_top + cornerR} L ${x_right},${y_bottom - cornerR} A ${cornerR},${cornerR} 0 0,1 ${x_right - cornerR},${y_bottom} L ${cx},${y_bottom} ${waveReverse} Z`;

        const lx_left = x_left + laserInset;
        const lx_right = x_right - laserInset;
        const ly_top = y_top + laserInset;
        const ly_bottom = y_bottom - laserInset;

        const leftLaserWave = `C ${cx - waveA - laserInset},${c1y} ${cx - waveA - laserInset},${c2y} ${cx - laserInset},${cy} C ${cx + waveA - laserInset},${c3y} ${cx + waveA - laserInset},${c4y} ${cx - laserInset},${ly_bottom}`;
        const leftLaserPath = `M ${cx - laserInset},${ly_top} ${leftLaserWave} L ${lx_left + lr},${ly_bottom} A ${lr},${lr} 0 0,1 ${lx_left},${ly_bottom - lr} L ${lx_left},${ly_top + lr} A ${lr},${lr} 0 0,1 ${lx_left + lr},${ly_top} Z`;

        const rightLaserWave = `C ${cx + waveA + laserInset},${c4y} ${cx + waveA + laserInset},${c3y} ${cx + laserInset},${cy} C ${cx - waveA + laserInset},${c2y} ${cx - waveA + laserInset},${c1y} ${cx + laserInset},${ly_top}`;
        const rightLaserPath = `M ${cx + laserInset},${ly_top} L ${lx_right - lr},${ly_top} A ${lr},${lr} 0 0,1 ${lx_right},${ly_top + lr} L ${lx_right},${ly_bottom - lr} A ${lr},${lr} 0 0,1 ${lx_right - lr},${ly_bottom} L ${cx + laserInset},${ly_bottom} ${rightLaserWave} Z`;

        [
          { path: leftPath, laser: leftLaserPath, fill: colors.gradLeft || colors.base, dx: -gap / 2 },
          { path: rightPath, laser: rightLaserPath, fill: colors.gradRight || colors.base, dx: gap / 2 }
        ].forEach(half => {
          const grp = svgEl('g', { transform: `translate(${half.dx}, 0)`, class: 'board-half-group' });
          const shape = svgEl('path', {
            d: half.path, fill: half.fill, stroke: colors.border,
            'stroke-width': 4, class: 'board-half'
          });
          grp.appendChild(shape);
          grp.appendChild(makeGrain(shape, colors));
          if (STATE.showLaserBorder) {
            grp.appendChild(svgEl('path', { d: half.laser, class: 'laser-border-line', stroke: colors.laser }));
          }
          boardGraphicsGroup.appendChild(grp);
        });
      }

    } else if (STATE.boardType === 'round') {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', colors.base);
      circle.setAttribute('stroke', colors.border);
      circle.setAttribute('stroke-width', '8');
      circle.setAttribute('class', 'board-half');
      boardGraphicsGroup.appendChild(circle);
      boardGraphicsGroup.appendChild(makeGrain(circle, colors));

      if (STATE.showLaserBorder) {
        const innerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerRing.setAttribute('cx', cx);
        innerRing.setAttribute('cy', cy);
        innerRing.setAttribute('r', radius - 28);
        innerRing.setAttribute('class', 'laser-border-line');
        innerRing.setAttribute('stroke', colors.laser);
        boardGraphicsGroup.appendChild(innerRing);
      }

    } else if (STATE.boardType === 'single') {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', cx - width / 2);
      rect.setAttribute('y', cy - height / 2);
      rect.setAttribute('width', width);
      rect.setAttribute('height', height);
      rect.setAttribute('rx', 24);
      rect.setAttribute('fill', colors.base);
      rect.setAttribute('stroke', colors.border);
      rect.setAttribute('stroke-width', '8');
      rect.setAttribute('class', 'board-half');
      boardGraphicsGroup.appendChild(rect);
      boardGraphicsGroup.appendChild(makeGrain(rect, colors));

      if (STATE.showLaserBorder) {
        const innerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        innerRect.setAttribute('x', cx - width / 2 + 28);
        innerRect.setAttribute('y', cy - height / 2 + 28);
        innerRect.setAttribute('width', width - 56);
        innerRect.setAttribute('height', height - 56);
        innerRect.setAttribute('rx', 14);
        innerRect.setAttribute('class', 'laser-border-line');
        innerRect.setAttribute('stroke', colors.laser);
        boardGraphicsGroup.appendChild(innerRect);
      }

    } else {
      // Klassisch gerade geteilt
      const gap = STATE.splitDistance;
      const leftX = cx - gap / 2 - halfWidth;
      const rightX = cx + gap / 2;
      const boardY = cy - height / 2;

      const leftHalf = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      leftHalf.setAttribute('x', leftX);
      leftHalf.setAttribute('y', boardY);
      leftHalf.setAttribute('width', halfWidth);
      leftHalf.setAttribute('height', height);
      leftHalf.setAttribute('rx', 18);
      leftHalf.setAttribute('fill', colors.base);
      leftHalf.setAttribute('stroke', colors.border);
      leftHalf.setAttribute('stroke-width', '6');
      leftHalf.setAttribute('class', 'board-half');
      boardGraphicsGroup.appendChild(leftHalf);
      boardGraphicsGroup.appendChild(makeGrain(leftHalf, colors));

      const rightHalf = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rightHalf.setAttribute('x', rightX);
      rightHalf.setAttribute('y', boardY);
      rightHalf.setAttribute('width', halfWidth);
      rightHalf.setAttribute('height', height);
      rightHalf.setAttribute('rx', 18);
      rightHalf.setAttribute('fill', colors.base);
      rightHalf.setAttribute('stroke', colors.border);
      rightHalf.setAttribute('stroke-width', '6');
      rightHalf.setAttribute('class', 'board-half');
      boardGraphicsGroup.appendChild(rightHalf);
      boardGraphicsGroup.appendChild(makeGrain(rightHalf, colors));
    }

    renderGrid();
  }

  function renderGrid() {
    boardGridGroup.innerHTML = '';
    if (!STATE.showGrid) {
      boardGridGroup.style.display = 'none';
      return;
    }
    boardGridGroup.style.display = 'block';

    const { cx, cy } = BOARD_GEO;
    const step = 50;

    for (let x = 200; x <= 1400; x += step) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', 100);
      line.setAttribute('x2', x);
      line.setAttribute('y2', 1100);
      line.setAttribute('stroke', 'rgba(255,255,255,0.08)');
      line.setAttribute('stroke-width', x === cx ? '1.5' : '1');
      if (x === cx) line.setAttribute('stroke', 'rgba(194, 149, 93, 0.3)');
      boardGridGroup.appendChild(line);
    }

    for (let y = 100; y <= 1100; y += step) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 200);
      line.setAttribute('y1', y);
      line.setAttribute('x2', 1400);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(255,255,255,0.08)');
      line.setAttribute('stroke-width', y === cy ? '1.5' : '1');
      if (y === cy) line.setAttribute('stroke', 'rgba(194, 149, 93, 0.3)');
      boardGridGroup.appendChild(line);
    }
  }

  // ==========================================================================
  // 5. FIGUREN RENDERN & DESIGN (PEG DOLLS MIT AUFGEMALTEN AUGEN)
  // ==========================================================================

  function renderFigures() {
    figuresGroup.innerHTML = '';
    controlsOverlayGroup.innerHTML = '';
    sightConesGroup.innerHTML = '';
    sightLinesGroup.innerHTML = '';

    const phase = getCurrentPhase();
    if (!phase) return;

    // Perspektivenwechsel: Beobachter bestimmen
    let observer = null;
    if (STATE.povFigureId) {
      observer = getFigureById(STATE.povFigureId);
      if (!observer) setTimeout(() => exitPovMode(), 0);
    }

    if (observer && STATE.povCamRot !== observer.rotation && !STATE.rotatingFigureId) {
      applyPovCamera(false);
    }

    if (observer) {
      renderPovZones(observer, phase.figures);
    } else {
      if (STATE.showCones) {
        phase.figures.forEach(fig => renderVisionCone(fig));
      }
      if (STATE.showSightLines) {
        renderSightLines(phase.figures);
      }
    }

    STATE.solidKey = currentSolidKey();
    if (useSolids()) STATE.solidProj = getTargetProjection();
    let drawOrder = phase.figures;
    if (useSolids()) {
      // Hintere Figuren zuerst, damit vordere sie korrekt verdecken
      const yw = (STATE.viewYaw * Math.PI) / 180;
      const depth = f => f.x * Math.sin(yw) + f.y * Math.cos(yw);
      drawOrder = phase.figures.slice().sort((p, q) => depth(p) - depth(q));
    }

    drawOrder.forEach(fig => {
      const g = createFigureSvgElement(fig);
      if (observer) {
        if (fig.id === observer.id) g.classList.add('figure-in-pov');
        else if (isTargetInView(observer, fig)) g.classList.add('figure-in-sight');
        else if (isTargetBehind(observer, fig)) g.classList.add('figure-in-blindspot');
        else g.classList.add('figure-in-periphery');
      }
      figuresGroup.appendChild(g);

      if (fig.id === STATE.selectedFigureId) {
        renderFigureControls(fig);
      }
    });

    renderRelationships();
    updateSessionMeta();
    updateRubberband();
    syncInspectorOverlay();

    if (observer) renderEgoView();
  }

  // ==========================================================================
  // 3D-KÖRPER: Figuren und Symbole als Objekte aus Holz (nur in der 3D-Ansicht)
  //
  // Die Figuren stehen aufrecht auf dem Brett. Gezeichnet wird im bildschirm-
  // parallelen Koordinatensystem des Bretts: Höhen werden um tan(Neigung)
  // verlängert, damit sie nach der Kippung des Bretts richtig erscheinen.
  // Kugeln sind Ellipsen (1/cos), waagerechte Scheiben bleiben Kreise.
  // ==========================================================================

  let solidUid = 0;

  function isFastRender() {
    return STATE.isRotatingView || STATE.fastRender;
  }

  function useSolids() {
    return STATE.viewMode === '25d' && !STATE.povFigureId && !STATE.forceFlat && STATE.viewTilt >= 8;
  }

  function currentSolidKey() {
    return useSolids()
      ? `${isFastRender() ? 'f' : 'q'}|${Math.round(STATE.viewYaw * 2)}|${Math.round(STATE.viewTilt * 2)}|${Math.round(STATE.panX / 20)}|${Math.round(STATE.panY / 20)}|${Math.round(STATE.zoom * 50)}`
      : 'flat';
  }

  // Figuren neu zeichnen, wenn sich Drehung/Neigung der 3D-Ansicht geändert hat
  let solidRefreshRaf = null;
  function refreshSolidsIfNeeded() {
    if (currentSolidKey() === STATE.solidKey || solidRefreshRaf) return;
    // höchstens einmal pro Bildschirm-Frame neu zeichnen
    solidRefreshRaf = requestAnimationFrame(() => {
      solidRefreshRaf = null;
      if (currentSolidKey() !== STATE.solidKey) renderFigures();
    });
  }

  function parseHexColor(c) {
    let h = /^#[0-9a-f]{3,6}$/i.test(c || '') ? c.slice(1) : 'c2955d';
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // amt > 0: aufhellen, amt < 0: abdunkeln
  function shade(c, amt) {
    const [r, g, b] = parseHexColor(c);
    const t = amt > 0 ? 255 : 0;
    const k = Math.abs(amt);
    const f = v => Math.round(v + (t - v) * k).toString(16).padStart(2, '0');
    return '#' + f(r) + f(g) + f(b);
  }

  function materialFor(fig) {
    let base, grain, gloss, eye = '#1a1006';
    if (fig.color === 'wood-light' || fig.color === 'buche-hell') {
      base = '#e6cb9c'; grain = 0.6; gloss = 0.16;
    } else if (fig.color === 'wood-dark') {
      base = '#6a4426'; grain = 0.38; gloss = 0.2; eye = '#f5ead8';
    } else {
      base = /^#/.test(fig.color || '') ? fig.color : '#c2955d';
      grain = 0.3; gloss = 0.42;
      const [r, g, b] = parseHexColor(base);
      if (r * 0.3 + g * 0.59 + b * 0.11 < 70) eye = '#f5f5f5';
    }
    return { base, grain, gloss, eye, dark: shade(base, -0.38), edge: shade(base, -0.58) };
  }

  function addLinearGradient(defs, id, mat) {
    const g = svgEl('linearGradient', { id: id, x1: 0, y1: 0, x2: 1, y2: 0 });
    [[0, -0.36], [0.2, 0.3], [0.42, 0.02], [0.74, -0.2], [1, -0.5]].forEach(([o, a]) => {
      g.appendChild(svgEl('stop', { offset: o, 'stop-color': shade(mat.base, a) }));
    });
    defs.appendChild(g);
  }

  function addRadialGradient(defs, id, mat) {
    const g = svgEl('radialGradient', { id: id, cx: 0.5, cy: 0.5, r: 0.62, fx: 0.36, fy: 0.3 });
    [[0, 0.62], [0.32, 0.14], [0.7, -0.24], [1, -0.52]].forEach(([o, a]) => {
      g.appendChild(svgEl('stop', { offset: o, 'stop-color': shade(mat.base, a) }));
    });
    defs.appendChild(g);
  }

  // Umriss zweier Kreise (Kegelstumpf / Kapsel) als geschlossener Pfad
  function hullPath(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1, dy = y2 - y1;
    const L = Math.hypot(dx, dy);
    const circ = (x, y, r) => `M ${x - r},${y} A ${r},${r} 0 1,0 ${x + r},${y} A ${r},${r} 0 1,0 ${x - r},${y} Z`;
    if (L <= Math.abs(r1 - r2) + 0.01) return r1 >= r2 ? circ(x1, y1, r1) : circ(x2, y2, r2);
    const a = Math.atan2(dy, dx);
    const gam = Math.acos((r1 - r2) / L);
    const pt = (x, y, r, t) => [x + r * Math.cos(t), y + r * Math.sin(t)];
    const p1a = pt(x1, y1, r1, a + gam), p2a = pt(x2, y2, r2, a + gam);
    const p2b = pt(x2, y2, r2, a - gam), p1b = pt(x1, y1, r1, a - gam);
    const large2 = 2 * gam > Math.PI ? 1 : 0;
    const large1 = 2 * Math.PI - 2 * gam > Math.PI ? 1 : 0;
    return `M ${p1a[0]},${p1a[1]} L ${p2a[0]},${p2a[1]} A ${r2},${r2} 0 ${large2},0 ${p2b[0]},${p2b[1]} L ${p1b[0]},${p1b[1]} A ${r1},${r1} 0 ${large1},0 ${p1a[0]},${p1a[1]} Z`;
  }

  // Holzmaserung als Overlay auf einer Kopie des Elements
  function grainOver(parent, el, mat, patternId) {
    if (isFastRender()) return null;      // beim Drehen/Neigen/Wischen vereinfacht zeichnen (flüssiger)
    const c = el.cloneNode(false);
    ['stroke', 'stroke-width', 'stroke-opacity', 'filter', 'class'].forEach(a => c.removeAttribute(a));
    c.setAttribute('fill', `url(#${patternId || 'pegGrain'})`);
    c.setAttribute('opacity', mat.grain);
    c.setAttribute('pointer-events', 'none');
    parent.appendChild(c);
    return c;
  }

  // Kugel als echter Bildschirm-Kreis: Größe und Form kommen aus der Projektion an dieser Stelle,
  // dadurch ist sie in jeder Perspektive rund (Einheitskreis, 1 Einheit = Radius r).
  function solidSphere(root, defs, ctx, mat, h, r, fillId) {
    const sp = ctx.sphere(h);
    const f = r * sp.scale;
    const g = svgEl('g', {
      transform: `translate(${sp.cx} ${sp.cy}) matrix(${sp.ax[0] * f} ${sp.ax[1] * f} ${sp.ay[0] * f} ${sp.ay[1] * f} 0 0)`
    });
    g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 1, fill: `url(#${fillId})`, stroke: mat.edge, 'stroke-width': 1 / r, 'stroke-opacity': 0.4 }));
    if (!isFastRender()) {
      const pid = `hg${ctx.uid}_${Math.round(h)}`;
      defs.appendChild(svgEl('pattern', { id: pid, href: '#pegGrain', patternTransform: `scale(${1 / r})` }));
      g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 1, fill: `url(#${pid})`, opacity: mat.grain, 'pointer-events': 'none' }));
      g.appendChild(svgEl('ellipse', {
        cx: -0.34, cy: -0.42, rx: 0.27, ry: 0.17,
        fill: 'url(#glossGrad)', opacity: Math.min(0.95, mat.gloss * 1.6 + 0.2), 'pointer-events': 'none'
      }));
    }
    root.appendChild(g);
    return {
      g: g,
      badge: {
        x: sp.cx + (sp.ax[0] * 0.72 - sp.ay[0] * 0.72) * f,
        y: sp.cy + (sp.ax[1] * 0.72 - sp.ay[1] * 0.72) * f
      }
    };
  }

  // Augen auf der Kugel (Koordinaten im Einheitskreis, y nach unten)
  function sphereEyes(g, ctx, fig, mat, latDeg, spreadDeg, er) {
    const phi = (fig.rotation || 0) + ctx.yaw;
    const psi = Math.PI - (phi * Math.PI) / 180;
    const lat = (latDeg * Math.PI) / 180;
    [-1, 1].forEach(sg => {
      const fe = psi + (sg * spreadDeg * Math.PI) / 180;
      const vis = Math.sin(lat) * Math.sin(ctx.elev) + Math.cos(lat) * Math.cos(fe) * Math.cos(ctx.elev);
      if (vis <= 0.04) return;
      const xs = Math.cos(lat) * Math.sin(fe);
      const ys = Math.sin(lat) * Math.cos(ctx.elev) - Math.cos(lat) * Math.cos(fe) * Math.sin(ctx.elev);
      g.appendChild(svgEl('ellipse', {
        cx: xs * 0.97, cy: -ys,
        rx: er * Math.max(0.35, vis),
        ry: er * Math.max(0.55, Math.min(1, vis * 1.1)),
        fill: mat.eye, 'pointer-events': 'none'
      }));
    });
  }

  // ---- Kegelfigur: Kegelkörper mit Kugelkopf und aufgemalten Augen ----
  function solidPeg(root, defs, fig, s, mat, ctx) {
    const Y = h => ctx.at(0, 0, h)[1], X = h => ctx.at(0, 0, h)[0];
    const R = s * 0.95, Hb = s * 1.35, rn = s * 0.3, hr = s * 0.6, hc = Hb + hr * 0.5;
    const lg = `lg${ctx.uid}`, rg = `rg${ctx.uid}`;
    addLinearGradient(defs, lg, mat);
    addRadialGradient(defs, rg, mat);

    const body = svgEl('path', {
      d: hullPath(0, 0, R, X(Hb), Y(Hb), rn), fill: `url(#${lg})`,
      stroke: mat.edge, 'stroke-width': 1, 'stroke-opacity': 0.45
    });
    root.appendChild(body);
    grainOver(root, body, mat);

    // Fuge zwischen Hals und Kopf
    root.appendChild(svgEl('circle', { cx: X(Hb), cy: Y(Hb) + 0.5, r: rn * 1.12, fill: shade(mat.base, -0.5), opacity: 0.5 }));

    const sph = solidSphere(root, defs, ctx, mat, hc, hr, rg);
    sphereEyes(sph.g, ctx, fig, mat, 6, 30, Math.max(0.07, (s * 0.085) / hr));

    return { height: hc + hr, badge: sph.badge };
  }

  // ---- Zylinder (mit abgesetztem Kopf und Augen) bzw. runder Stein mit Blickkerbe ----
  function solidCylinder(root, defs, fig, s, mat, ctx, mode) {
    const turned = mode === 'turned';
    const Y = h => ctx.at(0, 0, h)[1], X = h => ctx.at(0, 0, h)[0];
    const lg = `lg${ctx.uid}`;
    addLinearGradient(defs, lg, mat);
    const Rb = mode === 'plain' ? s * 0.85 : s * 0.95;
    const part = (r1, h1, r2, h2, fill) => {
      const p = svgEl('path', { d: hullPath(X(h1), Y(h1), r1, X(h2), Y(h2), r2), fill: fill, stroke: mat.edge, 'stroke-width': 1, 'stroke-opacity': 0.45 });
      root.appendChild(p);
      return p;
    };
    const cap = (r, h, amt) => {
      const c = svgEl('circle', { cx: X(h), cy: Y(h), r: r, fill: shade(mat.base, amt), stroke: mat.edge, 'stroke-width': 1, 'stroke-opacity': 0.4 });
      root.appendChild(c);
      grainOver(root, c, mat);
      return c;
    };
    const eyeAt = (cylR, h, spread, er) => {
      const psi = Math.PI - (((fig.rotation || 0) + ctx.yaw) * Math.PI) / 180;
      [-1, 1].forEach(sg => {
        const fe = psi + (sg * spread * Math.PI) / 180;
        const cs = Math.cos(fe);
        if (cs <= 0.12) return;
        root.appendChild(svgEl('ellipse', {
          cx: X(h) + cylR * Math.sin(fe), cy: Y(h) + cylR * cs,
          rx: er * Math.max(0.4, cs), ry: Math.max(er * 0.6, er * ctx.tanT),
          fill: mat.eye, 'pointer-events': 'none'
        }));
      });
    };

    if (turned) {
      const Hb = s * 1.1, gap = s * 0.11, Rh = s * 0.8, Hh = s * 0.62, top = Hb + gap + Hh;
      const b1 = part(Rb, 0, Rb, Hb, `url(#${lg})`);
      grainOver(root, b1, mat);
      part(Rb * 0.7, Hb, Rb * 0.7, Hb + gap, shade(mat.base, -0.4));       // Drechsel-Rille
      const b2 = part(Rh, Hb + gap, Rh, top, `url(#${lg})`);
      grainOver(root, b2, mat);
      cap(Rh, top, 0.2);
      eyeAt(Rh, Hb + gap + Hh * 0.55, 27, Math.max(1.7, s * 0.08));
      return { height: top, badge: { x: X(top) + Rh * 0.9, y: Y(top) - 4 } };
    }

    const H = mode === 'plain' ? s * 1.35 : s * 1.0;
    const b = part(Rb, 0, Rb, H, `url(#${lg})`);
    grainOver(root, b, mat);
    cap(Rb, H, 0.2);
    // Blickkerbe (dunkles Dreieck) an der Vorderseite
    const psi = Math.PI - (((fig.rotation || 0) + ctx.yaw) * Math.PI) / 180;
    const cs = Math.cos(psi);
    if (mode === 'notch' && cs > 0.15) {
      const x = X(H * 0.62) + Rb * Math.sin(psi), y = Y(H * 0.62) + Rb * cs;
      const nw = s * 0.3 * cs, nh = s * 0.42 * Math.max(0.5, ctx.tanT);
      root.appendChild(svgEl('polygon', {
        points: `${x - nw},${y - nh / 2} ${x + nw},${y - nh / 2} ${x},${y + nh / 2}`,
        fill: '#1a1006', opacity: 0.9, 'pointer-events': 'none'
      }));
    }
    return { height: H, badge: { x: X(H) + Rb * 0.9, y: Y(H) - 4 } };
  }

  // ---- Quader: Klötzchen, eckige Säule, Kiste ----
  function solidBox(root, defs, fig, hw, hd, H, mat, ctx, opts) {
    opts = opts || {};
    const a = (((fig.rotation || 0) + ctx.yaw) * Math.PI) / 180;
    const ca = Math.cos(a), sa = Math.sin(a);
    const rot = (x, y) => [x * ca - y * sa, x * sa + y * ca];
    const base = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(p => rot(p[0], p[1]));
    const top = base.map(p => ctx.at(p[0], p[1], H));
    const normals = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(n => rot(n[0], n[1]));
    const poly = pts => pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
    const stroke = { stroke: mat.edge, 'stroke-width': 1, 'stroke-opacity': 0.5, 'stroke-linejoin': 'round' };

    const visible = [];
    for (let i = 0; i < 4; i++) if (normals[i][1] > 0.02) visible.push(i);
    visible.sort((p, q) => normals[p][1] - normals[q][1]);

    visible.forEach(i => {
      const j = (i + 1) % 4;
      const nx = normals[i][0];
      const amt = Math.max(-0.5, Math.min(0.14, -0.2 - 0.32 * nx));
      const face = svgEl('polygon', Object.assign({ points: poly([base[i], base[j], top[j], top[i]]), fill: shade(mat.base, amt) }, stroke));
      root.appendChild(face);
      grainOver(root, face, mat);

      const P = (u, v) => {
        const pi = [base[i][0] + (top[i][0] - base[i][0]) * v, base[i][1] + (top[i][1] - base[i][1]) * v];
        const pj = [base[j][0] + (top[j][0] - base[j][0]) * v, base[j][1] + (top[j][1] - base[j][1]) * v];
        return [pi[0] + (pj[0] - pi[0]) * u, pi[1] + (pj[1] - pi[1]) * u];
      };
      if (opts.planks) {
        [1 / 3, 2 / 3].forEach(v => {
          const p1 = P(0, v), p2 = P(1, v);
          root.appendChild(svgEl('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: shade(mat.base, -0.55), 'stroke-width': 1.3, opacity: 0.6, 'pointer-events': 'none' }));
        });
      }
      if (opts.notch && i === 0) {
        const pts = [P(0.31, 0.92), P(0.69, 0.92), P(0.5, 0.58)];
        root.appendChild(svgEl('polygon', { points: poly(pts), fill: '#1a1006', opacity: 0.9, 'pointer-events': 'none' }));
      }
    });

    const topFace = svgEl('polygon', Object.assign({ points: poly(top), fill: shade(mat.base, 0.22) }, stroke));
    root.appendChild(topFace);
    grainOver(root, topFace, mat);
    if (opts.planks) {
      const m1 = [(top[0][0] + top[3][0]) / 2, (top[0][1] + top[3][1]) / 2], m2 = [(top[1][0] + top[2][0]) / 2, (top[1][1] + top[2][1]) / 2];
      root.appendChild(svgEl('line', { x1: m1[0], y1: m1[1], x2: m2[0], y2: m2[1], stroke: shade(mat.base, -0.5), 'stroke-width': 1.2, opacity: 0.5, 'pointer-events': 'none' }));
    }

    return { height: H, badge: { x: Math.max(...top.map(p => p[0])) * 0.85, y: Math.min(...top.map(p => p[1])) } };
  }

  // ---- Stein: gedrechselte Kuppel ----
  function solidDome(root, defs, fig, s, mat, ctx) {
    const Y = h => ctx.at(0, 0, h)[1], X = h => ctx.at(0, 0, h)[0];
    const lg = `lg${ctx.uid}`, rg = `rg${ctx.uid}`;
    addLinearGradient(defs, lg, mat);
    addRadialGradient(defs, rg, mat);
    const R = s * 1.0, cr = s * 0.82, ch = s * 0.62;
    const body = svgEl('path', { d: hullPath(0, 0, R, X(ch), Y(ch), cr), fill: `url(#${lg})`, stroke: mat.edge, 'stroke-width': 1, 'stroke-opacity': 0.45 });
    root.appendChild(body);
    grainOver(root, body, mat);
    const sph = solidSphere(root, defs, ctx, mat, ch, cr, rg);
    return { height: ch + cr, badge: sph.badge };
  }

  // ---- Licht: gedrechselte Holzbirne auf Fuß ----
  function solidBulb(root, defs, fig, s, mat, ctx) {
    const Y = h => ctx.at(0, 0, h)[1], X = h => ctx.at(0, 0, h)[0];
    const lg = `lg${ctx.uid}`, rg = `rg${ctx.uid}`;
    addLinearGradient(defs, lg, mat);
    addRadialGradient(defs, rg, mat);
    // Sockel mit Gewinderillen (keine breite Grundscheibe)
    const base = svgEl('path', { d: hullPath(0, 0, s * 0.36, X(s * 0.8), Y(s * 0.8), s * 0.34), fill: `url(#${lg})`, stroke: mat.edge, 'stroke-width': 1, 'stroke-opacity': 0.45 });
    root.appendChild(base);
    grainOver(root, base, mat);
    [0.2, 0.38, 0.56].forEach(h => {
      root.appendChild(svgEl('circle', { cx: X(s * h), cy: Y(s * h), r: s * 0.355, fill: 'none', stroke: mat.edge, 'stroke-width': 1.2, 'stroke-opacity': 0.4, 'pointer-events': 'none' }));
    });
    const hr = s * 0.74, hc = s * 1.52;
    const sph = solidSphere(root, defs, ctx, mat, hc, hr, rg);
    return { height: hc + hr, badge: sph.badge };
  }

  // ---- Symbole als ausgesägte, dicke Holzplatten auf einem Fuß ----
  function plateSpec(shape) {
    switch (shape) {
      case 'stern': {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const ang = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 === 0 ? 1.02 : 0.44;
          pts.push([Math.cos(ang) * r, -1.08 + Math.sin(ang) * r]);
        }
        return { parts: [{ poly: pts }] };
      }
      case 'herz':
        return { parts: [{ d: 'M 0,-0.12 C -1.2,-0.95 -0.95,-2.0 0,-1.5 C 0.95,-2.0 1.2,-0.95 0,-0.12 Z' }] };
      case 'diamant':
        return {
          parts: [{ poly: [[-0.62, -1.78], [0.62, -1.78], [1.02, -1.22], [0, -0.1], [-1.02, -1.22]] }],
          details: ['M -1.02,-1.22 L 1.02,-1.22', 'M -0.36,-1.22 L -0.62,-1.78', 'M 0.36,-1.22 L 0.62,-1.78', 'M -0.36,-1.22 L 0,-0.1', 'M 0.36,-1.22 L 0,-0.1']
        };
      case 'wolke':
        return { parts: [{ poly: [[0.42, -2.0], [-0.72, -0.95], [-0.1, -0.95], [-0.42, -0.04], [0.74, -1.2], [0.1, -1.2]] }] };
      case 'anker':
        return {
          parts: [
            { d: 'M 0,-1.65 L 0,-0.25 M -0.48,-1.38 L 0.48,-1.38 M -0.9,-0.8 C -0.9,-0.2 -0.35,-0.1 0,-0.25 C 0.35,-0.1 0.9,-0.2 0.9,-0.8', stroke: 0.24 },
            { circle: [0, -1.86, 0.2], stroke: 0.2 }
          ]
        };
      case 'fragezeichen':
        return {
          parts: [
            { d: 'M -0.55,-1.5 C -0.55,-2.1 0.62,-2.1 0.62,-1.5 C 0.62,-1.05 0,-1.05 0,-0.62', stroke: 0.3 },
            { circle: [0, -0.2, 0.2] }
          ]
        };
      case 'dreieck':
        return { parts: [{ poly: [[0, -1.98], [1.12, -0.12], [-1.12, -0.12]] }] };
      case 'tuer-zu':
        return {
          parts: [
            { rect: [-0.78, -2.0, 1.56, 2.0] },
            { rect: [-0.5, -1.78, 1.0, 0.8], stroke: 0.05, role: 'line' },
            { rect: [-0.5, -0.82, 1.0, 0.66], stroke: 0.05, role: 'line' },
            { circle: [0.52, -0.98, 0.1], role: 'gold' }
          ]
        };
      case 'tuer-offen':
        return {
          parts: [
            { rect: [-0.92, -2.06, 1.84, 2.06] },
            { rect: [-0.64, -1.84, 1.28, 1.84], role: 'dark' },
            { poly: [[-0.64, -1.84], [-0.1, -1.62], [-0.1, -0.14], [-0.64, 0]], role: 'light' },
            { poly: [[-0.56, -1.66], [-0.2, -1.52], [-0.2, -1.04], [-0.56, -1.1]], stroke: 0.04, role: 'line' },
            { circle: [-0.22, -0.88, 0.07], role: 'gold' }
          ]
        };
      case 'barriere':
      default:
        return { parts: [{ rect: [-0.95, -1.65, 0.22, 1.65] }, { rect: [0.73, -1.65, 0.22, 1.65] }, { rect: [-0.95, -1.5, 1.9, 0.34] }, { rect: [-0.95, -0.9, 1.9, 0.34] }] };
    }
  }

  function plateElement(part, color, paint) {
    let el;
    if (part.poly) el = svgEl('polygon', { points: part.poly.map(p => p[0] + ',' + p[1]).join(' ') });
    else if (part.d) el = svgEl('path', { d: part.d });
    else if (part.circle) el = svgEl('circle', { cx: part.circle[0], cy: part.circle[1], r: part.circle[2] });
    else el = svgEl('rect', { x: part.rect[0], y: part.rect[1], width: part.rect[2], height: part.rect[3] });
    if (part.stroke) {
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke', color);
      el.setAttribute('stroke-width', part.stroke);
      el.setAttribute('stroke-linecap', 'round');
      el.setAttribute('stroke-linejoin', 'round');
    } else {
      el.setAttribute('fill', color);
      el.setAttribute('stroke', paint === 'face' ? color : color);
      el.setAttribute('stroke-width', 0.05);
      el.setAttribute('stroke-linejoin', 'round');
    }
    return el;
  }

  function solidPlate(root, defs, fig, s, mat, ctx) {
    const Y = h => ctx.at(0, 0, h)[1], X = h => ctx.at(0, 0, h)[0];
    const lg = `lg${ctx.uid}`;
    addLinearGradient(defs, lg, mat);
    const spec = plateSpec(fig.shape);
    s = s * 1.16;                                   // Platten wirken sonst klein neben den Figuren

    // Die Platte steht ohne Fuß direkt auf dem Brett
    const footH = 0;

    // Maserung der Platte: waagerecht, im Einheitssystem der Platte skaliert
    const pid = `pg${ctx.uid}`;
    const pat = svgEl('pattern', { id: pid, href: '#pegGrain', patternTransform: `scale(${1 / s}) rotate(90)` });
    defs.appendChild(pat);

    const a = (((fig.rotation || 0) + ctx.yaw) * Math.PI) / 180;
    const ca = Math.cos(a), sa = Math.sin(a);
    const fl = [sa, -ca];                          // Blickrichtung (Vorderseite) im Bildschirmsystem
    const T = s * 0.34;                            // Plattendicke
    const N = 6;
    const offs = [];
    for (let k = 0; k <= N; k++) offs.push(-T / 2 + (T * k) / N);   // letzte = Vorderseite
    const frontNearest = fl[1] > 0;
    const order = frontNearest ? offs : offs.slice().reverse();     // hinten zuerst, zur Kamera hin zuletzt
    // senkrechte Achse der Platte: Bild einer Strecke der Länge s über dem Fuß
    const vx = X(footH + s) - X(footH), vy = Y(footH + s) - Y(footH);
    // Schattenwurf in Form der Platte (Licht von links oben: Schatten fällt nach rechts unten)
    const shadowG = svgEl('g', {
      transform: `matrix(${-s * ca} ${-s * sa} ${-0.62 * s} ${-0.3 * s} 0 0)`,
      opacity: 0.2, 'pointer-events': 'none'
    });
    spec.parts.filter(p => !p.role).forEach(p => shadowG.appendChild(plateElement(p, '#1c1006')));
    root.appendChild(shadowG);

    const matrix = off => `matrix(${-s * ca} ${-s * sa} ${-vx} ${-vy} ${X(footH) + fl[0] * off} ${Y(footH) + fl[1] * off})`;

    order.forEach((off, idx) => {
      const g = svgEl('g', { transform: matrix(off) });
      const nearest = idx === order.length - 1;
      if (!nearest) {
        spec.parts.filter(p => !p.role).forEach(p => g.appendChild(plateElement(p, mat.dark)));
      } else {
        const roleColor = r => r === 'dark' ? '#2a190b' : r === 'light' ? shade(mat.base, 0.3)
          : r === 'gold' ? '#d8b24a' : r === 'line' ? shade(mat.base, -0.55) : mat.base;
        // Beide Seiten der Platte tragen das Motiv (Rückseite spiegelverkehrt), damit es von jeder Seite erkennbar ist
        const faceParts = spec.parts;
        faceParts.forEach(p => g.appendChild(plateElement(p, roleColor(p.role), 'face')));
        // Maserung und Glanz auf der sichtbaren Fläche
        if (!isFastRender()) faceParts.filter(p => !p.role || p.role === 'light').forEach(p => {
          const el = plateElement(p, '#000', 'face');
          if (p.stroke) { el.setAttribute('stroke', `url(#${pid})`); } else { el.setAttribute('fill', `url(#${pid})`); el.setAttribute('stroke', 'none'); }
          el.setAttribute('opacity', mat.grain);
          el.setAttribute('pointer-events', 'none');
          g.appendChild(el);
        });
        if (spec.details) {
          spec.details.forEach(d => g.appendChild(svgEl('path', { d: d, fill: 'none', stroke: shade(mat.base, -0.5), 'stroke-width': 0.05, 'stroke-linecap': 'round', opacity: 0.7 })));
        }
        // dunkle Kontur der Vorderfläche
        faceParts.filter(p => !p.role || p.role === 'light').forEach(p => {
          const o = plateElement(p, 'none', 'face');
          o.setAttribute('fill', 'none');
          o.setAttribute('stroke', mat.edge);
          o.setAttribute('stroke-opacity', 0.35);
          o.setAttribute('stroke-width', p.stroke ? p.stroke + 0.07 : 0.07);
          if (p.stroke) { o.setAttribute('stroke-opacity', 0); }
          g.appendChild(o);
        });
      }
      root.appendChild(g);
    });
    return { height: footH + s * 2, badge: { x: X(footH + s * 2) + s * 0.9, y: Y(footH + s * 2) } };
  }

  // Plattensymbole (flach ausgesägt) werfen einen Schatten in ihrer eigenen Form statt eines runden Flecks
  function isPlateShape(shape) {
    return isSymbolShape(shape) && !['kiste', 'stein', 'licht', 'klotz', 'walze', 'kugel', 'baum'].includes(shape);
  }

  // ---- Schlagschatten ----
  function drawSolidShadow(root, s) {
    const estH = s * 2.3;
    [[1.2, 0.055], [1.05, 0.065], [0.9, 0.075], [0.75, 0.085], [0.6, 0.095]].forEach(([k, o]) => {
      root.appendChild(svgEl('path', {
        d: hullPath(0, 0, s * 1.02 * k, estH * 0.4 * k, estH * 0.17 * k, s * 0.5 * k),
        fill: '#1c1006', opacity: o, 'pointer-events': 'none'
      }));
    });
  }

  // ---- Holzkugel (liegt auf dem Brett) ----
  function solidBall(root, defs, fig, s, mat, ctx) {
    const rg = `rg${ctx.uid}`;
    addRadialGradient(defs, rg, mat);
    const r = s * 0.95;
    root.appendChild(svgEl('circle', { cx: 0, cy: 0, r: r * 0.5, fill: '#1c1006', opacity: 0.28, 'pointer-events': 'none' }));
    const sph = solidSphere(root, defs, ctx, mat, r, r, rg);
    return { height: r * 2, badge: sph.badge };
  }

  // ---- Baum: Stamm mit drei grünen Kegelstufen (Tannenbaum) ----
  function solidTree(root, defs, fig, s, mat, ctx) {
    const Y = h => ctx.at(0, 0, h)[1], X = h => ctx.at(0, 0, h)[0];
    const trunkMat = materialFor({ color: '#8a5a2b' });
    const lgT = `lgt${ctx.uid}`, lgC = `lg${ctx.uid}`;
    addLinearGradient(defs, lgT, trunkMat);
    addLinearGradient(defs, lgC, mat);
    const edge = { 'stroke-width': 1, 'stroke-opacity': 0.45 };
    const trunk = svgEl('path', Object.assign({ d: hullPath(0, 0, s * 0.27, X(s * 0.62), Y(s * 0.62), s * 0.22), fill: `url(#${lgT})`, stroke: trunkMat.edge }, edge));
    root.appendChild(trunk);
    grainOver(root, trunk, trunkMat);
    [[0.98, 0.32, 1.3], [0.78, 0.86, 1.8], [0.56, 1.38, 2.3]].forEach(([r, h0, h1]) => {
      const tier = svgEl('path', Object.assign({ d: hullPath(X(s * h0), Y(s * h0), s * r, X(s * h1), Y(s * h1), s * 0.05), fill: `url(#${lgC})`, stroke: mat.edge }, edge));
      root.appendChild(tier);
      grainOver(root, tier, mat);
    });
    return { height: s * 2.3, badge: { x: X(s * 1.6) + s * 0.75, y: Y(s * 1.6) } };
  }

  // ---- Auswahl des Körpers je nach Form ----
  function buildSolidBody(root, defs, fig, s, mat, ctx) {
    switch (fig.shape) {
      case 'kegel': case 'pegdoll': return solidPeg(root, defs, fig, s, mat, ctx);
      case 'zylinder': return solidCylinder(root, defs, fig, s, mat, ctx, 'turned');
      case 'rund': return solidCylinder(root, defs, fig, s, mat, ctx, 'notch');
      case 'walze': return solidCylinder(root, defs, fig, s, mat, ctx, 'plain');
      case 'block': case 'kloetzchen': return solidBox(root, defs, fig, s * 0.75, s * 0.45, s * 1.5, mat, ctx, {});
      case 'klotz': return solidBox(root, defs, fig, s * 0.95, s * 0.52, s * 1.0, mat, ctx, {});
      case 'kiste': return solidBox(root, defs, fig, s * 0.95, s * 0.95, s * 1.4, mat, ctx, { planks: true });
      case 'stein': return solidDome(root, defs, fig, s, mat, ctx);
      case 'licht': return solidBulb(root, defs, fig, s, mat, ctx);
      case 'kugel': return solidBall(root, defs, fig, s, mat, ctx);
      case 'baum': return solidTree(root, defs, fig, s, mat, ctx);
      default:
        if (isSymbolShape(fig.shape)) return solidPlate(root, defs, fig, s, mat, ctx);
        return solidBox(root, defs, fig, s, s, s * 1.5, mat, ctx, { notch: true });
    }
  }

  // ---- Vorschau-Grafik (gleiche Zeichenroutinen wie auf dem Brett, 40° Neigung, ohne Perspektive) ----
  function buildPreviewGroup(fig, s, noShadow) {
    const T = (58 * Math.PI) / 180;   // steiler als die Brettansicht: Motive bleiben gut erkennbar
    const ctx = { tanT: Math.tan(T), cosT: Math.cos(T), elev: Math.PI / 2 - T, yaw: 0, uid: ++solidUid };
    ctx.at = (lx, ly, h) => [lx, ly - h * ctx.tanT];
    ctx.sphere = h => ({ cx: 0, cy: -h * ctx.tanT, ax: [1, 0], ay: [0, 1 / ctx.cosT], scale: 1 });
    const outer = svgEl('g', {});
    const flat = svgEl('g', { transform: `scale(1, ${ctx.cosT})` });
    outer.appendChild(flat);
    const defs = svgEl('defs', {});
    flat.appendChild(defs);
    if (!noShadow && !isPlateShape(fig.shape)) drawSolidShadow(flat, s);
    buildSolidBody(flat, defs, Object.assign({ rotation: 180, size: 'mittel', scale: 5 }, fig), s, materialFor(fig), ctx);
    return outer;
  }

  // Vorschaubilder der Palette: zeigen genau das Objekt, das später auf dem Brett steht
  function initPalettePreviews() {
    document.querySelectorAll('.quick-figure-btn, .symbol-card').forEach(btn => {
      const preset = presetFromElement(btn);
      if (!preset) return;
      const slot = btn.querySelector('.preview-slot, .symbol-icon');
      if (!slot) return;
      const svg = svgEl('svg', { viewBox: '-24 -40 48 50', class: 'palette-preview', 'aria-hidden': 'true' });
      svg.appendChild(buildPreviewGroup({ shape: preset.shape, color: preset.color }, 15));
      slot.textContent = '';
      slot.appendChild(svg);
    });
  }

  // ---- Zusammenbau einer 3D-Figur ----
  function createSolidFigureElement(fig) {
    const g = svgEl('g', {
      class: `system-figure solid ${fig.id === STATE.selectedFigureId ? 'selected' : ''}`,
      'data-id': fig.id,
      transform: `translate(${fig.x}, ${fig.y})`
    });
    const s = SIZE_MAP[fig.size] || 27;
    const T = (clamp(STATE.viewTilt, 0, 70) * Math.PI) / 180;
    const ctx = { tanT: Math.tan(T), cosT: Math.cos(T), elev: Math.PI / 2 - T, yaw: STATE.viewYaw, uid: ++solidUid };
    // Punkt (lx, ly) im Figuren-Bildschirmsystem in Höhe h -> Position, an der er tatsächlich erscheint
    const proj = STATE.solidProj || getTargetProjection();
    const yw = (STATE.viewYaw * Math.PI) / 180, cyw = Math.cos(yw), syw = Math.sin(yw);
    // Lage und Form eines Bildschirm-Kreises (Kugelmitte in Höhe h) im Figuren-System
    ctx.sphere = (h) => {
      const S = proj.forward3(fig.x, fig.y, h);
      const toLocal = P => { const dx = P.x - fig.x, dy = P.y - fig.y; return [dx * cyw - dy * syw, dx * syw + dy * cyw]; };
      const c = toLocal(proj.inverse(S.x, S.y));
      const u = toLocal(proj.inverse(S.x + 1, S.y));
      const v = toLocal(proj.inverse(S.x, S.y + 1));
      return { cx: c[0], cy: c[1], ax: [u[0] - c[0], u[1] - c[1]], ay: [v[0] - c[0], v[1] - c[1]], scale: STATE.zoom * S.k };
    };
    ctx.at = (lx, ly, h) => {
      const bx = fig.x + lx * cyw + ly * syw;
      const by = fig.y - lx * syw + ly * cyw;
      const S = proj.forward3(bx, by, h);
      const P = proj.inverse(S.x, S.y);
      const dx = P.x - fig.x, dy = P.y - fig.y;
      return [dx * cyw - dy * syw, dx * syw + dy * cyw];
    };
    const mat = materialFor(fig);

    const root = svgEl('g', { transform: `rotate(${-STATE.viewYaw})`, class: 'fig-solid-root' });
    g.appendChild(root);
    const defs = svgEl('defs', {});
    root.appendChild(defs);

    // Schlagschatten auf dem Brett (Licht von links oben)
    if (!isPlateShape(fig.shape)) drawSolidShadow(root, s);

    // Standfläche: Trefferfläche und Auswahlring auf dem Brett
    root.appendChild(svgEl('circle', { cx: 0, cy: 0, r: s * 1.16, fill: 'rgba(0,0,0,0.001)', class: 'fig-body' }));

    const info = buildSolidBody(root, defs, fig, s, mat, ctx);

    // Aufrechtes, unverzerrtes Schild: Bildschirm-Pixel -> Brettebene an dieser Stelle (inkl. Perspektive)
    const S0 = proj.forward(fig.x, fig.y);
    const pX = proj.inverse(S0.x + 1, S0.y), pY = proj.inverse(S0.x, S0.y + 1);
    const toLocal = (dx, dy) => [dx * cyw - dy * syw, dx * syw + dy * cyw];
    const vxl = toLocal(pX.x - fig.x, pX.y - fig.y), vyl = toLocal(pY.x - fig.x, pY.y - fig.y);
    const zf = STATE.zoom;
    const billboard = `matrix(${vxl[0] * zf} ${vxl[1] * zf} ${vyl[0] * zf} ${vyl[1] * zf} 0 0)`;
    const label = svgEl('g', { transform: `translate(0, ${s * 1.02}) ${billboard}`, class: 'fig-label-wrap' });
    const text = svgEl('text', { x: 0, y: 15, class: 'figure-label-text' });
    text.textContent = fig.name || 'Figur';
    label.appendChild(text);
    root.appendChild(label);

    if (fig.scale && fig.scale !== 5) {
      const b = svgEl('g', { transform: `translate(${info.badge.x}, ${info.badge.y}) ${billboard}` });
      b.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 9, fill: fig.scale >= 7 ? '#10b981' : (fig.scale <= 3 ? '#ef4444' : '#3b82f6'), stroke: '#ffffff', 'stroke-width': 1.5 }));
      const bt = svgEl('text', { x: 0, y: 3, class: 'figure-scale-badge' });
      bt.textContent = fig.scale;
      b.appendChild(bt);
      root.appendChild(b);
    }
    return g;
  }

  function createFigureSvgElement(fig) {
    if (useSolids()) return createSolidFigureElement(fig);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `system-figure ${fig.id === STATE.selectedFigureId ? 'selected' : ''}`);
    g.setAttribute('data-id', fig.id);
    g.setAttribute('transform', `translate(${fig.x}, ${fig.y})`);
    g.setAttribute('filter', 'url(#figureShadow)');

    const sizePx = SIZE_MAP[fig.size] || 27;
    const rotation = fig.rotation || 0;

    const rotGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    rotGroup.setAttribute('transform', `rotate(${rotation})`);
    rotGroup.setAttribute('class', 'fig-rot-body');

    // Farbdefinition (Holz oder Lack)
    let fillColor = fig.color;
    let strokeColor = 'rgba(0,0,0,0.35)';
    let eyeColor = '#1a1a1a';

    if (fig.color === 'wood-light' || fig.color === 'buche-hell') {
      fillColor = '#eedbc0';
      strokeColor = '#a8865c';
    } else if (fig.color === 'wood-dark') {
      fillColor = '#5c3a21';
      strokeColor = '#2b1a0c';
      eyeColor = '#ffffff';
    } else if (fig.color === '#1a1a1a' || fig.color === '#111111') {
      eyeColor = '#ffffff';
    }

    // FIGUREN-GESTALTUNG
    if (fig.shape === 'kegel' || fig.shape === 'pegdoll') {
      // 1. KEGELFIGUR (SPIELFIGUR MIT KOPF UND AUFGEMALTEN AUGEN ••)
      // Körper-Basis
      const bodyBase = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bodyBase.setAttribute('cx', 0);
      bodyBase.setAttribute('cy', 0);
      bodyBase.setAttribute('r', sizePx);
      bodyBase.setAttribute('fill', fillColor);
      bodyBase.setAttribute('stroke', strokeColor);
      bodyBase.setAttribute('stroke-width', '2.5');
      bodyBase.setAttribute('class', 'fig-body');
      rotGroup.appendChild(bodyBase);

      // Abgedrehter Kopf (Kugel)
      const headR = sizePx * 0.58;
      const head = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      head.setAttribute('cx', 0);
      head.setAttribute('cy', -sizePx * 0.12);
      head.setAttribute('r', headR);
      head.setAttribute('fill', fillColor);
      head.setAttribute('stroke', strokeColor);
      head.setAttribute('stroke-width', '1.8');
      rotGroup.appendChild(head);

      // DIE CHARAKTERISTISCHEN AUFGEMALTEN AUGEN (••) IN BLICKRICHTUNG
      const eyeR = Math.max(1.5, sizePx * 0.08);
      const eyeOffset = headR * 0.42;
      const eyeY = -sizePx * 0.12 - headR * 0.52;

      // Linkes Auge
      const eyeLeft = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      eyeLeft.setAttribute('cx', -eyeOffset);
      eyeLeft.setAttribute('cy', eyeY);
      eyeLeft.setAttribute('r', eyeR);
      eyeLeft.setAttribute('fill', eyeColor);
      rotGroup.appendChild(eyeLeft);

      // Rechtes Auge
      const eyeRight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      eyeRight.setAttribute('cx', eyeOffset);
      eyeRight.setAttribute('cy', eyeY);
      eyeRight.setAttribute('r', eyeR);
      eyeRight.setAttribute('fill', eyeColor);
      rotGroup.appendChild(eyeRight);

    } else if (fig.shape === 'zylinder') {
      // 2. ZYLINDERFIGUR MIT AUGEN (••)
      const cyl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      cyl.setAttribute('cx', 0);
      cyl.setAttribute('cy', 0);
      cyl.setAttribute('r', sizePx);
      cyl.setAttribute('fill', fillColor);
      cyl.setAttribute('stroke', strokeColor);
      cyl.setAttribute('stroke-width', '2.5');
      cyl.setAttribute('class', 'fig-body');
      rotGroup.appendChild(cyl);

      // Gedrechselte Hals-Rille
      const collar = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      collar.setAttribute('cx', 0);
      collar.setAttribute('cy', 0);
      collar.setAttribute('r', sizePx * 0.68);
      collar.setAttribute('fill', 'none');
      collar.setAttribute('stroke', strokeColor);
      collar.setAttribute('stroke-width', '1.5');
      collar.setAttribute('stroke-opacity', '0.6');
      rotGroup.appendChild(collar);

      // Augen auf dem Zylinderkopf
      const eyeR = Math.max(1.5, sizePx * 0.075);
      const eyeOffset = sizePx * 0.28;
      const eyeY = -sizePx * 0.55;

      const eyeLeft = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      eyeLeft.setAttribute('cx', -eyeOffset);
      eyeLeft.setAttribute('cy', eyeY);
      eyeLeft.setAttribute('r', eyeR);
      eyeLeft.setAttribute('fill', eyeColor);
      rotGroup.appendChild(eyeLeft);

      const eyeRight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      eyeRight.setAttribute('cx', eyeOffset);
      eyeRight.setAttribute('cy', eyeY);
      eyeRight.setAttribute('r', eyeR);
      eyeRight.setAttribute('fill', eyeColor);
      rotGroup.appendChild(eyeRight);

    } else if (fig.shape === 'block' || fig.shape === 'kloetzchen') {
      // 3. RECHTECKIGES HOLZKLÖTZCHEN / SÄULE
      const bw = sizePx * 1.5;
      const bh = sizePx * 0.9;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -bw / 2);
      rect.setAttribute('y', -bh / 2);
      rect.setAttribute('width', bw);
      rect.setAttribute('height', bh);
      rect.setAttribute('rx', 4);
      rect.setAttribute('fill', fillColor);
      rect.setAttribute('stroke', strokeColor);
      rect.setAttribute('stroke-width', '2.5');
      rect.setAttribute('class', 'fig-body');
      rotGroup.appendChild(rect);

      // Subtile Maserungsfase
      const innerBevel = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      innerBevel.setAttribute('x', -bw / 2 + 3);
      innerBevel.setAttribute('y', -bh / 2 + 3);
      innerBevel.setAttribute('width', bw - 6);
      innerBevel.setAttribute('height', bh - 6);
      innerBevel.setAttribute('rx', 2);
      innerBevel.setAttribute('fill', 'none');
      innerBevel.setAttribute('stroke', 'rgba(255,255,255,0.25)');
      innerBevel.setAttribute('stroke-width', '1');
      rotGroup.appendChild(innerBevel);

    } else if (fig.shape === 'rund') {
      // Rund mit Blickkerbe
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', 0);
      circle.setAttribute('cy', 0);
      circle.setAttribute('r', sizePx);
      circle.setAttribute('fill', fillColor);
      circle.setAttribute('stroke', strokeColor);
      circle.setAttribute('stroke-width', '2.5');
      circle.setAttribute('class', 'fig-body');
      rotGroup.appendChild(circle);

      const notch = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const nw = sizePx * 0.35;
      const nh = sizePx * 0.45;
      notch.setAttribute('points', `0,${-sizePx + nh} ${-nw},${-sizePx} ${nw},${-sizePx}`);
      notch.setAttribute('fill', '#1a1006');
      notch.setAttribute('class', 'figure-gaze-notch');
      rotGroup.appendChild(notch);

    } else if (isSymbolShape(fig.shape)) {
      renderSymbolFigure(rotGroup, fig, sizePx, fillColor, strokeColor);
    } else {
      // Standard: Eckig mit Kerbe
      const half = sizePx;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -half);
      rect.setAttribute('y', -half);
      rect.setAttribute('width', half * 2);
      rect.setAttribute('height', half * 2);
      rect.setAttribute('rx', 6);
      rect.setAttribute('fill', fillColor);
      rect.setAttribute('stroke', strokeColor);
      rect.setAttribute('stroke-width', '2.5');
      rect.setAttribute('class', 'fig-body');
      rotGroup.appendChild(rect);

      const notch = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const nw = half * 0.35;
      const nh = half * 0.45;
      notch.setAttribute('points', `0,${-half + nh} ${-nw},${-half} ${nw},${-half}`);
      notch.setAttribute('fill', '#1a1006');
      notch.setAttribute('class', 'figure-gaze-notch');
      rotGroup.appendChild(notch);
    }

    g.appendChild(rotGroup);

    // BESCHRIFTUNG (bleibt horizontal lesbar)
    // Beschriftung bleibt auch bei gedrehter Ansicht aufrecht lesbar
    const labelWrap = svgEl('g', { transform: `rotate(${-STATE.viewRotation})`, class: 'fig-label-wrap' });

    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', 0);
    labelText.setAttribute('y', sizePx + 16);
    labelText.setAttribute('class', 'figure-label-text');
    labelText.textContent = fig.name || 'Figur';
    labelWrap.appendChild(labelText);

    // SKALEN-BADGE (falls != 5)
    if (fig.scale && fig.scale !== 5) {
      const scaleBadge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      scaleBadge.setAttribute('transform', `translate(${sizePx * 0.7}, ${-sizePx * 0.7})`);

      const badgeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      badgeCircle.setAttribute('cx', 0);
      badgeCircle.setAttribute('cy', 0);
      badgeCircle.setAttribute('r', 9);
      badgeCircle.setAttribute('fill', fig.scale >= 7 ? '#10b981' : (fig.scale <= 3 ? '#ef4444' : '#3b82f6'));
      badgeCircle.setAttribute('stroke', '#ffffff');
      badgeCircle.setAttribute('stroke-width', '1.5');
      scaleBadge.appendChild(badgeCircle);

      const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badgeText.setAttribute('x', 0);
      badgeText.setAttribute('y', 3);
      badgeText.setAttribute('class', 'figure-scale-badge');
      badgeText.textContent = fig.scale;
      scaleBadge.appendChild(badgeText);

      labelWrap.appendChild(scaleBadge);
    }

    g.appendChild(labelWrap);
    return g;
  }

  function isSymbolShape(shape) {
    return ['stern', 'herz', 'diamant', 'stein', 'wolke', 'kiste', 'anker', 'fragezeichen', 'barriere', 'licht',
      'klotz', 'walze', 'kugel', 'baum', 'tuer-zu', 'tuer-offen', 'dreieck'].includes(shape);
  }

  // Symbole in der Draufsicht: heller Sockel mit farbigem Rand und dem Objekt als Piktogramm
  // (dieselbe Zeichnung wie in der Palette und in der 3D-Ansicht, ohne Augen)
  function renderSymbolFigure(parent, fig, sizePx, fill, stroke) {
    const s = sizePx;
    // unsichtbare Trefferfläche (zeigt beim Auswählen den Ring), keine sichtbare Grundscheibe
    parent.appendChild(svgEl('circle', { cx: 0, cy: 0, r: s, fill: 'rgba(0,0,0,0.001)', class: 'fig-body' }));

    const k = s / 19;
    const art = svgEl('g', {
      transform: `rotate(${-(fig.rotation || 0)}) translate(0, ${13 * k}) scale(${k})`,
      'pointer-events': 'none'
    });
    art.appendChild(buildPreviewGroup({ shape: fig.shape, color: fig.color, size: fig.size }, 15, true));
    parent.appendChild(art);
  }

  // ==========================================================================
  // 6. SICHTKEGEL & BLICKACHSEN
  // ==========================================================================

  function renderVisionCone(fig) {
    const isPov = STATE.povFigureId === fig.id;
    const isSelected = STATE.selectedFigureId === fig.id;
    const length = 260;
    const halfAngle = 35; // 70° Gesichtsfeld

    const cone = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cone.setAttribute('class', `vision-cone ${isPov || isSelected ? 'highlighted' : ''}`);

    const radL = degToRad(-90 - halfAngle);
    const radR = degToRad(-90 + halfAngle);
    const xL = Math.cos(radL) * length;
    const yL = Math.sin(radL) * length;
    const xR = Math.cos(radR) * length;
    const yR = Math.sin(radR) * length;

    const pathData = `M 0,0 L ${xL},${yL} A ${length},${length} 0 0,1 ${xR},${yR} Z`;
    cone.setAttribute('d', pathData);

    if (isPov) {
      cone.setAttribute('fill', 'rgba(59, 130, 246, 0.28)');
      cone.setAttribute('stroke', 'rgba(59, 130, 246, 0.5)');
    } else if (isSelected) {
      cone.setAttribute('fill', 'rgba(194, 149, 93, 0.22)');
      cone.setAttribute('stroke', 'rgba(194, 149, 93, 0.45)');
    } else {
      cone.setAttribute('fill', 'rgba(255, 255, 255, 0.08)');
      cone.setAttribute('stroke', 'rgba(255, 255, 255, 0.15)');
    }
    cone.setAttribute('stroke-width', '1');
    cone.setAttribute('transform', `translate(${fig.x}, ${fig.y}) rotate(${fig.rotation})`);
    sightConesGroup.appendChild(cone);
  }

  function renderSightLines(figures) {
    for (let i = 0; i < figures.length; i++) {
      for (let j = i + 1; j < figures.length; j++) {
        const A = figures[i];
        const B = figures[j];

        const aSeesB = isTargetInView(A, B);
        const bSeesA = isTargetInView(B, A);

        if (aSeesB || bSeesA) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', A.x);
          line.setAttribute('y1', A.y);
          line.setAttribute('x2', B.x);
          line.setAttribute('y2', B.y);
          line.setAttribute('class', 'sight-line');

          if (aSeesB && bSeesA) {
            line.setAttribute('stroke', 'rgba(16, 185, 129, 0.7)');
            line.setAttribute('stroke-width', '2.5');
            line.setAttribute('stroke-dasharray', 'none');
          } else {
            line.setAttribute('stroke', 'rgba(59, 130, 246, 0.4)');
            line.setAttribute('stroke-width', '1.5');
            line.setAttribute('stroke-dasharray', '4 4');
          }

          sightLinesGroup.appendChild(line);
        }
      }
    }
  }

  function renderFigureControls(fig) {
    const sizePx = SIZE_MAP[fig.size] || 27;
    const handleDistance = sizePx + 36;
    const rot = fig.rotation || 0;

    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', fig.x);
    ring.setAttribute('cy', fig.y);
    ring.setAttribute('r', handleDistance);
    ring.setAttribute('class', 'rotation-handle-ring');
    ring.setAttribute('pointer-events', 'none');      // nur der Knopf ist greifbar, die Figur bleibt aus der Mitte ziehbar
    controlsOverlayGroup.appendChild(ring);

    const rad = degToRad(rot - 90);
    const hx = fig.x + Math.cos(rad) * handleDistance;
    const hy = fig.y + Math.sin(rad) * handleDistance;

    const knob = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    knob.setAttribute('cx', hx);
    knob.setAttribute('cy', hy);
    knob.setAttribute('r', 8);
    knob.setAttribute('class', 'rotation-handle-knob');
    knob.setAttribute('data-handle-id', fig.id);
    knob.setAttribute('title', 'Ziehen zum Drehen der Blickrichtung');
    controlsOverlayGroup.appendChild(knob);

    // unsichtbare, größere Trefferfläche, damit der Knopf mit dem Finger greifbar ist
    const knobHit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    knobHit.setAttribute('cx', hx);
    knobHit.setAttribute('cy', hy);
    knobHit.setAttribute('r', window.matchMedia('(pointer: coarse)').matches ? 26 : 14);
    knobHit.setAttribute('fill', 'rgba(0,0,0,0.001)');
    knobHit.setAttribute('data-handle-id', fig.id);
    controlsOverlayGroup.appendChild(knobHit);

    const handleLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    handleLine.setAttribute('x1', fig.x);
    handleLine.setAttribute('y1', fig.y);
    handleLine.setAttribute('x2', hx);
    handleLine.setAttribute('y2', hy);
    handleLine.setAttribute('stroke', 'rgba(194, 149, 93, 0.7)');
    handleLine.setAttribute('stroke-width', '1.5');
    handleLine.setAttribute('pointer-events', 'none');
    controlsOverlayGroup.insertBefore(handleLine, knob);
  }

  // ==========================================================================
  // 7. BEZIEHUNGSBÄNDER & KORDELN
  // ==========================================================================

  function styleRelationPath(path, type, color) {
    switch (type) {
      case 'conflict':
        path.setAttribute('stroke', '#ef4444');
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('stroke-dasharray', '8 4');
        break;
      case 'arrow':
        path.setAttribute('stroke', '#3b82f6');
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('marker-end', 'url(#arrowHead)');
        break;
      case 'mutual':
        path.setAttribute('stroke', '#10b981');
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('marker-start', 'url(#circleMarker)');
        path.setAttribute('marker-end', 'url(#circleMarker)');
        break;
      case 'barrier':
        path.setAttribute('stroke', '#f59e0b');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('stroke-dasharray', '12 6');
        break;
      case 'solid':
      default:
        path.setAttribute('stroke', color || '#c2955d');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('stroke-linecap', 'round');
        break;
    }
    path.style.color = path.getAttribute('stroke');   // Pfeilspitzen übernehmen die Linienfarbe
  }

  function renderRelationships() {
    relationshipLinesGroup.innerHTML = '';
    const phase = getCurrentPhase();
    if (!phase || !phase.relations) return;

    phase.relations.forEach((rel, index) => {
      const figA = getFigureById(rel.fromId);
      const figB = getFigureById(rel.toId);
      if (!figA || !figB) return;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'relation-wire');
      path.setAttribute('data-rel-index', index);

      const d = `M ${figA.x},${figA.y} L ${figB.x},${figB.y}`;
      path.setAttribute('d', d);

      styleRelationPath(path, rel.type, rel.color);

      path.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Dieses Beziehungsband entfernen?')) {
          phase.relations.splice(index, 1);
          renderFigures();
          updateRelationUIList();
          playWoodClick(0.8);
          saveToStorage();
        }
      });

      relationshipLinesGroup.appendChild(path);
    });

    updateRelationUIList();
  }

  function updateRelationUIList() {
    const list = document.getElementById('relationList');
    if (!list) return;
    const phase = getCurrentPhase();
    if (!phase || !phase.relations || phase.relations.length === 0) {
      list.innerHTML = '<div class="empty-hint">Noch keine Verbindungen gezogen.</div>';
      return;
    }

    list.innerHTML = '';
    phase.relations.forEach((rel, i) => {
      const figA = getFigureById(rel.fromId);
      const figB = getFigureById(rel.toId);
      const nameA = figA ? figA.name : 'Unbekannt';
      const nameB = figB ? figB.name : 'Unbekannt';

      const row = document.createElement('div');
      row.className = 'relation-item-row';
      row.innerHTML = `
        <span><strong>${escapeHtml(nameA)}</strong> ↔ <strong>${escapeHtml(nameB)}</strong></span>
        <button class="btn btn-xs btn-outline-danger" data-del-rel="${i}">✕</button>
      `;
      row.querySelector('[data-del-rel]').addEventListener('click', () => {
        phase.relations.splice(i, 1);
        renderFigures();
        playWoodClick(0.8);
        saveToStorage();
      });
      list.appendChild(row);
    });
  }

  // ==========================================================================
  // 8. INTERAKTIONS-HANDLER (DRAG, ROTATE, ZOOM, PAN)
  // ==========================================================================

  function getSvgPoint(evt) {
    return clientToBoard(evt.clientX, evt.clientY);
  }

  function setupInteractions() {
    const viewport = document.getElementById('boardViewport');

    // ---- Touch: aktive Finger und Zwei-Finger-Geste (zoomen, drehen, neigen) ----
    const touchPts = new Map();   // pointerId -> {x, y}
    let gesture = null;
    let touchLock = false;        // nach einer Geste bleibt ein Restfinger wirkungslos, bis alle Finger oben sind

    const angleBetween = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;

    function beginGesture() {
      // laufende Einzel-Interaktionen abbrechen
      STATE.draggingFigureId = null;
      STATE.rotatingFigureId = null;
      STATE.isPanning = false;
      STATE.isRotatingView = false;
      stopViewMotion();
      const ids = [...touchPts.keys()].slice(0, 2);
      const a = touchPts.get(ids[0]), b = touchPts.get(ids[1]);
      const c0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture = {
        ids: ids, c0: c0,
        dist0: Math.max(20, Math.hypot(b.x - a.x, b.y - a.y)),
        lastAng: angleBetween(a, b), twist: 0,
        zoom0: STATE.zoom, yaw0: STATE.viewYaw, tilt0: STATE.viewTilt,
        anchor: clientToBoard(c0.x, c0.y),
        is3d: STATE.viewMode === '25d' && !STATE.povFigureId
      };
      STATE.autoFit = false;
      STATE.fastRender = true;
      touchLock = true;
    }

    function updateGesture() {
      const a = touchPts.get(gesture.ids[0]), b = touchPts.get(gesture.ids[1]);
      if (!a || !b) return;
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.max(20, Math.hypot(b.x - a.x, b.y - a.y));
      STATE.zoom = clamp(gesture.zoom0 * (dist / gesture.dist0), MIN_ZOOM, MAX_ZOOM);

      let target = c;
      if (gesture.is3d) {
        // 3D: Drehen der Finger dreht das Brett, gemeinsames Hoch/Runter neigt – um den Startpunkt
        const ang = angleBetween(a, b);
        gesture.twist += ((ang - gesture.lastAng + 540) % 360) - 180;
        gesture.lastAng = ang;
        STATE.viewYaw = gesture.yaw0 + gesture.twist;
        STATE.viewTilt = clamp(gesture.tilt0 - (c.y - gesture.c0.y) * 0.25, 0, 70);
        target = gesture.c0;
      }
      pinPoint(gesture.anchor, target);   // Punkte unter den Fingern bleiben unter den Fingern (Zoom und Verschieben)
    }

    function endGesture() {
      gesture = null;
      STATE.fastRender = false;
      refreshSolidsIfNeeded();
      saveToStorage();
    }

    // Capture-Phase: Mehrfinger-Gesten dürfen nicht als Auswahl oder Ziehen einer Figur ankommen
    viewport.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Der Viewport hält die Finger fest, auch wenn ein Figur-Element beim Ziehen neu gezeichnet wird
      try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* nicht unterstützt */ }
      if (touchPts.size >= 2) {
        e.stopPropagation();
        e.preventDefault();
        if (!gesture) beginGesture();
      } else {
        STATE.fastRender = true;
      }
    }, true);

    svgElem.addEventListener('pointerdown', (e) => {
      initAudio();
      const svgPt = getSvgPoint(e);

      const handleTarget = e.target.closest('[data-handle-id]');
      if (handleTarget) {
        e.stopPropagation();
        STATE.rotatingFigureId = handleTarget.getAttribute('data-handle-id');
        return;
      }

      const figTarget = e.target.closest('.system-figure');
      if (figTarget) {
        e.stopPropagation();
        const figId = figTarget.getAttribute('data-id');

        if (STATE.activeRelationMode) {
          STATE.pointerClient = { x: e.clientX, y: e.clientY };
          STATE.relPress = { x: e.clientX, y: e.clientY };   // Ziehen von Figur zu Figur verbindet ebenfalls
          handleRelationClick(figId);
          return;
        }

        selectFigure(figId);
        STATE.draggingFigureId = figId;
        const fig = getFigureById(figId);
        if (fig) {
          STATE.dragOffset.x = svgPt.x - fig.x;
          STATE.dragOffset.y = svgPt.y - fig.y;
        }
        return;
      }

      if (e.target.id === 'outerSpace' || e.target.classList.contains('board-half') || e.target.id === 'boardSvg') {
        selectFigure(null);
        startViewDrag(e);
      }
    });

    // Auch die Fläche um das Brett herum nimmt Ziehen entgegen
    viewport.addEventListener('pointerdown', (e) => {
      if (e.target === viewport || e.target.id === 'boardTransform') {
        initAudio();
        selectFigure(null);
        startViewDrag(e);
      }
    });

    // Freie Fläche: Brett greifen und verschieben; in 3D mit rechter Maustaste oder Strg/Shift drehen und neigen
    function startViewDrag(e) {
      stopViewMotion();
      const is3d = STATE.viewMode === '25d' && !STATE.povFigureId;
      if (is3d && (e.button === 2 || e.ctrlKey || e.metaKey || e.shiftKey)) {
        const c = viewportCenterClient();
        STATE.isRotatingView = true;
        STATE.rotStart = {
          x: e.clientX, y: e.clientY, yaw: STATE.viewYaw, tilt: STATE.viewTilt,
          anchor: clientToBoard(c.x, c.y)
        };
        document.body.classList.add('view-rotating');
      } else {
        STATE.isPanning = true;
        STATE.panAnchor = clientToBoard(e.clientX, e.clientY);
        STATE.panVel = { x: 0, y: 0 };
        STATE.panLastTime = 0;
      }
    }

    // Doppelklick auf freie Fläche: hineinzoomen (wie bei Karten)
    svgElem.addEventListener('dblclick', (e) => {
      if (e.target.id === 'outerSpace' || e.target.classList.contains('board-half') || e.target.id === 'boardSvg') {
        zoomAt(1.6, e.clientX, e.clientY);
      }
    });

    viewport.addEventListener('contextmenu', (e) => {
      // langes Drücken (Touch) und rechte Maustaste in 3D sollen kein Browser-Menü öffnen
      if (STATE.viewMode === '25d' || e.pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches) e.preventDefault();
    });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        if (touchPts.has(e.pointerId)) touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (gesture) { updateGesture(); return; }
        if (touchLock) return;
      }
      STATE.pointerClient = { x: e.clientX, y: e.clientY };
      if (STATE.activeRelationMode && STATE.relationFirstFigureId) {
        updateRubberband();
      }

      if (STATE.rotatingFigureId) {
        const fig = getFigureById(STATE.rotatingFigureId);
        if (fig) {
          const svgPt = getSvgPoint(e);
          const angle = getAngleToTarget(fig.x, fig.y, svgPt.x, svgPt.y);
          fig.rotation = Math.round(angle);
          renderFigures();
          updateInspectorValues(fig);
        }
        return;
      }

      if (STATE.draggingFigureId) {
        const fig = getFigureById(STATE.draggingFigureId);
        if (fig) {
          const svgPt = getSvgPoint(e);
          fig.x = Math.round(svgPt.x - STATE.dragOffset.x);
          fig.y = Math.round(svgPt.y - STATE.dragOffset.y);

          fig.x = Math.max(40, Math.min(1560, fig.x));
          fig.y = Math.max(40, Math.min(1160, fig.y));

          renderFigures();
        }
        return;
      }

      if (STATE.isRotatingView && STATE.rotStart) {
        // Horizontal: Drehen, vertikal: Neigen – um die Bildmitte
        const st = STATE.rotStart;
        STATE.autoFit = false;
        STATE.viewYaw = st.yaw - (e.clientX - st.x) * 0.35;
        STATE.viewTilt = clamp(st.tilt - (e.clientY - st.y) * 0.25, 0, 70);
        pinPoint(st.anchor, viewportCenterClient());
        return;
      }

      if (STATE.isPanning && STATE.panAnchor) {
        STATE.autoFit = false;
        const px = STATE.panX;
        const py = STATE.panY;
        pinPoint(STATE.panAnchor, { x: e.clientX, y: e.clientY });   // gegriffener Punkt bleibt unter dem Zeiger
        STATE.panVel = { x: STATE.panX - px, y: STATE.panY - py };
        STATE.panLastTime = performance.now();
      }
    });

    const releasePointer = (e) => {
      if (e.pointerType === 'touch') {
        touchPts.delete(e.pointerId);
        if (gesture && gesture.ids.includes(e.pointerId)) endGesture();
        if (touchPts.size === 0) {
          touchLock = false;
          if (STATE.fastRender) { STATE.fastRender = false; refreshSolidsIfNeeded(); }
        }
        if (touchLock) return;
      }

      // Beziehung durch Ziehen von der ersten zur zweiten Figur
      if (STATE.activeRelationMode && STATE.relationFirstFigureId && STATE.relPress) {
        if (Math.hypot(e.clientX - STATE.relPress.x, e.clientY - STATE.relPress.y) > 14) {
          const pt = getSvgPoint(e);
          const target = findFigureAt(pt.x, pt.y, STATE.relationFirstFigureId);
          if (target) handleRelationClick(target.id);
        }
      }
      STATE.relPress = null;

      if (STATE.draggingFigureId) {
        playWoodClick(1.0);
        STATE.draggingFigureId = null;
        updateInspectorValues(getFigureById(STATE.selectedFigureId));
        runSystemicAnalysis();
        saveToStorage();
      }
      if (STATE.rotatingFigureId) {
        playWoodClick(1.2);
        STATE.rotatingFigureId = null;
        runSystemicAnalysis();
        if (STATE.povFigureId) applyPovCamera(true);
        saveToStorage();
      }
      if (STATE.isPanning && STATE.panVel && performance.now() - STATE.panLastTime < 70
          && Math.hypot(STATE.panVel.x, STATE.panVel.y) > 3) {
        startInertia(STATE.panVel.x, STATE.panVel.y);   // sanftes Nachgleiten
      }
      STATE.isPanning = false;
      STATE.isRotatingView = false;
      STATE.rotStart = null;
      document.body.classList.remove('view-rotating');
      refreshSolidsIfNeeded();   // volle Qualität nach dem Drehen
    };
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);

    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();

      const figTarget = e.target.closest('.system-figure');
      if (figTarget) {
        const figId = figTarget.getAttribute('data-id');
        const fig = getFigureById(figId);
        if (fig) {
          const delta = e.deltaY < 0 ? -15 : 15;
          fig.rotation = normalizeAngle(fig.rotation + delta);
          renderFigures();
          updateInspectorValues(fig);
          return;
        }
      }

      const unit = e.deltaMode === 1 ? 33 : 1;   // Zeilen- statt Pixel-Scrollen (Firefox)
      const dY = (e.deltaY || e.deltaX) * unit;

      // 3D: Shift + Mausrad ändert die Neigung
      if (e.shiftKey && STATE.viewMode === '25d' && !STATE.povFigureId) {
        setViewAngles(STATE.viewYaw, STATE.viewTilt + dY * 0.1);
        return;
      }

      // Pinch-Geste (ctrlKey) bzw. Mausrad: Zoom zum Mauszeiger hin
      const k = e.ctrlKey ? 0.01 : 0.0015;
      zoomAt(Math.exp(clamp(-dY * k, -0.35, 0.35)), e.clientX, e.clientY);
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      // ESC funktioniert immer – auch wenn ein Textfeld den Fokus hat
      if (e.key === 'Escape') {
        if (STATE.activeRelationMode) {
          e.preventDefault();
          cancelRelationMode();
          return;
        }
        if (STATE.povFigureId) {
          e.preventDefault();
          exitPovMode();
          return;
        }
        const modal = document.getElementById('exportModal');
        if (modal && modal.style.display !== 'none') {
          modal.style.display = 'none';
          return;
        }
        if (STATE.selectedFigureId) {
          selectFigure(null);      // schließt den Inspektor (auch im Fokus-Modus)
          return;
        }
        if (STATE.focusMode) {
          e.preventDefault();
          exitFocusMode();
        }
        return;
      }

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.shiftKey && STATE.viewMode === '25d' && !STATE.povFigureId && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const dYaw = e.key === 'ArrowLeft' ? 15 : e.key === 'ArrowRight' ? -15 : 0;
        const dTilt = e.key === 'ArrowUp' ? 8 : e.key === 'ArrowDown' ? -8 : 0;
        tweenViewAngles(STATE.viewYaw + dYaw, STATE.viewTilt + dTilt, 220);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (STATE.selectedFigureId) {
          e.preventDefault();
          deleteSelectedFigure();
        }
      }

      if (e.key === 'r' || e.key === 'R') {
        if (STATE.selectedFigureId) {
          e.preventDefault();
          const fig = getFigureById(STATE.selectedFigureId);
          if (fig) {
            fig.rotation = normalizeAngle(fig.rotation + (e.shiftKey ? -45 : 45));
            renderFigures();
            updateInspectorValues(fig);
            playWoodClick(1.1);
            runSystemicAnalysis();
            saveToStorage();
          }
        }
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFocusMode();
      }
    });

    // Rechtsklick bricht die Beziehungswahl ab
    svgElem.addEventListener('contextmenu', (e) => {
      if (STATE.activeRelationMode) {
        e.preventDefault();
        cancelRelationMode();
      }
    });

    setupDragAndDrop();
  }

  // --------------------------------------------------------------------------
  // ANSICHT: TRANSFORM, BILDSCHIRMFÜLLENDES EINPASSEN, KOORDINATEN-UMRECHNUNG
  // --------------------------------------------------------------------------

  const boardTransformEl = document.getElementById('boardTransform');
  const boardViewportEl = document.getElementById('boardViewport');
  const boardFitProxy = document.getElementById('boardFitProxy');
  const CONTAINER_W = 1600;
  const CONTAINER_H = 1200;
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 4;
  const FIT_FILL = 0.94;       // Anteil des Bildschirms, den das Brett füllt
  let animTimer = null;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function buildTransformString() {
    const is3d = STATE.viewMode === '25d';
    const tilt = is3d ? STATE.viewTilt : 0;
    const rotZ = (is3d ? STATE.viewYaw : 0) + STATE.viewRotation;
    // Immer dieselbe Funktionsliste -> weiche Übergänge zwischen 2D, 3D und Perspektivenwechsel
    return `translate(calc(-50% + ${STATE.panX}px), calc(-50% + ${STATE.panY}px)) scale3d(${STATE.zoom}, ${STATE.zoom}, 1) rotateX(${tilt}deg) rotateZ(${rotZ}deg)`;
  }

  function updateZoomLabel() {
    const label = document.getElementById('zoomLevel');
    if (label) label.textContent = `${Math.round(STATE.zoom * 100)}%`;
  }

  function updateTransform() {
    if (!boardTransformEl) return;
    boardTransformEl.style.transform = buildTransformString();
    updateZoomLabel();
    updateCompass();
    refreshSolidsIfNeeded();
    if (STATE.activeRelationMode && STATE.relationFirstFigureId) updateRubberband();
  }

  // Aktueller Brettbereich im SVG-Koordinatensystem (inkl. Spalt)
  function getBoardBounds() {
    const { cx, cy, width, height, radius, halfWidth } = BOARD_GEO;
    const gap = STATE.splitDistance || 0;
    if (STATE.boardType === 'round') {
      return { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 };
    }
    if (STATE.boardType === 'single') {
      return { x: cx - width / 2, y: cy - height / 2, w: width, h: height };
    }
    if (STATE.boardType === 'split') {
      return { x: cx - gap / 2 - halfWidth, y: cy - height / 2, w: halfWidth * 2 + gap, h: height };
    }
    return { x: cx - width / 2 - gap / 2, y: cy - height / 2, w: width + gap, h: height };
  }

  function syncFitProxy() {
    const b = getBoardBounds();
    const pad = 10;
    boardFitProxy.style.left = (b.x - pad) + 'px';
    boardFitProxy.style.top = (b.y - pad) + 'px';
    boardFitProxy.style.width = (b.w + pad * 2) + 'px';
    boardFitProxy.style.height = (b.h + pad * 2) + 'px';
  }

  // Passt das Brett so ein, dass es in jeder Ansicht (2D / 3D) den Bildschirm füllt und zentriert ist.
  // Gemessen wird die tatsächlich projizierte Fläche, daher funktioniert es auch mit Perspektive.
  function fitToView(animate) {
    stopViewMotion();
    const vr = boardViewportEl.getBoundingClientRect();
    if (vr.width < 60 || vr.height < 60) return;

    const el = boardTransformEl;
    const oldTransform = el.style.transform || buildTransformString();
    el.classList.remove('animating');
    el.style.transition = 'none';

    STATE.viewRotation = 0;
    syncFitProxy();
    STATE.zoom = 1;
    STATE.panX = 0;
    STATE.panY = 0;

    for (let i = 0; i < 5; i++) {
      el.style.transform = buildTransformString();
      let r = boardFitProxy.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) break;
      const f = Math.min((vr.width * FIT_FILL) / r.width, (vr.height * FIT_FILL) / r.height);
      STATE.zoom = clamp(STATE.zoom * f, MIN_ZOOM, MAX_ZOOM);

      el.style.transform = buildTransformString();
      r = boardFitProxy.getBoundingClientRect();
      STATE.panX += (vr.left + vr.width / 2) - (r.left + r.width / 2);
      STATE.panY += (vr.top + vr.height / 2) - (r.top + r.height / 2);
    }

    const finalTransform = buildTransformString();
    el.style.transform = finalTransform;
    STATE.autoFit = true;
    updateZoomLabel();
    refreshSolidsIfNeeded();

    if (animate) {
      el.style.transform = oldTransform;
      void el.offsetWidth;
      el.style.transition = '';
      el.classList.add('animating');
      el.style.transform = finalTransform;
      clearTimeout(animTimer);
      animTimer = setTimeout(() => el.classList.remove('animating'), 620);
    } else {
      void el.offsetWidth;
      el.style.transition = '';
    }
    if (STATE.activeRelationMode && STATE.relationFirstFigureId) updateRubberband();
  }

  function resetZoomAndPan() {
    if (STATE.povFigureId) {
      applyPovCamera(true, true);
    } else {
      fitToView(true);
    }
  }

  function setViewMode(mode, opts) {
    opts = opts || {};
    if (STATE.povFigureId && !opts.fromPov) exitPovMode({ keepView: true });
    STATE.viewMode = mode;
    document.body.classList.toggle('view-25d', mode === '25d');
    refreshSolidsIfNeeded();
    document.getElementById('btnView2D')?.classList.toggle('active', mode === '2d');
    document.getElementById('btnView25D')?.classList.toggle('active', mode === '25d');
    if (!opts.skipFit) fitToView(true);
    if (!opts.silent) playWoodClick(1.0);
    debounceSaveToStorage();
  }

  // --- Projektion: Bildschirm <-> Brett-Koordinaten (inkl. 3D-Perspektive und Drehung) ---
  function solveHomography(src, dst) {
    // Löst H (3x3, h33 = 1) mit dst ~ H * src für 4 Punktpaare
    const A = [];
    const b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i];
      const [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
      b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
      b.push(v);
    }
    const n = 8;
    for (let i = 0; i < n; i++) {
      let piv = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
      [A[i], A[piv]] = [A[piv], A[i]];
      [b[i], b[piv]] = [b[piv], b[i]];
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const h = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i];
      for (let c = i + 1; c < n; c++) sum -= A[i][c] * h[c];
      h[i] = sum / A[i][i];
    }
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }

  function invert3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [
      A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
      B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
      C / det, -(a * h - b * g) / det, (a * e - b * d) / det
    ];
  }

  // Projektion zwischen Brett-Koordinaten und Bildschirm (berücksichtigt Neigung, Drehung und Perspektive)
  function getProjection(matrix) {
    const cs = getComputedStyle(boardTransformEl);
    const m = matrix || new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform);
    const vr = boardViewportEl.getBoundingClientRect();
    const persp = parseFloat(getComputedStyle(boardViewportEl).perspective) || 1e9;
    const ox = CONTAINER_W / 2;
    const oy = CONTAINER_H / 2;

    // Punkt auf dem Brett (lz = Höhe über dem Brett) -> Bildschirm
    const forward3 = (lx, ly, lz) => {
      const x = lx - ox;
      const y = ly - oy;
      const X = m.m11 * x + m.m21 * y + m.m31 * lz + m.m41;
      const Y = m.m12 * x + m.m22 * y + m.m32 * lz + m.m42;
      const Z = m.m13 * x + m.m23 * y + m.m33 * lz + m.m43;
      const k = persp / (persp - Z);
      return { x: vr.left + vr.width / 2 + (ox + X) * k, y: vr.top + vr.height / 2 + (oy + Y) * k, k: k };
    };
    const forward = (lx, ly) => forward3(lx, ly, 0);

    const src = [[0, 0], [CONTAINER_W, 0], [CONTAINER_W, CONTAINER_H], [0, CONTAINER_H]];
    const dst = src.map(pt => { const c = forward(pt[0], pt[1]); return [c.x, c.y]; });
    const inv = invert3(solveHomography(src, dst));

    const inverse = (cx, cy) => {
      const w = inv[6] * cx + inv[7] * cy + inv[8];
      return { x: (inv[0] * cx + inv[1] * cy + inv[2]) / w, y: (inv[3] * cx + inv[4] * cy + inv[5]) / w };
    };
    return { forward, forward3, inverse };
  }

  // Projektion für den Zielzustand der Ansicht (unabhängig von laufenden CSS-Übergängen)
  function getTargetProjection() {
    const is3d = STATE.viewMode === '25d';
    const tilt = is3d ? STATE.viewTilt : 0;
    const rotZ = (is3d ? STATE.viewYaw : 0) + STATE.viewRotation;
    const m = new DOMMatrix()
      .translateSelf(STATE.panX - CONTAINER_W / 2, STATE.panY - CONTAINER_H / 2)
      .scaleSelf(STATE.zoom, STATE.zoom, 1)
      .rotateAxisAngleSelf(1, 0, 0, tilt)
      .rotateAxisAngleSelf(0, 0, 1, rotZ);
    return getProjection(m);
  }

  function clientToBoard(clientX, clientY) {
    return getProjection().inverse(clientX, clientY);
  }

  function boardToClient(x, y) {
    return getProjection().forward(x, y);
  }

  // --------------------------------------------------------------------------
  // KARTEN-NAVIGATION (wie bei Google Maps)
  //  - Ziehen: Brett greifen und verschieben (der Punkt unter dem Zeiger bleibt darunter)
  //  - Mausrad / Pinch: Zoom zum Mauszeiger hin
  //  - Rechte Maustaste oder Strg/Shift + Ziehen (3D): Drehen und Neigen um die Bildmitte
  // --------------------------------------------------------------------------
  let inertiaRaf = null;
  let zoomAnim = null;
  let zoomRaf = null;
  let tweenRaf = null;

  function viewportCenterClient() {
    const r = boardViewportEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Wendet den aktuellen Zustand an und verschiebt die Ansicht so,
  // dass der Brettpunkt `anchor` an der Bildschirmposition `target` erscheint.
  function pinPoint(anchor, target) {
    boardTransformEl.style.transform = buildTransformString();
    const c = boardToClient(anchor.x, anchor.y);
    STATE.panX += target.x - c.x;
    STATE.panY += target.y - c.y;
    updateTransform();
  }

  function stopViewMotion() {
    if (inertiaRaf) { cancelAnimationFrame(inertiaRaf); inertiaRaf = null; }
    if (zoomRaf) { cancelAnimationFrame(zoomRaf); zoomRaf = null; }
    if (tweenRaf) { cancelAnimationFrame(tweenRaf); tweenRaf = null; }
    zoomAnim = null;
  }

  function startInertia(vx, vy) {
    let v = { x: vx, y: vy };
    const step = () => {
      v.x *= 0.92;
      v.y *= 0.92;
      if (Math.hypot(v.x, v.y) < 0.4) { inertiaRaf = null; return; }
      STATE.panX += v.x;
      STATE.panY += v.y;
      updateTransform();
      inertiaRaf = requestAnimationFrame(step);
    };
    inertiaRaf = requestAnimationFrame(step);
  }

  // Sanfter Zoom, der den Punkt unter dem Zeiger festhält
  function zoomAt(factor, clientX, clientY) {
    STATE.autoFit = false;
    if (inertiaRaf) { cancelAnimationFrame(inertiaRaf); inertiaRaf = null; }
    const base = zoomAnim ? zoomAnim.target : STATE.zoom;
    zoomAnim = { target: clamp(base * factor, MIN_ZOOM, MAX_ZOOM), cx: clientX, cy: clientY };
    if (!zoomRaf) zoomRaf = requestAnimationFrame(stepZoom);
  }

  function stepZoom() {
    zoomRaf = null;
    if (!zoomAnim) return;
    const a = zoomAnim;
    const anchor = clientToBoard(a.cx, a.cy);
    const diff = a.target - STATE.zoom;
    STATE.zoom = Math.abs(diff) < a.target * 0.002 ? a.target : STATE.zoom + diff * 0.32;
    pinPoint(anchor, { x: a.cx, y: a.cy });
    if (STATE.zoom === a.target) zoomAnim = null;
    else zoomRaf = requestAnimationFrame(stepZoom);
  }

  // Drehen und Neigen um die Bildmitte (Brettpunkt in der Bildmitte bleibt dort)
  function setViewAngles(yaw, tilt) {
    STATE.autoFit = false;
    const c = viewportCenterClient();
    const anchor = clientToBoard(c.x, c.y);
    STATE.viewYaw = yaw;
    STATE.viewTilt = clamp(tilt, 0, 70);
    pinPoint(anchor, c);
  }

  function tweenViewAngles(targetYaw, targetTilt, ms) {
    if (tweenRaf) cancelAnimationFrame(tweenRaf);
    const y0 = STATE.viewYaw;
    const t0 = STATE.viewTilt;
    const t1 = clamp(targetTilt, 0, 70);
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setViewAngles(y0 + (targetYaw - y0) * e, t0 + (t1 - t0) * e);
      tweenRaf = k < 1 ? requestAnimationFrame(step) : null;
    };
    tweenRaf = requestAnimationFrame(step);
  }

  // Zurück zur Ausgangsansicht (Kompass-Klick)
  function resetViewOrientation() {
    stopViewMotion();
    STATE.viewYaw = ((((STATE.viewYaw % 360) + 540) % 360) - 180);   // kürzester Weg, ohne sichtbaren Sprung
    updateTransform();
    STATE.viewYaw = -16;
    STATE.viewTilt = 46;
    fitToView(true);
  }

  function updateCompass() {
    const needle = document.getElementById('compassNeedle');
    if (needle) needle.style.transform = `rotate(${STATE.viewYaw}deg)`;
  }


  // ==========================================================================
  // 9. BRETT TRENNEN / ZUSAMMENFÜGEN (1-BRETT DEFAULT LOGIK)
  // ==========================================================================

  function toggleBoardSplit() {
    initAudio();
    const isCurrentlySplit = STATE.splitDistance > 0;
    const targetGap = isCurrentlySplit ? 0 : 54;
    animateSplitDistance(targetGap);
  }

  function setBoardUnified() {
    if (STATE.splitDistance !== 0) {
      animateSplitDistance(0);
    }
  }

  function setBoardSplit() {
    if (STATE.splitDistance === 0) {
      animateSplitDistance(54);
    }
  }

  function animateSplitDistance(targetGap) {
    const startGap = STATE.splitDistance;
    const startTime = performance.now();
    const duration = 280;

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      STATE.splitDistance = Math.round(startGap + (targetGap - startGap) * ease);

      renderBoard();
      updateSplitUI();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        STATE.splitDistance = targetGap;
        renderBoard();
        updateSplitUI();
        playWoodClick(targetGap === 0 ? 0.9 : 1.15);
        if (STATE.autoFit && !STATE.povFigureId) fitToView(true);
        saveToStorage();
      }
    }

    requestAnimationFrame(step);
  }

  function updateSplitUI() {
    const isSplit = STATE.splitDistance > 0;
    const btn = document.getElementById('btnToggleSplit');
    const icon = document.getElementById('splitIcon');
    const text = document.getElementById('splitText');
    const valText = document.getElementById('splitDistanceVal');
    const slider = document.getElementById('splitDistanceSlider');
    const btnUnified = document.getElementById('btnSetUnified');
    const btnSplit = document.getElementById('btnSetSplit');

    if (btn && icon && text) {
      if (isSplit) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
        icon.textContent = '✂️';
        text.textContent = `Getrennt (${STATE.splitDistance} mm)`;
      } else {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-outline');
        icon.textContent = '🔗';
        text.textContent = '1 Brett (Vereint)';
      }
    }

    if (valText) {
      valText.textContent = isSplit ? `${STATE.splitDistance} mm` : '0 mm (Vereint)';
    }
    if (slider) {
      slider.value = STATE.splitDistance;
    }
    if (btnUnified && btnSplit) {
      btnUnified.classList.toggle('active', !isSplit);
      btnSplit.classList.toggle('active', isSplit);
    }
  }

  // ==========================================================================
  // 10. FIGUREN-MANAGEMENT
  // ==========================================================================

  function addFigure(config = {}, opts) {
    const phase = getCurrentPhase();
    if (!phase) return;

    const scatterX = (Math.random() - 0.5) * 160;
    const scatterY = (Math.random() - 0.5) * 140;

    const newFig = {
      id: 'fig_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: config.name || 'Figur ' + (phase.figures.length + 1),
      shape: config.shape || 'kegel',
      size: config.size || 'gross',
      color: config.color || 'wood-light',
      rotation: config.rotation !== undefined ? config.rotation : 0,
      scale: config.scale || 5,
      notes: config.notes || '',
      x: config.x !== undefined ? config.x : (BOARD_GEO.cx + scatterX),
      y: config.y !== undefined ? config.y : (BOARD_GEO.cy + scatterY)
    };

    phase.figures.push(newFig);
    if (!opts || opts.select !== false) selectFigure(newFig.id);
    renderFigures();
    playWoodClick(0.9);
    runSystemicAnalysis();
    saveToStorage();
    return newFig;
  }

  // Inspektor liegt über dem linken Menü, solange eine Figur ausgewählt ist
  let lastInspectorFigId = null;

  // ---- Responsives Layout (Breakpoints wie die einbindende Seite: 900 px und 600 px) ----
  const compactMQ = window.matchMedia('(max-width: 900px)');
  const phoneMQ = window.matchMedia('(max-width: 600px)');
  const isCompact = () => compactMQ.matches;

  function updateDrawerState() {
    const l = document.getElementById('sidebarLeft'), r = document.getElementById('sidebarRight');
    const open = (l && !l.classList.contains('collapsed') && !l.classList.contains('inspector-open')) ||
                 (r && !r.classList.contains('collapsed'));
    document.body.classList.toggle('drawer-open', !!open);
  }

  function applyResponsiveLayout() {
    document.body.classList.toggle('layout-compact', compactMQ.matches);
    document.body.classList.toggle('layout-phone', phoneMQ.matches);
    if (compactMQ.matches) {
      if (!STATE.compactApplied) {
        // Schubladen starten geschlossen, damit das Brett den ganzen Bildschirm nutzt
        const l = document.getElementById('sidebarLeft');
        STATE.leftWasOpen = l ? !l.classList.contains('collapsed') : true;
        STATE.compactApplied = true;
        setSidebarCollapsed('left', true);
        setSidebarCollapsed('right', true);
      }
    } else if (STATE.compactApplied) {
      STATE.compactApplied = false;
      setSidebarCollapsed('left', STATE.leftWasOpen === false);
    }
    updateDrawerState();
  }

  // Ausgewählte Figur sichtbar halten, wenn der Inspektor (Seitenfeld oder untere Schublade) sie verdeckt
  function revealSelectedFigure() {
    if (!isCompact() || STATE.povFigureId) return;
    requestAnimationFrame(() => {
      const fig = getFigureById(STATE.selectedFigureId);
      const left = document.getElementById('sidebarLeft');
      if (!fig || !left || !left.classList.contains('inspector-open')) return;
      const vr = boardViewportEl.getBoundingClientRect();
      const lr = left.getBoundingClientRect();
      const vis = { l: vr.left, r: vr.right, t: vr.top, b: vr.bottom };
      if (phoneMQ.matches) vis.b = Math.min(vis.b, lr.top);
      else vis.l = Math.max(vis.l, lr.right);
      const c = boardToClient(fig.x, fig.y);
      let dx = 0, dy = 0;
      if (c.x < vis.l + 60) dx = vis.l + 60 - c.x;
      else if (c.x > vis.r - 60) dx = vis.r - 60 - c.x;
      if (c.y < vis.t + 110) dy = vis.t + 110 - c.y;
      else if (c.y > vis.b - 50) dy = vis.b - 50 - c.y;
      if (dx || dy) {
        STATE.autoFit = false;
        boardTransformEl.classList.add('animating');
        STATE.panX += dx;
        STATE.panY += dy;
        updateTransform();
        clearTimeout(animTimer);
        animTimer = setTimeout(() => boardTransformEl.classList.remove('animating'), 620);
      }
    });
  }

  function syncInspectorOverlay() {
    const left = document.getElementById('sidebarLeft');
    if (!left) return;
    const has = !!getFigureById(STATE.selectedFigureId);
    left.classList.toggle('inspector-open', has);
    // Ist das Menü eingeklappt, wird es für den Inspektor automatisch geöffnet
    if (has && !STATE.focusMode && !isCompact() && lastInspectorFigId !== STATE.selectedFigureId && left.classList.contains('collapsed')) {
      setSidebarCollapsed('left', false);
    }
    if (has && lastInspectorFigId !== STATE.selectedFigureId) revealSelectedFigure();
    lastInspectorFigId = has ? STATE.selectedFigureId : null;
    updateDrawerState();
  }

  // Akkordeon-Eintrag der linken Leiste öffnen oder schließen
  function setAccordion(bodyId, open) {
    const body = document.getElementById(bodyId);
    const header = document.querySelector(`.acc-header[data-acc="${bodyId}"]`);
    if (body) body.classList.toggle('open', open);
    if (header) {
      header.classList.toggle('open', open);
      header.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  function setSidebarCollapsed(side, collapsed) {
    const el = document.getElementById(side === 'left' ? 'sidebarLeft' : 'sidebarRight');
    if (!el) return;
    el.classList.toggle('collapsed', collapsed);
    updateDrawerState();
    // Brett an den neuen Platz anpassen (bei automatischer Einpassung)
    requestAnimationFrame(() => {
      if (STATE.povFigureId) applyPovCamera(false);
      else if (STATE.autoFit) fitToView(false);
    });
  }

  function selectFigure(figId) {
    STATE.selectedFigureId = figId;
    const fig = getFigureById(figId);

    const emptyState = document.getElementById('inspectorEmptyState');
    const activeContent = document.getElementById('inspectorActiveContent');

    if (!fig) {
      if (emptyState) emptyState.style.display = 'block';
      if (activeContent) activeContent.style.display = 'none';
      renderFigures();
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (activeContent) activeContent.style.display = 'block';

    updateInspectorValues(fig);
    renderFigures();
  }

  function deleteSelectedFigure() {
    if (!STATE.selectedFigureId) return;
    const phase = getCurrentPhase();
    if (!phase) return;

    const figId = STATE.selectedFigureId;
    phase.figures = phase.figures.filter(f => f.id !== figId);
    phase.relations = phase.relations.filter(r => r.fromId !== figId && r.toId !== figId);

    if (STATE.povFigureId === figId) exitPovMode();

    selectFigure(null);
    playWoodClick(0.7);
    runSystemicAnalysis();
    saveToStorage();
  }

  function duplicateSelectedFigure() {
    const fig = getFigureById(STATE.selectedFigureId);
    if (!fig) return;

    addFigure({
      name: fig.name + ' (Kopie)',
      shape: fig.shape,
      size: fig.size,
      color: fig.color,
      rotation: fig.rotation,
      scale: fig.scale,
      notes: fig.notes,
      x: fig.x + 40,
      y: fig.y + 40
    });
  }

  // ==========================================================================
  // 11. INSPEKTOR UI-BINDINGS
  // ==========================================================================

  function updateInspectorValues(fig) {
    if (!fig) return;

    const nameInput = document.getElementById('inspNameInput');
    if (nameInput) nameInput.value = fig.name;

    const sub = document.getElementById('inspTypeSubtitle');
    if (sub) {
      const onBoard = isPointOnBoard(fig.x, fig.y);
      sub.textContent = `${fig.shape.toUpperCase()} • ${fig.size.toUpperCase()} • ${onBoard ? 'AUF DEM BRETT' : 'AUSSENRAUM'}`;
    }

    const rotBadge = document.getElementById('inspRotationAngle');
    if (rotBadge) rotBadge.textContent = `${fig.rotation}°`;

    const needle = document.querySelector('.dial-needle');
    if (needle) needle.style.transform = `translate(-50%, -100%) rotate(${fig.rotation}deg)`;

    const scaleSlider = document.getElementById('inspScaleSlider');
    const scaleBadge = document.getElementById('inspScaleValue');
    if (scaleSlider) scaleSlider.value = fig.scale || 5;
    if (scaleBadge) scaleBadge.textContent = `${fig.scale || 5} / 10`;

    const notesInput = document.getElementById('inspNotesInput');
    if (notesInput) notesInput.value = fig.notes || '';

    document.querySelectorAll('.insp-shape-select button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-shape') === fig.shape);
    });

    document.querySelectorAll('.insp-size-select button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-size') === fig.size);
    });

    const preview = document.getElementById('inspPreview');
    if (preview) {
      preview.style.background = fig.color === 'wood-light' ? '#eedbc0' : (fig.color === 'wood-dark' ? '#5c3a21' : fig.color);
    }

    updateTargetLookSelect(fig);
    updatePovSummary(fig);
  }

  function updateTargetLookSelect(currentFig) {
    const select = document.getElementById('inspTargetLookSelect');
    if (!select) return;
    const phase = getCurrentPhase();
    if (!phase) return;

    select.innerHTML = '<option value="">-- Andere Figur wählen --</option>';
    phase.figures.forEach(other => {
      if (other.id !== currentFig.id) {
        const opt = document.createElement('option');
        opt.value = other.id;
        opt.textContent = other.name;
        select.appendChild(opt);
      }
    });
  }

  function updatePovSummary(observer) {
    const visibleElem = document.getElementById('povVisibleList');
    const backElem = document.getElementById('povBackList');
    if (!visibleElem || !backElem) return;

    const phase = getCurrentPhase();
    if (!phase) return;

    const visibleNames = [];
    const backNames = [];

    phase.figures.forEach(other => {
      if (other.id === observer.id) return;
      if (isTargetInView(observer, other)) {
        visibleNames.push(other.name);
      } else if (isTargetBehind(observer, other)) {
        backNames.push(other.name);
      }
    });

    visibleElem.textContent = visibleNames.length > 0 ? visibleNames.join(', ') : 'Keine Figur im Sichtkegel';
    backElem.textContent = backNames.length > 0 ? backNames.join(', ') : 'Rücken ist frei';
  }

  // ==========================================================================
  // 12. PERSPEKTIVENWECHSEL & BEZIEHUNGEN
  // ==========================================================================

  // ---- Perspektivenwechsel -------------------------------------------------

  const SYMBOL_EMOJI = {
    stern: '⭐', herz: '❤️', diamant: '💎', stein: '🪨', wolke: '⚡',
    kiste: '📦', anker: '⚓', fragezeichen: '❓', barriere: '🚧', licht: '💡'
  };

  function figureDisplayColor(fig) {
    if (fig.color === 'wood-light' || fig.color === 'buche-hell') return '#eedbc0';
    if (fig.color === 'wood-dark') return '#5c3a21';
    return fig.color || '#eedbc0';
  }

  // Dreht und zentriert die Ansicht so, dass die Figur nach oben schaut und im unteren Drittel steht.
  function applyPovCamera(animate, resetZoom) {
    const fig = getFigureById(STATE.povFigureId);
    if (!fig) return;
    const vr = boardViewportEl.getBoundingClientRect();
    const el = boardTransformEl;

    // fortlaufende Drehung: immer auf kürzestem Weg
    let target = -fig.rotation;
    target += 360 * Math.round((STATE.viewRotation - target) / 360);
    STATE.viewRotation = target;
    STATE.povCamRot = fig.rotation;
    STATE.autoFit = false;

    if (resetZoom) {
      STATE.zoom = clamp(Math.min(vr.width / 1000, vr.height / 760), 0.55, 1.5);
    }

    const th = degToRad(STATE.viewRotation);
    const dx = fig.x - BOARD_GEO.cx;
    const dy = fig.y - BOARD_GEO.cy;
    const rx = dx * Math.cos(th) - dy * Math.sin(th);
    const ry = dx * Math.sin(th) + dy * Math.cos(th);
    STATE.panX = -rx * STATE.zoom;
    STATE.panY = vr.height * 0.17 - ry * STATE.zoom;

    if (animate) {
      el.classList.add('animating');
      clearTimeout(animTimer);
      animTimer = setTimeout(() => el.classList.remove('animating'), 620);
    }
    updateTransform();
  }

  function renderPovZones(obs, figures) {
    const sector = (centerDeg, halfDeg, len, fill, stroke, dash) => {
      const a1 = degToRad(centerDeg - halfDeg);
      const a2 = degToRad(centerDeg + halfDeg);
      const path = svgEl('path', {
        d: `M 0,0 L ${Math.cos(a1) * len},${Math.sin(a1) * len} A ${len},${len} 0 0,1 ${Math.cos(a2) * len},${Math.sin(a2) * len} Z`,
        fill: fill, stroke: stroke, 'stroke-width': 1.5,
        class: 'vision-cone highlighted',
        transform: `translate(${obs.x}, ${obs.y}) rotate(${obs.rotation})`,
        'pointer-events': 'none'
      });
      if (dash) path.setAttribute('stroke-dasharray', dash);
      sightConesGroup.appendChild(path);
    };

    sector(-90, 35, 560, 'rgba(59, 130, 246, 0.34)', 'rgba(96, 165, 250, 0.95)');   // Blickfeld
    sector(90, 45, 230, 'rgba(239, 68, 68, 0.24)', 'rgba(248, 113, 113, 0.8)', '6 5'); // Rücken

    figures.forEach(f => {
      if (f.id !== obs.id && isTargetInView(obs, f)) {
        sightLinesGroup.appendChild(svgEl('line', {
          x1: obs.x, y1: obs.y, x2: f.x, y2: f.y,
          stroke: 'rgba(250, 204, 21, 0.9)', 'stroke-width': 2, 'stroke-dasharray': '3 5',
          'pointer-events': 'none'
        }));
      }
    });
  }

  // Ich-Perspektive: Panorama dessen, was die Figur sieht (±90° vor ihr)
  function renderEgoView() {
    const box = document.getElementById('egoView');
    const svg = document.getElementById('egoSvg');
    if (!box || !svg) return;
    const obs = STATE.povFigureId ? getFigureById(STATE.povFigureId) : null;
    if (!obs) { box.style.display = 'none'; return; }
    box.style.display = 'block';

    const nameEl = document.getElementById('egoName');
    if (nameEl) nameEl.textContent = obs.name;

    const phase = getCurrentPhase();
    const HOR = 84, HALF = 90, CX = 320, SPAN = 300;
    const coneX = (35 / HALF) * SPAN;

    svg.innerHTML = `
      <defs>
        <linearGradient id="egoSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#3b4a63"/></linearGradient>
        <linearGradient id="egoFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c7a67a"/><stop offset="1" stop-color="#ead6b6"/></linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="${HOR}" fill="url(#egoSky)"/>
      <rect x="0" y="${HOR}" width="640" height="${150 - HOR}" fill="url(#egoFloor)"/>
      <line x1="0" y1="${HOR}" x2="640" y2="${HOR}" stroke="rgba(0,0,0,0.35)"/>
      <line x1="${CX - coneX}" y1="0" x2="${CX - coneX}" y2="150" stroke="rgba(255,255,255,0.45)" stroke-dasharray="4 4"/>
      <line x1="${CX + coneX}" y1="0" x2="${CX + coneX}" y2="150" stroke="rgba(255,255,255,0.45)" stroke-dasharray="4 4"/>
      <text x="${CX}" y="11" fill="rgba(255,255,255,0.6)" font-size="9" text-anchor="middle">Blickfeld 70°</text>
      <text x="8" y="11" fill="rgba(255,255,255,0.45)" font-size="9">← links</text>
      <text x="632" y="11" fill="rgba(255,255,255,0.45)" font-size="9" text-anchor="end">rechts →</text>`;

    const visible = [];
    const peripheral = [];
    const back = [];
    const items = [];

    phase.figures.forEach(f => {
      if (f.id === obs.id) return;
      const dist = Math.max(getDistance(obs.x, obs.y, f.x, f.y), 50);
      const ang = getAngleToTarget(obs.x, obs.y, f.x, f.y);
      const rel = ((ang - obs.rotation + 540) % 360) - 180;   // -180..180, positiv = rechts
      const inCone = isTargetInView(obs, f);
      if (inCone) visible.push(f.name);
      else if (isTargetBehind(obs, f)) back.push(f.name);
      else peripheral.push(f.name);
      if (Math.abs(rel) <= HALF) items.push({ f, dist, rel, inCone });
    });

    items.sort((a, b) => b.dist - a.dist);   // Ferne zuerst zeichnen

    items.forEach(({ f, dist, rel, inCone }) => {
      const x = CX + (rel / HALF) * SPAN;
      const sf = (SIZE_MAP[f.size] || 27) / 27;
      const figH = clamp((11000 / dist) * sf, 16, 82);
      const baseY = HOR + clamp(3600 / dist, 4, 56);
      const fill = figureDisplayColor(f);
      const dark = ['#1a1a1a', '#111111', '#5c3a21', '#2c3e50'].includes(fill);
      const g = svgEl('g', { opacity: inCone ? 1 : 0.55 });

      if (SYMBOL_EMOJI[f.shape]) {
        const t = svgEl('text', { x: x, y: baseY - figH * 0.1, 'font-size': figH * 0.75, 'text-anchor': 'middle' });
        t.textContent = SYMBOL_EMOJI[f.shape];
        g.appendChild(t);
      } else if (f.shape === 'block') {
        g.appendChild(svgEl('rect', {
          x: x - figH * 0.22, y: baseY - figH * 0.6, width: figH * 0.44, height: figH * 0.6,
          rx: 2, fill: fill, stroke: 'rgba(0,0,0,0.45)', 'stroke-width': 1
        }));
      } else {
        const bw = figH * 0.5;
        const topY = baseY - figH * 0.62;
        const hr = figH * 0.17;
        const bodyD = (f.shape === 'kegel' || f.shape === 'pegdoll' || f.shape === 'prisma')
          ? `M ${x - bw / 2},${baseY} L ${x + bw / 2},${baseY} L ${x + bw * 0.26},${topY} L ${x - bw * 0.26},${topY} Z`
          : `M ${x - bw * 0.36},${baseY} L ${x + bw * 0.36},${baseY} L ${x + bw * 0.36},${topY} L ${x - bw * 0.36},${topY} Z`;
        g.appendChild(svgEl('path', { d: bodyD, fill: fill, stroke: 'rgba(0,0,0,0.45)', 'stroke-width': 1 }));
        g.appendChild(svgEl('circle', { cx: x, cy: topY - hr * 0.85, r: hr, fill: fill, stroke: 'rgba(0,0,0,0.45)', 'stroke-width': 1 }));
        // Augen nur, wenn die andere Figur zum Beobachter schaut
        if (isTargetInView(f, obs, 160)) {
          const ey = topY - hr * 0.85;
          const ec = dark ? '#ffffff' : '#1a1a1a';
          g.appendChild(svgEl('circle', { cx: x - hr * 0.38, cy: ey, r: Math.max(1.1, hr * 0.16), fill: ec }));
          g.appendChild(svgEl('circle', { cx: x + hr * 0.38, cy: ey, r: Math.max(1.1, hr * 0.16), fill: ec }));
        }
      }

      const label = svgEl('text', { x: x, y: Math.min(baseY + 12, 147), class: 'ego-label' });
      label.textContent = (f.name || '').length > 16 ? f.name.slice(0, 15) + '…' : f.name;
      g.appendChild(label);
      svg.appendChild(g);
    });

    // Zentrale Blickmarke
    svg.appendChild(svgEl('line', { x1: CX, y1: HOR - 6, x2: CX, y2: HOR + 6, stroke: 'rgba(255,255,255,0.7)' }));

    const sum = document.getElementById('egoSummary');
    if (sum) {
      const fmt = arr => (arr.length ? arr.join(', ') : '–');
      sum.textContent = `Im Blick: ${fmt(visible)}  ·  Peripher: ${fmt(peripheral)}  ·  Im Rücken: ${fmt(back)}`;
    }
  }

  function activatePovMode(figId) {
    const fig = getFigureById(figId);
    if (!fig) return;

    if (!STATE.povFigureId) {
      STATE.povPrevView = STATE.viewMode;
    }
    // Die Ich-Sicht arbeitet in der Draufsicht
    if (STATE.viewMode !== '2d') {
      setViewMode('2d', { fromPov: true, skipFit: true, silent: true });
    }

    const firstActivation = !STATE.povFigureId;
    STATE.povFigureId = figId;

    const banner = document.getElementById('povBanner');
    const text = document.getElementById('povText');
    if (banner && text) {
      text.innerHTML = `Blick aus den Augen von: <strong>${escapeHtml(fig.name)}</strong>`;
      banner.style.display = 'flex';
    }

    applyPovCamera(true, firstActivation);
    renderFigures();
    playWoodClick(1.3);
  }

  function exitPovMode(opts) {
    opts = opts || {};
    const wasActive = !!STATE.povFigureId;
    STATE.povFigureId = null;
    STATE.povCamRot = null;

    const banner = document.getElementById('povBanner');
    if (banner) banner.style.display = 'none';
    const ego = document.getElementById('egoView');
    if (ego) ego.style.display = 'none';

    if (wasActive && !opts.keepView) {
      // Drehung ohne sichtbaren Sprung normalisieren, dann animiert zurück zur Gesamtansicht
      const el = boardTransformEl;
      el.classList.remove('animating');
      el.style.transition = 'none';
      STATE.viewRotation = ((((STATE.viewRotation % 360) + 540) % 360) - 180);
      updateTransform();
      void el.offsetWidth;
      el.style.transition = '';

      const prev = STATE.povPrevView;
      STATE.povPrevView = null;
      if (prev === '25d') setViewMode('25d', { silent: true });
      else fitToView(true);
    } else if (wasActive) {
      STATE.povPrevView = null;
      STATE.viewRotation = 0;
    }

    // Beschriftungen mit der endgültigen Ansichtsdrehung neu zeichnen
    renderFigures();
  }

  // ---- Beziehungen: Linie folgt dem Mauszeiger ------------------------------

  const rubberbandGroup = document.getElementById('rubberbandGroup');

  function findFigureAt(x, y, excludeId) {
    const phase = getCurrentPhase();
    if (!phase) return null;
    let best = null;
    let bestDist = Infinity;
    phase.figures.forEach(f => {
      if (f.id === excludeId) return;
      const r = (SIZE_MAP[f.size] || 27) + 10;
      const d = getDistance(x, y, f.x, f.y);
      if (d <= r && d < bestDist) {
        best = f;
        bestDist = d;
      }
    });
    return best;
  }

  function updateRubberband() {
    if (!rubberbandGroup) return;
    rubberbandGroup.innerHTML = '';
    document.querySelectorAll('.system-figure.relation-source, .system-figure.relation-target-candidate')
      .forEach(el => el.classList.remove('relation-source', 'relation-target-candidate'));

    if (!STATE.activeRelationMode || !STATE.relationFirstFigureId) {
      STATE.relationHoverId = null;
      return;
    }
    const first = getFigureById(STATE.relationFirstFigureId);
    if (!first) return;

    let tx = first.x;
    let ty = first.y;
    let hover = null;
    const pc = STATE.pointerClient;
    if (pc) {
      const pt = clientToBoard(pc.x, pc.y);
      tx = pt.x;
      ty = pt.y;
      hover = findFigureAt(pt.x, pt.y, first.id);
      if (hover) {            // rastet auf der Zielfigur ein
        tx = hover.x;
        ty = hover.y;
      }
    }
    STATE.relationHoverId = hover ? hover.id : null;

    const path = svgEl('path', {
      d: `M ${first.x},${first.y} L ${tx},${ty}`,
      class: 'relation-wire rubberband-line',
      fill: 'none'
    });
    styleRelationPath(path, STATE.activeRelationMode, STATE.activeRelationColor);
    rubberbandGroup.appendChild(path);

    const col = path.getAttribute('stroke') || '#c2955d';
    rubberbandGroup.appendChild(svgEl('circle', { cx: first.x, cy: first.y, r: 7, fill: col, stroke: '#fff', 'stroke-width': 2, class: 'rubberband-dot' }));
    if (!hover) {
      rubberbandGroup.appendChild(svgEl('circle', { cx: tx, cy: ty, r: 5, fill: '#fff', stroke: col, 'stroke-width': 2.5, class: 'rubberband-dot' }));
    }

    const srcEl = document.querySelector(`.system-figure[data-id="${first.id}"]`);
    if (srcEl) srcEl.classList.add('relation-source');
    if (hover) {
      const tgtEl = document.querySelector(`.system-figure[data-id="${hover.id}"]`);
      if (tgtEl) tgtEl.classList.add('relation-target-candidate');
    }
  }

  // Schwebendes Banner (Handy/Tablet): Das Menü mit dem Abbrechen-Button ist dann geschlossen
  function syncRelationFloating() {
    let el = document.getElementById('relationFloating');
    if (!el) {
      el = document.createElement('div');
      el.id = 'relationFloating';
      el.className = 'relation-floating';
      el.innerHTML = '<span class="rf-text"></span><button type="button" class="btn btn-xs btn-outline" id="btnCancelRelationFloating">Abbrechen</button>';
      document.querySelector('.workspace-body').appendChild(el);
      el.querySelector('button').addEventListener('click', () => cancelRelationMode());
    }
    const show = !!STATE.activeRelationMode && isCompact();
    el.style.display = show ? 'flex' : 'none';
    if (show) {
      const src = document.getElementById('relationModeText');
      el.querySelector('.rf-text').textContent = src ? src.textContent : '';
    }
  }

  function startRelationMode(type, color) {
    STATE.activeRelationMode = type;
    STATE.activeRelationColor = color;
    STATE.relationFirstFigureId = null;
    document.body.classList.add('relation-mode');

    const banner = document.getElementById('relationActiveBanner');
    const text = document.getElementById('relationModeText');
    if (banner && text) {
      text.textContent = window.matchMedia('(pointer: coarse)').matches
        ? '1. Erste Figur antippen – dann zur zweiten ziehen oder diese antippen'
        : '1. Klicke auf die erste Figur…  (Esc bricht ab)';
      banner.style.display = 'flex';
    }

    document.querySelectorAll('.relation-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-relation-type') === type && btn.getAttribute('data-color') === color);
    });
    if (isCompact()) setSidebarCollapsed('left', true);   // Brett freigeben, um Figuren anzutippen
    syncRelationFloating();
  }

  function cancelRelationMode() {
    STATE.activeRelationMode = null;
    STATE.relationFirstFigureId = null;
    STATE.relationHoverId = null;
    document.body.classList.remove('relation-mode');
    const banner = document.getElementById('relationActiveBanner');
    if (banner) banner.style.display = 'none';

    document.querySelectorAll('.relation-mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    updateRubberband();
    syncRelationFloating();
  }

  function handleRelationClick(figId) {
    if (!STATE.relationFirstFigureId) {
      STATE.relationFirstFigureId = figId;
      const f1 = getFigureById(figId);
      const text = document.getElementById('relationModeText');
      if (text) text.textContent = window.matchMedia('(pointer: coarse)').matches
        ? `2. Zielfigur antippen (Start: ${f1 ? f1.name : ''})`
        : `2. Ziehe die Linie zur Zielfigur und klicke sie an (Start: ${f1 ? f1.name : ''}) – Esc bricht ab`;
      playWoodClick(1.2);
      updateRubberband();
      syncRelationFloating();
    } else {
      if (STATE.relationFirstFigureId === figId) return;
      const phase = getCurrentPhase();
      if (phase) {
        phase.relations.push({
          fromId: STATE.relationFirstFigureId,
          toId: figId,
          type: STATE.activeRelationMode,
          color: STATE.activeRelationColor
        });
      }
      playWoodClick(1.5);
      cancelRelationMode();
      renderFigures();
      saveToStorage();
    }
  }

  // ---- Fokus-Modus (Vollbild: nur Brett und Notizen) -------------------------

  function enterFocusMode() {
    if (STATE.focusMode) return;
    STATE.focusMode = true;
    document.body.classList.add('focus-mode');

    // Rechte Seitenleiste im Fokus-Modus eingeklappt (der vorherige Zustand wird beim Beenden wiederhergestellt)
    const rightBar = document.getElementById('sidebarRight');
    STATE.focusPrevRightCollapsed = rightBar ? rightBar.classList.contains('collapsed') : true;
    setSidebarCollapsed('right', true);

    const root = document.documentElement;
    if (root.requestFullscreen) {
      root.requestFullscreen().then(() => {
        // Esc soll im Vollbild beim Brett ankommen (Beziehung/Perspektive abbrechen)
        try {
          if (navigator.keyboard && navigator.keyboard.lock) {
            navigator.keyboard.lock(['Escape']).catch(() => {});
          }
        } catch (err) { /* nicht unterstützt */ }
      }).catch(() => { /* Vollbild nicht erlaubt – Fokus-Ansicht bleibt trotzdem aktiv */ });
    }
    playWoodClick(1.1);
    refitAfterLayout();
  }

  function exitFocusMode() {
    if (!STATE.focusMode) return;
    STATE.focusMode = false;
    document.body.classList.remove('focus-mode');
    setSidebarCollapsed('right', STATE.focusPrevRightCollapsed !== false);
    try {
      if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
    } catch (err) { /* ignorieren */ }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    playWoodClick(0.9);
    refitAfterLayout();
  }

  function toggleFocusMode() {
    if (STATE.focusMode) exitFocusMode();
    else enterFocusMode();
  }

  function refitAfterLayout() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (STATE.povFigureId) applyPovCamera(false, true);
      else fitToView(true);
    }));
  }

  // ==========================================================================
  // 13. PHASEN-MANAGER & FLIESSENDE ZEITREISE
  // ==========================================================================

  function renderPhasesUI() {
    const container = document.getElementById('phasesContainer');
    if (!container) return;
    container.innerHTML = '';

    STATE.phases.forEach((phase, index) => {
      const pill = document.createElement('div');
      pill.className = `phase-pill ${index === STATE.currentPhaseIndex ? 'active' : ''}`;
      pill.setAttribute('data-phase-index', index);

      pill.innerHTML = `
        <span class="phase-name" title="Klicken zum Wechseln">${escapeHtml(phase.name)}</span>
        ${STATE.phases.length > 1 ? `<span class="phase-pill-remove" title="Phase löschen">&times;</span>` : ''}
      `;

      pill.querySelector('.phase-name').addEventListener('click', () => {
        switchPhaseWithTransition(index);
      });

      pill.querySelector('.phase-name').addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const newName = prompt('Name dieser Phase ändern:', phase.name);
        if (newName && newName.trim()) {
          phase.name = newName.trim();
          renderPhasesUI();
          saveToStorage();
        }
      });

      const removeBtn = pill.querySelector('.phase-pill-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Möchtest du Phase "${phase.name}" wirklich löschen?`)) {
            STATE.phases.splice(index, 1);
            if (STATE.currentPhaseIndex >= STATE.phases.length) {
              STATE.currentPhaseIndex = STATE.phases.length - 1;
            }
            renderPhasesUI();
            renderFigures();
            playWoodClick(0.7);
            saveToStorage();
          }
        });
      }

      container.appendChild(pill);
    });
  }

  function addPhase() {
    const current = getCurrentPhase();
    const newIndex = STATE.phases.length + 1;
    const newPhase = {
      id: 'phase_' + Date.now(),
      name: `${newIndex}. Bild / Phase`,
      figures: JSON.parse(JSON.stringify(current ? current.figures : [])),
      relations: JSON.parse(JSON.stringify(current ? current.relations : []))
    };

    STATE.phases.push(newPhase);
    switchPhaseWithTransition(STATE.phases.length - 1);
    playWoodClick(1.2);
    saveToStorage();
  }

  function switchPhaseWithTransition(targetIndex) {
    if (targetIndex === STATE.currentPhaseIndex) return;

    const sourcePhase = getCurrentPhase();
    const targetPhase = STATE.phases[targetIndex];
    if (!targetPhase) return;

    const duration = 500;
    const startTime = performance.now();

    const startPositions = {};
    if (sourcePhase) {
      sourcePhase.figures.forEach(f => {
        startPositions[f.id] = { x: f.x, y: f.y, rot: f.rotation };
      });
    }

    STATE.currentPhaseIndex = targetIndex;
    renderPhasesUI();
    selectFigure(null);
    playWoodClick(0.85);
    saveToStorage();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      targetPhase.figures.forEach(targetFig => {
        const start = startPositions[targetFig.id];
        if (start) {
          const curX = start.x + (targetFig.x - start.x) * ease;
          const curY = start.y + (targetFig.y - start.y) * ease;
          
          let diffRot = targetFig.rotation - start.rot;
          while (diffRot < -180) diffRot += 360;
          while (diffRot > 180) diffRot -= 360;
          const curRot = start.rot + diffRot * ease;

          const figElem = document.querySelector(`.system-figure[data-id="${targetFig.id}"]`);
          if (figElem) {
            figElem.setAttribute('transform', `translate(${curX}, ${curY})`);
            const rotBody = figElem.querySelector('.fig-rot-body');
            if (rotBody) rotBody.setAttribute('transform', `rotate(${curRot})`);
          }
        }
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        renderFigures();
        runSystemicAnalysis();
        playWoodClick(1.0);
      }
    }

    renderFigures();
    requestAnimationFrame(animate);
  }

  let timelineTimer = null;
  function playAllPhasesTimeline() {
    if (STATE.phases.length <= 1) {
      alert('Erstelle mindestens zwei Phasen, um eine Zeitreise abzuspielen.');
      return;
    }

    let p = 0;
    switchPhaseWithTransition(0);

    function step() {
      p++;
      if (p < STATE.phases.length) {
        timelineTimer = setTimeout(() => {
          switchPhaseWithTransition(p);
          step();
        }, 1600);
      }
    }
    step();
  }

  // ==========================================================================
  // 14. SYSTEMISCHER COACH & ANALYSE
  // ==========================================================================

  function runSystemicAnalysis() {
    const list = document.getElementById('systemicObservationsList');
    if (!list) return;

    const phase = getCurrentPhase();
    if (!phase || phase.figures.length === 0) {
      list.innerHTML = '<div class="obs-item">Setze Figuren auf das Brett, um systemische Muster zu analysieren.</div>';
      return;
    }

    const obs = [];
    const figs = phase.figures;

    const outsideFigs = figs.filter(f => !isPointOnBoard(f.x, f.y));
    if (outsideFigs.length > 0) {
      obs.push({
        type: 'warning',
        text: `<strong>Außenraum:</strong> ${outsideFigs.map(f => f.name).join(', ')} steht/stehen außerhalb des Brettes. Symbolisiert dies Ausgrenzung, Verstorbene oder Beobachter?`
      });
    }

    let backToBackFound = false;
    for (let i = 0; i < figs.length; i++) {
      for (let j = i + 1; j < figs.length; j++) {
        const A = figs[i];
        const B = figs[j];
        const dist = getDistance(A.x, A.y, B.x, B.y);
        if (dist < 180 && isTargetBehind(A, B) && isTargetBehind(B, A)) {
          obs.push({
            type: 'warning',
            text: `<strong>Rücken an Rücken:</strong> ${A.name} und ${B.name} stehen nah beieinander, wenden sich aber ab. Was steht zwischen ihnen?`
          });
          backToBackFound = true;
          break;
        }
      }
      if (backToBackFound) break;
    }

    let mutualLook = [];
    for (let i = 0; i < figs.length; i++) {
      for (let j = i + 1; j < figs.length; j++) {
        const A = figs[i];
        const B = figs[j];
        if (isTargetInView(A, B) && isTargetInView(B, A)) {
          mutualLook.push(`${A.name} ↔ ${B.name}`);
        }
      }
    }
    if (mutualLook.length > 0) {
      obs.push({
        type: 'solution',
        text: `<strong>Direkter Blickkontakt:</strong> ${mutualLook.join(', ')} stehen im direkten visuellen Austausch.`
      });
    }

    figs.forEach(target => {
      const watchers = figs.filter(other => isTargetInView(other, target));
      if (watchers.length >= 3 && watchers.length >= figs.length - 1) {
        obs.push({
          type: 'warning',
          text: `<strong>Fokus / Triangulierung:</strong> Nahezu alle Figuren blicken auf "${target.name}". Trägt diese Figur die Hauptlast?`
        });
      }
    });

    const lowScaleFigs = figs.filter(f => f.scale && f.scale <= 3);
    if (lowScaleFigs.length > 0) {
      obs.push({
        type: 'warning',
        text: `<strong>Belastung (Skala <= 3):</strong> ${lowScaleFigs.map(f => `${f.name} (${f.scale}/10)`).join(', ')} fühlen sich unwohl.`
      });
    }

    if (obs.length === 0) {
      obs.push({
        type: 'solution',
        text: `<strong>Harmonisches Bild:</strong> Keine akuten Spannungen im Blickfeld erkennbar.`
      });
    }

    list.innerHTML = obs.map(o => `<div class="obs-item ${o.type}">${o.text}</div>`).join('');
  }

  function pickRandomQuestion(catFilter = 'all') {
    let pool = SYSTEMIC_QUESTIONS;
    if (catFilter && catFilter !== 'all') {
      pool = SYSTEMIC_QUESTIONS.filter(q => q.cat === catFilter);
    }
    if (pool.length === 0) pool = SYSTEMIC_QUESTIONS;

    const item = pool[Math.floor(Math.random() * pool.length)];
    const catElem = document.getElementById('questionCategory');
    const textElem = document.getElementById('questionText');

    if (catElem && textElem) {
      catElem.textContent = item.cat.toUpperCase() + 'E FRAGE';
      textElem.textContent = `"${item.q}"`;
    }
  }

  // ==========================================================================
  // 15. VORLAGEN (TEMPLATES)
  // ==========================================================================

  function loadTemplate(templateId) {
    const phase = getCurrentPhase();
    if (!phase) return;

    phase.figures = [];
    phase.relations = [];

    const { cx, cy } = BOARD_GEO;

    switch (templateId) {
      case 'leer':
      default:
        // Unberührtes Brett: ein ganzes Brett, helle Buche, gelaserte Randlinie
        STATE.boardType = 'classic';
        STATE.splitDistance = 0;
        STATE.woodType = 'buche-hell';
        STATE.showLaserBorder = true;
        break;

      case 'herkunftsfamilie':
        STATE.boardType = 'classic';
        STATE.splitDistance = 0;
        phase.figures = [
          { id: 'f1', name: 'Vater', shape: 'kegel', size: 'gross', color: 'wood-light', rotation: 180, scale: 6, x: cx - 180, y: cy - 140 },
          { id: 'f2', name: 'Mutter', shape: 'kegel', size: 'gross', color: 'wood-light', rotation: 180, scale: 6, x: cx - 70, y: cy - 140 },
          { id: 'f3', name: 'Klient(in)', shape: 'kegel', size: 'mittel', color: '#2980b9', rotation: 0, scale: 4, x: cx - 120, y: cy + 80 },
          { id: 'f4', name: 'Geschwister', shape: 'kegel', size: 'mittel', color: 'wood-light', rotation: 340, scale: 7, x: cx - 220, y: cy + 70 },
          { id: 'f5', name: 'Ahnen / Großeltern', shape: 'kegel', size: 'gross', color: '#f4f4f4', rotation: 180, scale: 8, x: cx - 120, y: cy - 240 }
        ];
        break;

      case 'patchwork':
        STATE.boardType = 'classic';
        STATE.splitDistance = 20; // Bei Patchwork leicht geöffnet
        phase.figures = [
          { id: 'p1', name: 'Klient', shape: 'kegel', size: 'gross', color: '#2c3e50', rotation: 90, scale: 5, x: cx - 140, y: cy },
          { id: 'p2', name: 'Partnerin', shape: 'kegel', size: 'gross', color: '#c0392b', rotation: 270, scale: 8, x: cx + 140, y: cy },
          { id: 'p3', name: 'Ex-Partner', shape: 'kegel', size: 'gross', color: '#1a1a1a', rotation: 120, scale: 4, x: cx - 280, y: cy - 160 },
          { id: 'p4', name: 'Kind (aus Ehe 1)', shape: 'kegel', size: 'klein', color: 'wood-light', rotation: 0, scale: 5, x: cx - 100, y: cy + 120 },
          { id: 'p5', name: 'Gemeinsames Kind', shape: 'kegel', size: 'klein', color: '#f39c12', rotation: 0, scale: 9, x: cx, y: cy + 160 }
        ];
        phase.relations = [
          { fromId: 'p1', toId: 'p2', type: 'solid', color: '#c0392b' },
          { fromId: 'p1', toId: 'p3', type: 'conflict', color: '#ef4444' }
        ];
        break;

      case 'organisation':
        STATE.boardType = 'classic';
        STATE.splitDistance = 0;
        phase.figures = [
          { id: 'o1', name: 'Teamleitung', shape: 'kegel', size: 'gross', color: '#2c3e50', rotation: 180, scale: 5, x: cx, y: cy - 150 },
          { id: 'o2', name: 'Mitarbeiter 1', shape: 'kegel', size: 'mittel', color: '#2980b9', rotation: 0, scale: 6, x: cx - 180, y: cy + 20 },
          { id: 'o3', name: 'Mitarbeiter 2', shape: 'kegel', size: 'mittel', color: '#27ae60', rotation: 330, scale: 7, x: cx, y: cy + 60 },
          { id: 'o4', name: 'Mitarbeiter 3', shape: 'kegel', size: 'mittel', color: '#8e44ad', rotation: 20, scale: 4, x: cx + 180, y: cy + 20 },
          { id: 'o5', name: 'Projektziel / Vision', shape: 'stern', size: 'gross', color: '#f1c40f', rotation: 0, scale: 9, x: cx, y: cy - 250 },
          { id: 'o6', name: 'Kunde', shape: 'kegel', size: 'gross', color: '#d35400', rotation: 270, scale: 6, x: cx + 320, y: cy - 80 },
          { id: 'o7', name: 'Hindernis / Last', shape: 'block', size: 'gross', color: 'wood-light', rotation: 0, scale: 2, x: cx - 100, y: cy - 50 }
        ];
        phase.relations = [
          { fromId: 'o1', toId: 'o5', type: 'arrow', color: '#3b82f6' }
        ];
        break;

      case 'inneres-team':
        STATE.boardType = 'classic';
        STATE.splitDistance = 0;
        phase.figures = [
          { id: 'it1', name: 'Ich-Zentrum (Selbst)', shape: 'kegel', size: 'gross', color: 'wood-light', rotation: 0, scale: 6, x: cx, y: cy },
          { id: 'it2', name: 'Der Perfektionist / Kritiker', shape: 'kegel', size: 'gross', color: '#1a1a1a', rotation: 180, scale: 3, x: cx, y: cy - 160 },
          { id: 'it3', name: 'Das innere Kind', shape: 'kegel', size: 'klein', color: '#f39c12', rotation: 0, scale: 4, x: cx - 150, y: cy + 80 },
          { id: 'it4', name: 'Der Gelassene Bewahrer', shape: 'kegel', size: 'mittel', color: '#16a085', rotation: 45, scale: 8, x: cx + 150, y: cy + 80 },
          { id: 'it5', name: 'Der Visionär / Träumer', shape: 'stern', size: 'mittel', color: '#9b59b6', rotation: 270, scale: 7, x: cx + 180, y: cy - 90 }
        ];
        break;

      case 'tetralemma':
        STATE.boardType = 'classic';
        STATE.splitDistance = 0;
        phase.figures = [
          { id: 't1', name: '1. Das Eine (Option A)', shape: 'kegel', size: 'gross', color: '#2980b9', rotation: 90, scale: 6, x: cx - 220, y: cy - 80 },
          { id: 't2', name: '2. Das Andere (Option B)', shape: 'kegel', size: 'gross', color: '#c0392b', rotation: 270, scale: 6, x: cx + 220, y: cy - 80 },
          { id: 't3', name: '3. Beides (Synthese)', shape: 'kegel', size: 'mittel', color: '#8e44ad', rotation: 180, scale: 7, x: cx, y: cy - 180 },
          { id: 't4', name: '4. Keines von Beidem', shape: 'stein', size: 'mittel', color: '#7f8c8d', rotation: 0, scale: 5, x: cx, y: cy + 140 },
          { id: 't5', name: '5. Das Fünfte (Freier Raum)', shape: 'diamant', size: 'gross', color: '#f1c40f', rotation: 0, scale: 10, x: cx, y: cy + 320 }
        ];
        break;

      case 'symptomaufstellung':
        STATE.boardType = 'classic';
        STATE.splitDistance = 20;
        phase.figures = [
          { id: 's1', name: 'Klient', shape: 'kegel', size: 'gross', color: '#2c3e50', rotation: 90, scale: 4, x: cx - 180, y: cy },
          { id: 's2', name: 'Symptom (z.B. Erschöpfung)', shape: 'wolke', size: 'gross', color: '#c0392b', rotation: 270, scale: 2, x: cx + 180, y: cy },
          { id: 's3', name: 'Verdeckter Gewinn / Botschaft', shape: 'kiste', size: 'mittel', color: '#8d6e63', rotation: 270, scale: 6, x: cx + 240, y: cy + 150 },
          { id: 's4', name: 'Ressource (Selbstfürsorge)', shape: 'diamant', size: 'gross', color: '#27ae60', rotation: 0, scale: 9, x: cx - 240, y: cy + 180 }
        ];
        phase.relations = [
          { fromId: 's1', toId: 's2', type: 'conflict', color: '#ef4444' }
        ];
        break;

    }

    updateSplitUI();
    renderBoard();
    renderFigures();
    playWoodClick(1.0);
    runSystemicAnalysis();
    saveToStorage();
  }

  // ==========================================================================
  // 16. EXPORT, JSON SPEICHERN / LADEN & DRUCK
  // ==========================================================================

  // CSS, das beim Export direkt in die SVG eingebettet wird (die Seiten-Stylesheets fehlen im Bild)
  const EXPORT_CSS = `
    .laser-border-line { fill: none; stroke-width: 2px; stroke-linejoin: round; stroke-linecap: round; }
    .figure-label-text { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600;
      fill: #f0f2f5; text-anchor: middle; paint-order: stroke; stroke: rgba(0,0,0,0.75); stroke-width: 3px; stroke-linejoin: round; }
    .figure-scale-badge { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 9px; font-weight: 700; fill: #fff; text-anchor: middle; }
    .vision-cone { opacity: 0.35; }
    .vision-cone.highlighted { opacity: 0.65; }
    .sight-line { stroke-width: 1.5; }
    .relation-wire { fill: none; }
    .figure-in-blindspot { opacity: 0.42; }
    .figure-in-periphery { opacity: 0.82; }
  `;

  // Baut eine eigenständige SVG (inkl. Holzmaserung, Filter und Styles) für PNG-Export und Druck.
  function buildExportSvg(scale) {
    // Export zeigt das Brett von oben: Figuren dafür flach zeichnen
    const wasSolid = useSolids();
    if (wasSolid) { STATE.forceFlat = true; renderFigures(); }
    // Für den Export die scharfe Live-Maserung statt des vorberechneten Bildes verwenden
    const hadGrainImage = STATE.grainImageReady;
    if (hadGrainImage) { STATE.grainImageReady = false; renderBoard(); }
    const clone = svgElem.cloneNode(true);
    if (hadGrainImage) { STATE.grainImageReady = true; renderBoard(); }
    if (wasSolid) { STATE.forceFlat = false; renderFigures(); }

    ['controlsOverlayGroup', 'rubberbandGroup'].forEach(id => {
      const g = clone.querySelector('#' + id);
      if (g) g.innerHTML = '';
    });
    clone.querySelectorAll('.selected').forEach(n => n.classList.remove('selected'));
    const outer = clone.querySelector('#outerSpace');
    if (outer) outer.remove();

    // Ausschnitt: Brett + alle Figuren, mit Rand
    const b = getBoardBounds();
    let minX = b.x - 70, maxX = b.x + b.w + 70, minY = b.y - 70, maxY = b.y + b.h + 70;
    const phase = getCurrentPhase();
    if (phase) {
      phase.figures.forEach(f => {
        minX = Math.min(minX, f.x - 90);
        maxX = Math.max(maxX, f.x + 90);
        minY = Math.min(minY, f.y - 90);
        maxY = Math.max(maxY, f.y + 110);
      });
    }
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(CONTAINER_W, maxX);
    maxY = Math.min(CONTAINER_H, maxY + 34);   // Platz für die Beschriftungszeile
    const w = maxX - minX;
    const h = maxY - minY;

    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox', `${minX} ${minY} ${w} ${h}`);
    clone.setAttribute('width', Math.round(w * scale));
    clone.setAttribute('height', Math.round(h * scale));
    clone.removeAttribute('class');

    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = EXPORT_CSS;
    clone.insertBefore(style, clone.firstChild);

    const svgStr = new XMLSerializer().serializeToString(clone);
    return { svgStr, w, h, minX, minY, scale };
  }

  function exportAsPng() {
    const SCALE = 2;
    const exp = buildExportSvg(SCALE);
    const urlApi = window.URL || window.webkitURL;
    const blobURL = urlApi.createObjectURL(new Blob([exp.svgStr], { type: 'image/svg+xml;charset=utf-8' }));

    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(exp.w * SCALE);
      canvas.height = Math.round(exp.h * SCALE);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1e1f24';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `${13 * SCALE}px sans-serif`;
      ctx.fillText(`${STATE.sessionTitle} • ${getCurrentPhase().name} • ${new Date().toLocaleDateString('de-DE')}`, 22 * SCALE, canvas.height - 14 * SCALE);

      urlApi.revokeObjectURL(blobURL);

      canvas.toBlob(blob => {
        if (!blob) return;
        const dl = urlApi.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = `Systembrett_${sanitizeFilename(STATE.sessionTitle)}_${Date.now()}.png`;
        a.href = dl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => urlApi.revokeObjectURL(dl), 2000);
      }, 'image/png');
    };
    img.onerror = function () {
      urlApi.revokeObjectURL(blobURL);
      alert('Das Bild konnte nicht erzeugt werden.');
    };
    img.src = blobURL;
  }

  function exportAsJson() {
    const data = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      sessionTitle: STATE.sessionTitle,
      boardType: STATE.boardType,
      splitDistance: STATE.splitDistance,
      woodType: STATE.woodType,
      phases: STATE.phases,
      notes: {
        client: document.getElementById('notesClientName')?.value || '',
        problem: document.getElementById('notesProblem')?.value || '',
        hypothesis: document.getElementById('notesHypothesis')?.value || '',
        solution: document.getElementById('notesSolution')?.value || ''
      }
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `Aufstellung_${sanitizeFilename(STATE.sessionTitle)}.systembrett`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importFromJson(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.phases) {
          alert('Ungültiges Dateiformat. Keine Systembrett-Phasen gefunden.');
          return;
        }

        STATE.sessionTitle = data.sessionTitle || 'Geladene Aufstellung';
        STATE.boardType = ['classic', 'single', 'round', 'split'].includes(data.boardType) ? data.boardType : 'classic';
        STATE.splitDistance = data.splitDistance !== undefined ? data.splitDistance : 0;
        STATE.woodType = data.woodType || 'buche-hell';
        STATE.phases = data.phases;
        STATE.currentPhaseIndex = 0;

        document.getElementById('sessionTitle').value = STATE.sessionTitle;

        if (data.notes) {
          if (document.getElementById('notesClientName')) document.getElementById('notesClientName').value = data.notes.client || '';
          if (document.getElementById('notesProblem')) document.getElementById('notesProblem').value = data.notes.problem || '';
          if (document.getElementById('notesHypothesis')) document.getElementById('notesHypothesis').value = data.notes.hypothesis || '';
          if (document.getElementById('notesSolution')) document.getElementById('notesSolution').value = data.notes.solution || '';
        }

        updateSplitUI();
        renderBoard();
        renderFigures();
        renderPhasesUI();
        runSystemicAnalysis();
        playWoodClick(1.2);
        saveToStorage();
        alert('Aufstellung erfolgreich geladen!');
      } catch (err) {
        alert('Fehler beim Einlesen der Datei: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // --------------------------------------------------------------------------
  // LOKALE AUTOMATISCHE SPEICHERUNG (localStorage Persistence)
  // --------------------------------------------------------------------------

  const STORAGE_KEY = 'systembrett_autosave_v1';
  let saveTimeout = null;

  function saveToStorage() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    try {
      const data = {
        version: '1.0',
        savedAt: Date.now(),
        sessionTitle: STATE.sessionTitle || 'Neue Aufstellung',
        boardType: STATE.boardType || 'classic',
        splitDistance: typeof STATE.splitDistance === 'number' ? STATE.splitDistance : 0,
        showLaserBorder: STATE.showLaserBorder !== false,
        woodType: STATE.woodType || 'buche-hell',
        viewMode: STATE.viewMode || '2d',
        viewYaw: typeof STATE.viewYaw === 'number' ? STATE.viewYaw : -16,
        viewTilt: typeof STATE.viewTilt === 'number' ? STATE.viewTilt : 46,
        showCones: STATE.showCones !== false,
        showSightLines: !!STATE.showSightLines,
        showGrid: !!STATE.showGrid,
        soundEnabled: STATE.soundEnabled !== false,
        currentPhaseIndex: STATE.currentPhaseIndex || 0,
        phases: STATE.phases || [],
        notes: {
          client: document.getElementById('notesClientName')?.value || STATE.notes?.client || '',
          problem: document.getElementById('notesProblem')?.value || STATE.notes?.problem || '',
          hypothesis: document.getElementById('notesHypothesis')?.value || STATE.notes?.hypothesis || '',
          solution: document.getElementById('notesSolution')?.value || STATE.notes?.solution || ''
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      indicateAutoSaved();
    } catch (err) {
      console.warn('Automatische Speicherung in localStorage fehlgeschlagen:', err);
    }
  }

  function debounceSaveToStorage(delay = 250) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveToStorage();
    }, delay);
  }

  function indicateAutoSaved() {
    const meta = document.getElementById('sessionMeta');
    const phase = getCurrentPhase();
    if (!meta || !phase) return;
    meta.textContent = `${phase.figures.length} Figuren • ${phase.name}`;
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.phases || !Array.isArray(data.phases) || data.phases.length === 0) {
        return false;
      }

      STATE.sessionTitle = data.sessionTitle || 'Neue Aufstellung';
      STATE.boardType = ['classic', 'single', 'round', 'split'].includes(data.boardType) ? data.boardType : 'classic';
      STATE.splitDistance = typeof data.splitDistance === 'number' ? data.splitDistance : 0;
      STATE.showLaserBorder = data.showLaserBorder !== false;
      STATE.woodType = data.woodType || 'buche-hell';
      if (data.viewMode && (data.viewMode === '2d' || data.viewMode === '25d')) {
        STATE.viewMode = data.viewMode;
      }
      if (typeof data.viewYaw === 'number') STATE.viewYaw = data.viewYaw;
      if (typeof data.viewTilt === 'number') STATE.viewTilt = data.viewTilt;
      if (typeof data.showCones === 'boolean') STATE.showCones = data.showCones;
      if (typeof data.showSightLines === 'boolean') STATE.showSightLines = data.showSightLines;
      if (typeof data.showGrid === 'boolean') STATE.showGrid = data.showGrid;
      if (typeof data.soundEnabled === 'boolean') STATE.soundEnabled = data.soundEnabled;

      STATE.phases = data.phases;
      STATE.currentPhaseIndex = Math.max(0, Math.min(data.currentPhaseIndex || 0, STATE.phases.length - 1));

      // Synchronisation mit Formular- und Oberflächenelementen
      const titleInput = document.getElementById('sessionTitle');
      if (titleInput) titleInput.value = STATE.sessionTitle;

      if (data.notes) {
        STATE.notes = data.notes;
        const nClient = document.getElementById('notesClientName');
        const nProb = document.getElementById('notesProblem');
        const nHypo = document.getElementById('notesHypothesis');
        const nSol = document.getElementById('notesSolution');
        if (nClient) nClient.value = data.notes.client || '';
        if (nProb) nProb.value = data.notes.problem || '';
        if (nHypo) nHypo.value = data.notes.hypothesis || '';
        if (nSol) nSol.value = data.notes.solution || '';
      }

      const checkLaser = document.getElementById('checkLaserBorder');
      if (checkLaser) checkLaser.checked = STATE.showLaserBorder;

      const splitSlider = document.getElementById('splitDistanceSlider');
      if (splitSlider) splitSlider.value = STATE.splitDistance;

      const btn2D = document.getElementById('btnView2D');
      const btn25D = document.getElementById('btnView25D');
      if (btn2D && btn25D) {
        if (STATE.viewMode === '25d') {
          document.body.classList.add('view-25d');
          btn25D.classList.add('active');
          btn2D.classList.remove('active');
        } else {
          document.body.classList.remove('view-25d');
          btn2D.classList.add('active');
          btn25D.classList.remove('active');
        }
      }

      document.querySelectorAll('.wood-choice').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-wood') === STATE.woodType);
      });

      document.querySelectorAll('.board-shape-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-shape') === STATE.boardType);
      });

      document.getElementById('btnToggleCones')?.classList.toggle('active', STATE.showCones);
      document.getElementById('btnToggleSightLines')?.classList.toggle('active', STATE.showSightLines);
      document.getElementById('btnToggleGrid')?.classList.toggle('active', STATE.showGrid);
      const gridGroup = document.getElementById('boardGridGroup');
      if (gridGroup) gridGroup.style.display = STATE.showGrid ? 'block' : 'none';

      const soundOn = document.getElementById('soundIconOn');
      const soundOff = document.getElementById('soundIconOff');
      if (soundOn && soundOff) {
        soundOn.style.display = STATE.soundEnabled ? 'block' : 'none';
        soundOff.style.display = STATE.soundEnabled ? 'none' : 'block';
      }

      updateSplitUI();
      renderBoard();
      renderFigures();
      renderPhasesUI();
      runSystemicAnalysis();
      updateSessionMeta();
      return true;
    } catch (err) {
      console.warn('Wiederherstellung aus localStorage fehlgeschlagen:', err);
      return false;
    }
  }


  function printReport() {
    const exp = buildExportSvg(1.5);
    const svgBlob = new Blob([exp.svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const urlApi = window.URL || window.webkitURL;
    const blobURL = urlApi.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function () {
      const container = document.getElementById('printBoardImageContainer');
      if (container) {
        container.innerHTML = '';
        container.appendChild(img);
      }

      document.getElementById('printDate').textContent = new Date().toLocaleDateString('de-DE');
      document.getElementById('printSessionTitle').textContent = STATE.sessionTitle;

      const tbody = document.querySelector('#printFiguresTable tbody');
      if (tbody) {
        tbody.innerHTML = '';
        const phase = getCurrentPhase();
        if (phase) {
          phase.figures.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${escapeHtml(f.name)}</strong></td>
              <td>${f.shape} (${f.size})</td>
              <td>${f.rotation}°</td>
              <td>${f.scale || 5}/10</td>
              <td>${escapeHtml(f.notes || '-')}</td>
            `;
            tbody.appendChild(tr);
          });
        }
      }

      const notesBlock = document.getElementById('printNotesContent');
      if (notesBlock) {
        const client = document.getElementById('notesClientName')?.value || '-';
        const problem = document.getElementById('notesProblem')?.value || '-';
        const hypo = document.getElementById('notesHypothesis')?.value || '-';
        const sol = document.getElementById('notesSolution')?.value || '-';
        notesBlock.textContent = `Klient / Kontext: ${client}\n\nFragestellung: ${problem}\n\nHypothesen: ${hypo}\n\nLösungsbild: ${sol}`;
      }

      window.print();
      urlApi.revokeObjectURL(blobURL);
    };
    img.src = blobURL;
  }

  function sanitizeFilename(name) {
    return (name || 'Aufstellung').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function updateSessionMeta() {
    const meta = document.getElementById('sessionMeta');
    const phase = getCurrentPhase();
    if (meta && phase) {
      meta.textContent = `${phase.figures.length} Figuren • ${phase.name}`;
    }
  }

  // ==========================================================================
  // 17. UI EVENT LISTENERS
  // ==========================================================================

  // --------------------------------------------------------------------------
  // FIGUREN-VORLAGEN (Klick UND Drag & Drop)
  // --------------------------------------------------------------------------

  const QUICK_PRESETS = {
    'kegel-holz': { shape: 'kegel', size: 'mittel', color: 'wood-light', name: 'Holz' },
    'kegel-rot': { shape: 'kegel', size: 'mittel', color: '#c0392b', name: 'Rot' },
    'kegel-schwarz': { shape: 'kegel', size: 'mittel', color: '#1a1a1a', name: 'Schwarz' },
    'kegel-blau': { shape: 'kegel', size: 'mittel', color: '#2980b9', name: 'Blau' },
    'kegel-gruen': { shape: 'kegel', size: 'mittel', color: '#27ae60', name: 'Grün' },
    'kegel-weiss': { shape: 'kegel', size: 'mittel', color: '#f4f4f4', name: 'Weiß' }
  };


  function presetFromElement(el) {
    if (!el) return null;
    if (el.hasAttribute('data-create')) {
      const p = QUICK_PRESETS[el.getAttribute('data-create')];
      return p ? Object.assign({}, p) : null;
    }
    if (el.hasAttribute('data-create-symbol')) {
      const nameEl = el.querySelector('.symbol-name');
      return {
        shape: el.getAttribute('data-create-symbol'),
        size: 'mittel',
        color: el.getAttribute('data-color'),
        name: nameEl ? nameEl.textContent : 'Symbol'
      };
    }
    return null;
  }

  let draggedPreset = null;

  // Auf kleinen Bildschirmen schließt sich die Schublade nach dem Platzieren, damit man das Ergebnis sieht
  function afterPaletteAdd() {
    if (isCompact()) setSidebarCollapsed('left', true);
  }

  // Touch: Langes Drücken auf eine Palettenkarte und Ziehen platziert das Objekt an der gewünschten Stelle
  // (natives HTML5-Drag-and-Drop funktioniert auf Touchgeräten nicht zuverlässig)
  function setupTouchPaletteDrag() {
    const cards = document.querySelectorAll('.quick-figure-btn, .symbol-card');
    let timer = null, active = null, ghost = null, pid = null, start = null, suppressClick = false;

    const ghostAt = (x, y) => { if (ghost) ghost.style.transform = `translate(${x - 36}px, ${y - 96}px)`; };
    const cleanup = () => {
      clearTimeout(timer); timer = null;
      if (ghost) { ghost.remove(); ghost = null; }
      active = null; pid = null;
      document.body.classList.remove('palette-dragging');
    };

    cards.forEach(card => {
      card.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch') return;
        pid = e.pointerId;
        start = { x: e.clientX, y: e.clientY };
        clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          const preset = presetFromElement(card);
          if (!preset) return;
          active = { preset: preset };
          ghost = document.createElement('div');
          ghost.className = 'palette-ghost';
          const art = card.querySelector('.palette-preview');
          if (art) ghost.appendChild(art.cloneNode(true));
          document.body.appendChild(ghost);
          ghostAt(start.x, start.y);
          document.body.classList.add('palette-dragging');
          if (navigator.vibrate) navigator.vibrate(12);
        }, 320);
      });
      // Nach einem Ziehen kein zusätzliches „Klick = in die Mitte setzen“
      card.addEventListener('click', (e) => {
        if (suppressClick) { suppressClick = false; e.stopImmediatePropagation(); e.preventDefault(); }
      }, true);
      card.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      if (timer) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) { clearTimeout(timer); timer = null; }   // Scrollen
        return;
      }
      if (active) ghostAt(e.clientX, e.clientY);
    });

    const finish = (e, drop) => {
      if (e.pointerId !== pid) return;
      if (active && drop) {
        const vr = boardViewportEl.getBoundingClientRect();
        if (e.clientX >= vr.left && e.clientX <= vr.right && e.clientY >= vr.top && e.clientY <= vr.bottom) {
          const pt = clientToBoard(e.clientX, e.clientY);
          addFigure(Object.assign({}, active.preset, {
            x: Math.round(clamp(pt.x, 40, CONTAINER_W - 40)),
            y: Math.round(clamp(pt.y, 40, CONTAINER_H - 40))
          }), { select: false });
          if (isCompact()) setSidebarCollapsed('left', true);
        }
      }
      if (active) suppressClick = true;
      cleanup();
    };
    window.addEventListener('pointerup', (e) => finish(e, true));
    window.addEventListener('pointercancel', (e) => finish(e, false));

    // Während des Ziehens darf die Palette nicht scrollen
    document.addEventListener('touchmove', (e) => { if (active) e.preventDefault(); }, { passive: false });
  }

  function setupDragAndDrop() {
    if (window.matchMedia('(pointer: coarse)').matches) {
      document.querySelectorAll('.quick-figure-btn[draggable], .symbol-card[draggable]').forEach(el => el.setAttribute('draggable', 'false'));
    }
    setupTouchPaletteDrag();

    document.querySelectorAll('.quick-figure-btn[draggable="true"], .symbol-card[draggable="true"]').forEach(btn => {
      btn.addEventListener('dragstart', (e) => {
        draggedPreset = presetFromElement(btn);
        if (!draggedPreset) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', 'systembrett-figur:' + draggedPreset.name);
        initAudio();
      });
      btn.addEventListener('dragend', () => {
        draggedPreset = null;
        boardViewportEl.classList.remove('drag-over');
      });
    });

    boardViewportEl.addEventListener('dragover', (e) => {
      if (!draggedPreset) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      boardViewportEl.classList.add('drag-over');
    });

    boardViewportEl.addEventListener('dragleave', (e) => {
      if (!boardViewportEl.contains(e.relatedTarget)) {
        boardViewportEl.classList.remove('drag-over');
      }
    });

    boardViewportEl.addEventListener('drop', (e) => {
      boardViewportEl.classList.remove('drag-over');
      if (!draggedPreset) return;
      e.preventDefault();
      const pt = clientToBoard(e.clientX, e.clientY);
      const preset = draggedPreset;
      draggedPreset = null;
      addFigure(Object.assign({}, preset, {
        x: Math.round(clamp(pt.x, 40, CONTAINER_W - 40)),
        y: Math.round(clamp(pt.y, 40, CONTAINER_H - 40))
      }), { select: false });
    });
  }

  function setupUiListeners() {
    const titleInput = document.getElementById('sessionTitle');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        STATE.sessionTitle = e.target.value.trim() || 'Neue Aufstellung';
        debounceSaveToStorage();
      });
      titleInput.addEventListener('change', (e) => {
        STATE.sessionTitle = e.target.value.trim() || 'Neue Aufstellung';
        saveToStorage();
      });
    }

    // 1-BRETT / TRENNUNG UMSCHALTER (PROMINENT IM HEADER)
    document.getElementById('btnToggleSplit')?.addEventListener('click', () => {
      toggleBoardSplit();
      saveToStorage();
    });
    document.getElementById('btnSetUnified')?.addEventListener('click', () => {
      setBoardUnified();
      saveToStorage();
    });
    document.getElementById('btnSetSplit')?.addEventListener('click', () => {
      setBoardSplit();
      saveToStorage();
    });

    // View-Modes (Brett wird bei jedem Wechsel bildschirmfüllend eingepasst)
    document.getElementById('btnView2D')?.addEventListener('click', () => {
      setViewMode('2d');
      saveToStorage();
    });
    document.getElementById('btnView25D')?.addEventListener('click', () => {
      setViewMode('25d');
      saveToStorage();
    });

    // Overlays
    document.getElementById('btnToggleCones')?.addEventListener('click', (e) => {
      STATE.showCones = !STATE.showCones;
      e.currentTarget.classList.toggle('active', STATE.showCones);
      renderFigures();
      saveToStorage();
    });

    document.getElementById('btnToggleSightLines')?.addEventListener('click', (e) => {
      STATE.showSightLines = !STATE.showSightLines;
      e.currentTarget.classList.toggle('active', STATE.showSightLines);
      renderFigures();
      saveToStorage();
    });

    document.getElementById('btnToggleGrid')?.addEventListener('click', (e) => {
      STATE.showGrid = !STATE.showGrid;
      e.currentTarget.classList.toggle('active', STATE.showGrid);
      renderGrid();
      saveToStorage();
    });

    // Sound
    document.getElementById('btnSoundToggle')?.addEventListener('click', () => {
      STATE.soundEnabled = !STATE.soundEnabled;
      document.getElementById('soundIconOn').style.display = STATE.soundEnabled ? 'block' : 'none';
      document.getElementById('soundIconOff').style.display = STATE.soundEnabled ? 'none' : 'block';
      if (STATE.soundEnabled) playWoodClick(1.1);
      saveToStorage();
    });

    // Zoom
    document.getElementById('btnZoomIn')?.addEventListener('click', () => {
      const c = viewportCenterClient();
      zoomAt(1.25, c.x, c.y);
    });

    document.getElementById('btnZoomOut')?.addEventListener('click', () => {
      const c = viewportCenterClient();
      zoomAt(1 / 1.25, c.x, c.y);
    });

    document.getElementById('btnCenterBoard')?.addEventListener('click', resetZoomAndPan);

    // Linke Leiste: Akkordeon (unabhängig auf- und zuklappbar)
    document.querySelectorAll('.acc-header').forEach(header => {
      header.addEventListener('click', () => {
        const open = !header.classList.contains('open');
        header.classList.toggle('open', open);
        header.setAttribute('aria-expanded', open ? 'true' : 'false');
        const body = document.getElementById(header.getAttribute('data-acc'));
        if (body) body.classList.toggle('open', open);
      });
    });

    // 3D-Navigation (Kompass, Drehen, Neigen)
    document.getElementById('btnRotLeft')?.addEventListener('click', () => { stopViewMotion(); tweenViewAngles(STATE.viewYaw + 15, STATE.viewTilt, 260); });
    document.getElementById('btnRotRight')?.addEventListener('click', () => { stopViewMotion(); tweenViewAngles(STATE.viewYaw - 15, STATE.viewTilt, 260); });
    document.getElementById('btnTiltUp')?.addEventListener('click', () => { stopViewMotion(); tweenViewAngles(STATE.viewYaw, STATE.viewTilt + 8, 260); });
    document.getElementById('btnTiltDown')?.addEventListener('click', () => { stopViewMotion(); tweenViewAngles(STATE.viewYaw, STATE.viewTilt - 8, 260); });
    document.getElementById('btnCompass')?.addEventListener('click', resetViewOrientation);

    // Menüs ein- und ausklappen
    document.getElementById('btnCollapseLeft')?.addEventListener('click', () => setSidebarCollapsed('left', true));
    document.getElementById('btnExpandLeft')?.addEventListener('click', () => setSidebarCollapsed('left', false));
    document.getElementById('btnCollapseRight')?.addEventListener('click', () => setSidebarCollapsed('right', true));
    document.getElementById('btnExpandRight')?.addEventListener('click', () => setSidebarCollapsed('right', false));
    document.getElementById('btnCloseInspector')?.addEventListener('click', () => selectFigure(null));

    // Rechte Leiste: Tabs
    document.querySelectorAll('.sidebar-tabs').forEach(tabsNav => {
      tabsNav.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tabId = btn.getAttribute('data-tab');
          const sidebar = btn.closest('aside');
          sidebar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          sidebar.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          sidebar.querySelector(`#${tabId}`)?.classList.add('active');
        });
      });
    });

    // Schnell-Figuren: Klick setzt die Figur ins Brett (Drag & Drop siehe setupDragAndDrop)
    document.querySelectorAll('.quick-figure-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = presetFromElement(btn);
        if (preset) { addFigure(preset, { select: false }); afterPaletteAdd(); }
      });
    });

    let selectedColor = 'wood-light';
    document.querySelectorAll('.color-palette-selector:not(.compact) .color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        document.querySelectorAll('.color-palette-selector:not(.compact) .color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        selectedColor = dot.getAttribute('data-color');
      });
    });

    let selectedShape = 'kegel';
    document.querySelectorAll('.form-shape-select button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.form-shape-select button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedShape = btn.getAttribute('data-shape');
      });
    });

    let selectedSize = 'gross';
    document.querySelectorAll('.form-size-select button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.form-size-select button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedSize = btn.getAttribute('data-size');
      });
    });

    document.getElementById('btnCreateCustomFigure')?.addEventListener('click', () => {
      const name = document.getElementById('inputNewFigureLabel').value.trim() || 'Figur';
      addFigure({
        name: name,
        shape: selectedShape,
        size: selectedSize,
        color: selectedColor
      });
      document.getElementById('inputNewFigureLabel').value = '';
    });

    document.querySelectorAll('.symbol-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = presetFromElement(btn);
        if (preset) { addFigure(preset, { select: false }); afterPaletteAdd(); }
      });
    });

    document.getElementById('btnClearBoard')?.addEventListener('click', () => {
      if (confirm('Möchtest du alle Figuren von diesem Brett entfernen?')) {
        const phase = getCurrentPhase();
        if (phase) {
          phase.figures = [];
          phase.relations = [];
          selectFigure(null);
          playWoodClick(0.7);
          runSystemicAnalysis();
          saveToStorage();
        }
      }
    });

    document.querySelectorAll('.relation-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-relation-type');
        const color = btn.getAttribute('data-color');
        startRelationMode(type, color);
      });
    });

    document.getElementById('btnCancelRelation')?.addEventListener('click', cancelRelationMode);

    document.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        const tId = card.getAttribute('data-template');
        loadTemplate(tId);
        setAccordion('tab-templates', false);
        setAccordion('tab-figures', true);
      });
    });

    // Brett Einstellungen
    document.querySelectorAll('.board-shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.board-shape-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.boardType = btn.getAttribute('data-shape');
        renderBoard();
        if (STATE.autoFit && !STATE.povFigureId) fitToView(true);
        playWoodClick(1.0);
        saveToStorage();
      });
    });

    const splitSlider = document.getElementById('splitDistanceSlider');
    if (splitSlider) {
      splitSlider.addEventListener('input', (e) => {
        STATE.splitDistance = parseInt(e.target.value, 10);
        updateSplitUI();
        renderBoard();
        debounceSaveToStorage();
      });
      splitSlider.addEventListener('change', () => {
        if (STATE.autoFit && !STATE.povFigureId) fitToView(true);
        saveToStorage();
      });
    }

    const checkLaser = document.getElementById('checkLaserBorder');
    if (checkLaser) {
      checkLaser.addEventListener('change', (e) => {
        STATE.showLaserBorder = e.target.checked;
        renderBoard();
        saveToStorage();
      });
    }

    document.querySelectorAll('.wood-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.wood-choice').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.woodType = btn.getAttribute('data-wood');
        renderBoard();
        playWoodClick(1.1);
        saveToStorage();
      });
    });

    // Inspektor Handlers
    const inspName = document.getElementById('inspNameInput');
    if (inspName) {
      inspName.addEventListener('input', (e) => {
        const fig = getFigureById(STATE.selectedFigureId);
        if (fig) {
          fig.name = e.target.value;
          renderFigures();
          debounceSaveToStorage();
        }
      });
    }

    document.getElementById('btnTurnLeft45')?.addEventListener('click', () => {
      const fig = getFigureById(STATE.selectedFigureId);
      if (fig) {
        fig.rotation = normalizeAngle(fig.rotation - 45);
        renderFigures();
        updateInspectorValues(fig);
        playWoodClick(1.1);
        runSystemicAnalysis();
        saveToStorage();
      }
    });

    document.getElementById('btnTurnRight45')?.addEventListener('click', () => {
      const fig = getFigureById(STATE.selectedFigureId);
      if (fig) {
        fig.rotation = normalizeAngle(fig.rotation + 45);
        renderFigures();
        updateInspectorValues(fig);
        playWoodClick(1.1);
        runSystemicAnalysis();
        saveToStorage();
      }
    });

    document.getElementById('btnTurn180')?.addEventListener('click', () => {
      const fig = getFigureById(STATE.selectedFigureId);
      if (fig) {
        fig.rotation = normalizeAngle(fig.rotation + 180);
        renderFigures();
        updateInspectorValues(fig);
        playWoodClick(1.2);
        runSystemicAnalysis();
        saveToStorage();
      }
    });

    document.getElementById('btnAlignLookTo')?.addEventListener('click', () => {
      const current = getFigureById(STATE.selectedFigureId);
      const targetId = document.getElementById('inspTargetLookSelect').value;
      const target = getFigureById(targetId);
      if (current && target) {
        current.rotation = Math.round(getAngleToTarget(current.x, current.y, target.x, target.y));
        renderFigures();
        updateInspectorValues(current);
        playWoodClick(1.2);
        runSystemicAnalysis();
        saveToStorage();
      }
    });

    document.getElementById('btnActivatePov')?.addEventListener('click', () => {
      if (STATE.selectedFigureId) activatePovMode(STATE.selectedFigureId);
    });

    document.getElementById('btnExitPov')?.addEventListener('click', exitPovMode);

    const scaleSlider = document.getElementById('inspScaleSlider');
    if (scaleSlider) {
      scaleSlider.addEventListener('input', (e) => {
        const fig = getFigureById(STATE.selectedFigureId);
        if (fig) {
          fig.scale = parseInt(e.target.value, 10);
          document.getElementById('inspScaleValue').textContent = `${fig.scale} / 10`;
          renderFigures();
          runSystemicAnalysis();
          debounceSaveToStorage();
        }
      });
    }

    document.querySelectorAll('.insp-shape-select button').forEach(btn => {
      btn.addEventListener('click', () => {
        const fig = getFigureById(STATE.selectedFigureId);
        if (fig) {
          fig.shape = btn.getAttribute('data-shape');
          renderFigures();
          updateInspectorValues(fig);
          saveToStorage();
        }
      });
    });

    document.querySelectorAll('.insp-size-select button').forEach(btn => {
      btn.addEventListener('click', () => {
        const fig = getFigureById(STATE.selectedFigureId);
        if (fig) {
          fig.size = btn.getAttribute('data-size');
          renderFigures();
          updateInspectorValues(fig);
          saveToStorage();
        }
      });
    });

    document.querySelectorAll('#inspColorPicker .color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const fig = getFigureById(STATE.selectedFigureId);
        if (fig) {
          fig.color = dot.getAttribute('data-color');
          renderFigures();
          updateInspectorValues(fig);
          saveToStorage();
        }
      });
    });

    const inspNotes = document.getElementById('inspNotesInput');
    if (inspNotes) {
      inspNotes.addEventListener('input', (e) => {
        const fig = getFigureById(STATE.selectedFigureId);
        if (fig) {
          fig.notes = e.target.value;
          debounceSaveToStorage();
        }
      });
    }

    document.getElementById('btnDuplicateFigure')?.addEventListener('click', duplicateSelectedFigure);
    document.getElementById('btnDeleteFigure')?.addEventListener('click', deleteSelectedFigure);

    document.getElementById('btnNextQuestion')?.addEventListener('click', () => {
      const activeTag = document.querySelector('.tag-filter.active')?.getAttribute('data-qcat') || 'all';
      pickRandomQuestion(activeTag);
      playWoodClick(1.3);
    });

    document.querySelectorAll('.tag-filter').forEach(tag => {
      tag.addEventListener('click', () => {
        document.querySelectorAll('.tag-filter').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        pickRandomQuestion(tag.getAttribute('data-qcat'));
      });
    });

    document.getElementById('btnAddPhase')?.addEventListener('click', addPhase);
    document.getElementById('btnPlayPhases')?.addEventListener('click', playAllPhasesTimeline);

    const exportModal = document.getElementById('exportModal');
    document.getElementById('btnExportMenu')?.addEventListener('click', () => {
      if (exportModal) exportModal.style.display = 'flex';
    });

    document.getElementById('btnSaveSession')?.addEventListener('click', () => {
      if (exportModal) exportModal.style.display = 'flex';
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (exportModal) exportModal.style.display = 'none';
      });
    });

    document.getElementById('btnExportPng')?.addEventListener('click', () => {
      exportAsPng();
      if (exportModal) exportModal.style.display = 'none';
    });

    document.getElementById('btnExportJson')?.addEventListener('click', () => {
      exportAsJson();
      if (exportModal) exportModal.style.display = 'none';
    });

    const fileInput = document.getElementById('jsonFileInput');
    document.getElementById('btnLoadJsonTrigger')?.addEventListener('click', () => {
      if (fileInput) fileInput.click();
    });

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          importFromJson(e.target.files[0]);
          if (exportModal) exportModal.style.display = 'none';
        }
      });
    }

    document.getElementById('btnPrintReport')?.addEventListener('click', () => {
      if (exportModal) exportModal.style.display = 'none';
      printReport();
    });

    document.getElementById('btnExportProtocol')?.addEventListener('click', printReport);

    // Fokus-Modus
    document.getElementById('btnEnterFocus')?.addEventListener('click', enterFocusMode);
    document.getElementById('btnExitFocus')?.addEventListener('click', exitFocusMode);
    document.addEventListener('fullscreenchange', () => {
      // Vollbild wurde vom Browser beendet (z. B. durch Esc) -> Fokus-Modus ebenfalls beenden
      if (!document.fullscreenElement && STATE.focusMode) exitFocusMode();
    });

    // Sitzungsnotizen (Protokoll) automatisch speichern
    ['notesClientName', 'notesProblem', 'notesHypothesis', 'notesSolution'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        debounceSaveToStorage();
      });
    });

    // Sitzung vor Verlassen oder Neuladen der Seite absichern
    window.addEventListener('beforeunload', () => {
      saveToStorage();
    });
  }

  // ==========================================================================
  // 18. INITIALISIERUNG
  // ==========================================================================

  function init() {
    renderBoard();
    const restored = loadFromStorage();
    if (!restored) {
      loadTemplate('leer'); // Startet mit einem leeren, ganzen Brett, wenn noch keine Sitzung gespeichert ist
    }
    renderPhasesUI();
    setupInteractions();
    setupUiListeners();
    pickRandomQuestion('all');
    runSystemicAnalysis();
    updateSplitUI();
    initPalettePreviews();
    prepareBoardGrainImage();

    // Responsives Layout (Tablet ≤ 900 px, Handy ≤ 600 px)
    const scrim = document.createElement('div');
    scrim.id = 'drawerScrim';
    scrim.className = 'drawer-scrim';
    document.querySelector('.workspace-body').appendChild(scrim);
    scrim.addEventListener('pointerdown', () => { setSidebarCollapsed('left', true); setSidebarCollapsed('right', true); });
    if (compactMQ.addEventListener) {
      compactMQ.addEventListener('change', applyResponsiveLayout);
      phoneMQ.addEventListener('change', applyResponsiveLayout);
    }
    applyResponsiveLayout();
    // Audio darf auf Mobilgeräten erst nach einer Berührung starten
    ['touchend', 'click'].forEach(t => document.addEventListener(t, () => initAudio(), { once: true }));

    // Brett immer bildschirmfüllend: beim Start, bei Größenänderung und bei Ansichtswechsel
    fitToView(false);
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (STATE.povFigureId) applyPovCamera(false);
        else if (STATE.autoFit) fitToView(false);
      }).observe(boardViewportEl);
    }

    console.log('Virtuelles Systembrett erfolgreich initialisiert.' + (restored ? ' (Sitzung aus automatischem Speicher wiederhergestellt)' : ''));
  }

  window.addEventListener('DOMContentLoaded', init);

})();
