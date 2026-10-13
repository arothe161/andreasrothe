/**
 * VIRTUELLES SYSTEMBRETT
 * Systemische Aufstellungen & Coaching
 * 
 * Inspiriert und gestaltet nach dem Original "Systembrett - Der Klassiker"
 * von ideen.kollektiv (Echtholz, gewellte Trennlinie, gelaserte Randlinie & Augenfiguren).
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. STATE & KONFIGURATION
  // ==========================================================================

  const STATE = {
    sessionTitle: 'Ideen-Kollektiv - Systemische Aufstellung',
    boardType: 'ideen-kollektiv',   // 'ideen-kollektiv' | 'single' | 'round' | 'split'
    splitDistance: 0,               // DEFAULT: 0 mm = EIN GANZES ZUSAMMENHÄNGENDES BRETT!
    showLaserBorder: true,          // DEFAULT: true (gelaserte Randlinie wie DSC1833)
    woodType: 'buche-hell',         // DEFAULT: Helle Buche / Birke wie im Foto DSC1833
    viewMode: '2d',                 // '2d' | '25d'
    showCones: true,
    showSightLines: false,
    showGrid: false,
    soundEnabled: true,
    
    // Zoom & Pan
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

  // Brett-Abmessungen im SVG-Koordinatensystem (quadratisch wie in DSC1833)
  const BOARD_GEO = {
    cx: 800,
    cy: 600,
    width: 820,
    height: 820,
    radius: 390,
    halfWidth: 410,
    waveA: 65,         // Amplitude der geschwungenen Trennlinie
    laserInset: 28,    // Abstand der gelaserten Randlinie vom Rand
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
    } else if (STATE.boardType === 'ideen-kollektiv') {
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
        // Exakt abgestimmt auf das helle Buchenholz aus dem DSC1833 Foto
        return {
          base: '#f6ebd9',
          gradLeft: 'url(#birchGradLeft)',
          gradRight: 'url(#birchGradRight)',
          border: '#bfa17c',
          laser: '#6d4826',
          seam: '#7a542b'
        };
      case 'eiche':
        return {
          base: '#b48a56',
          gradLeft: '#c49a65',
          gradRight: '#b48a56',
          border: '#6c4b24',
          laser: '#4a2f13',
          seam: '#5c3a19'
        };
      case 'walnuss':
        return {
          base: '#5c3a21',
          gradLeft: '#6e4729',
          gradRight: '#5c3a21',
          border: '#2d1a0c',
          laser: '#1e1006',
          seam: '#2d1a0c'
        };
      case 'slate':
        return {
          base: '#334155',
          gradLeft: '#475569',
          gradRight: '#334155',
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

  function renderBoard() {
    const { cx, cy, width, height, radius, halfWidth, waveA, laserInset, cornerR } = BOARD_GEO;
    const colors = getWoodColors(STATE.woodType);
    boardGraphicsGroup.innerHTML = '';

    if (STATE.boardType === 'ideen-kollektiv') {
      // DAS ORIGINAL IDEEN-KOLLEKTIV BRETT (GEWELLTE TRENNLINIE & LASERRAND WIE DSC1833)
      const x_left = cx - width / 2;       // 390
      const x_right = cx + width / 2;      // 1210
      const y_top = cy - height / 2;       // 190
      const y_bottom = cy + height / 2;    // 1010
      const gap = STATE.splitDistance;     // 0 = vereint, >0 = getrennt

      const c1y = y_top + height * 0.22;
      const c2y = y_top + height * 0.38;
      const c3y = cy + height * 0.12;
      const c4y = cy + height * 0.28;

      const waveForward = `C ${cx - waveA},${c1y} ${cx - waveA},${c2y} ${cx},${cy} C ${cx + waveA},${c3y} ${cx + waveA},${c4y} ${cx},${y_bottom}`;
      const waveReverse = `C ${cx + waveA},${c4y} ${cx + waveA},${c3y} ${cx},${cy} C ${cx - waveA},${c2y} ${cx - waveA},${c1y} ${cx},${y_top}`;

      // 1. LINKE HÄLFTE PFAD
      const leftPath = `M ${cx},${y_top} ${waveForward} L ${x_left + cornerR},${y_bottom} A ${cornerR},${cornerR} 0 0,1 ${x_left},${y_bottom - cornerR} L ${x_left},${y_top + cornerR} A ${cornerR},${cornerR} 0 0,1 ${x_left + cornerR},${y_top} Z`;

      // 2. RECHTE HÄLFTE PFAD
      const rightPath = `M ${cx},${y_top} L ${x_right - cornerR},${y_top} A ${cornerR},${cornerR} 0 0,1 ${x_right},${y_top + cornerR} L ${x_right},${y_bottom - cornerR} A ${cornerR},${cornerR} 0 0,1 ${x_right - cornerR},${y_bottom} L ${cx},${y_bottom} ${waveReverse} Z`;

      // GELASERTE RANDLINIEN
      const lx_left = x_left + laserInset;
      const lx_right = x_right - laserInset;
      const ly_top = y_top + laserInset;
      const ly_bottom = y_bottom - laserInset;
      const lr = cornerR * 0.7;

      const leftLaserWave = `C ${cx - waveA - laserInset},${c1y} ${cx - waveA - laserInset},${c2y} ${cx - laserInset},${cy} C ${cx + waveA - laserInset},${c3y} ${cx + waveA - laserInset},${c4y} ${cx - laserInset},${ly_bottom}`;
      const leftLaserPath = `M ${cx - laserInset},${ly_top} ${leftLaserWave} L ${lx_left + lr},${ly_bottom} A ${lr},${lr} 0 0,1 ${lx_left},${ly_bottom - lr} L ${lx_left},${ly_top + lr} A ${lr},${lr} 0 0,1 ${lx_left + lr},${ly_top} Z`;

      const rightLaserWave = `C ${cx + waveA + laserInset},${c4y} ${cx + waveA + laserInset},${c3y} ${cx + laserInset},${cy} C ${cx - waveA + laserInset},${c2y} ${cx - waveA + laserInset},${c1y} ${cx + laserInset},${ly_top}`;
      const rightLaserPath = `M ${cx + laserInset},${ly_top} L ${lx_right - lr},${ly_top} A ${lr},${lr} 0 0,1 ${lx_right},${ly_top + lr} L ${lx_right},${ly_bottom - lr} A ${lr},${lr} 0 0,1 ${lx_right - lr},${ly_bottom} L ${cx + laserInset},${ly_bottom} ${rightLaserWave} Z`;

      // LINKE BRETTHÄLFTE
      const leftGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      leftGroup.setAttribute('transform', `translate(${-gap / 2}, 0)`);
      leftGroup.setAttribute('class', 'board-half-group');

      const leftShape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      leftShape.setAttribute('d', leftPath);
      leftShape.setAttribute('fill', colors.gradLeft || colors.base);
      leftShape.setAttribute('stroke', colors.border);
      leftShape.setAttribute('stroke-width', '4');
      leftShape.setAttribute('class', 'board-half');
      leftGroup.appendChild(leftShape);

      const leftGrain = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      leftGrain.setAttribute('d', leftPath);
      leftGrain.setAttribute('fill', 'url(#birchGrainOverlay)');
      leftGrain.setAttribute('pointer-events', 'none');
      leftGroup.appendChild(leftGrain);

      if (STATE.showLaserBorder) {
        const leftLaser = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        leftLaser.setAttribute('d', leftLaserPath);
        leftLaser.setAttribute('class', 'laser-border-line');
        leftLaser.setAttribute('stroke', colors.laser);
        leftGroup.appendChild(leftLaser);
      }

      boardGraphicsGroup.appendChild(leftGroup);

      // RECHTE BRETTHÄLFTE
      const rightGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      rightGroup.setAttribute('transform', `translate(${gap / 2}, 0)`);
      rightGroup.setAttribute('class', 'board-half-group');

      const rightShape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      rightShape.setAttribute('d', rightPath);
      rightShape.setAttribute('fill', colors.gradRight || colors.base);
      rightShape.setAttribute('stroke', colors.border);
      rightShape.setAttribute('stroke-width', '4');
      rightShape.setAttribute('class', 'board-half');
      rightGroup.appendChild(rightShape);

      const rightGrain = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      rightGrain.setAttribute('d', rightPath);
      rightGrain.setAttribute('fill', 'url(#birchGrainOverlay)');
      rightGrain.setAttribute('pointer-events', 'none');
      rightGroup.appendChild(rightGrain);

      if (STATE.showLaserBorder) {
        const rightLaser = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        rightLaser.setAttribute('d', rightLaserPath);
        rightLaser.setAttribute('class', 'laser-border-line');
        rightLaser.setAttribute('stroke', colors.laser);
        rightGroup.appendChild(rightLaser);
      }

      boardGraphicsGroup.appendChild(rightGroup);

      // NAHTSTELLE IN DER MITTE (WENN VEREINT ALS 1 BRETT)
      if (gap === 0) {
        const seam = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        seam.setAttribute('d', `M ${cx},${y_top} ${waveForward}`);
        seam.setAttribute('stroke', colors.seam || '#704928');
        seam.setAttribute('stroke-width', '1.4');
        seam.setAttribute('fill', 'none');
        seam.setAttribute('opacity', '0.7');
        seam.setAttribute('pointer-events', 'none');
        boardGraphicsGroup.appendChild(seam);
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
      boardGraphicsGroup.appendChild(leftHalf);

      const rightHalf = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rightHalf.setAttribute('x', rightX);
      rightHalf.setAttribute('y', boardY);
      rightHalf.setAttribute('width', halfWidth);
      rightHalf.setAttribute('height', height);
      rightHalf.setAttribute('rx', 18);
      rightHalf.setAttribute('fill', colors.base);
      rightHalf.setAttribute('stroke', colors.border);
      rightHalf.setAttribute('stroke-width', '6');
      boardGraphicsGroup.appendChild(rightHalf);
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
  // 5. FIGUREN RENDERN & DESIGN (PEG DOLLS MIT AUFGEMALTEN AUGEN WIE DSC1833)
  // ==========================================================================

  function renderFigures() {
    figuresGroup.innerHTML = '';
    controlsOverlayGroup.innerHTML = '';
    sightConesGroup.innerHTML = '';
    sightLinesGroup.innerHTML = '';

    const phase = getCurrentPhase();
    if (!phase) return;

    if (STATE.showCones) {
      phase.figures.forEach(fig => renderVisionCone(fig));
    }

    if (STATE.showSightLines) {
      renderSightLines(phase.figures);
    }

    phase.figures.forEach(fig => {
      const g = createFigureSvgElement(fig);
      figuresGroup.appendChild(g);

      if (fig.id === STATE.selectedFigureId) {
        renderFigureControls(fig);
      }
    });

    renderRelationships();
    updateSessionMeta();
  }

  function createFigureSvgElement(fig) {
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

    // AUTHENTISCHE FIGUREN AUS DEM IDEEN-KOLLEKTIV SET (DSC1833)
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
      renderSymbolFigure(rotGroup, fig.shape, sizePx, fillColor, strokeColor);
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
    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', 0);
    labelText.setAttribute('y', sizePx + 16);
    labelText.setAttribute('class', 'figure-label-text');
    labelText.textContent = fig.name || 'Figur';
    g.appendChild(labelText);

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

      g.appendChild(scaleBadge);
    }

    return g;
  }

  function isSymbolShape(shape) {
    return ['stern', 'herz', 'diamant', 'stein', 'wolke', 'kiste', 'anker', 'fragezeichen', 'barriere', 'licht'].includes(shape);
  }

  function renderSymbolFigure(parent, shape, sizePx, fill, stroke) {
    const s = sizePx;
    let emoji = '⭐';
    switch (shape) {
      case 'stern': emoji = '⭐'; break;
      case 'herz': emoji = '❤️'; break;
      case 'diamant': emoji = '💎'; break;
      case 'stein': emoji = '🪨'; break;
      case 'wolke': emoji = '⚡'; break;
      case 'kiste': emoji = '📦'; break;
      case 'anker': emoji = '⚓'; break;
      case 'fragezeichen': emoji = '❓'; break;
      case 'barriere': emoji = '🚧'; break;
      case 'licht': emoji = '💡'; break;
    }

    const base = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    base.setAttribute('cx', 0);
    base.setAttribute('cy', 0);
    base.setAttribute('r', s);
    base.setAttribute('fill', fill);
    base.setAttribute('stroke', stroke);
    base.setAttribute('stroke-width', '2');
    base.setAttribute('class', 'fig-body');
    parent.appendChild(base);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', 0);
    text.setAttribute('y', s * 0.35);
    text.setAttribute('font-size', s * 1.1);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('pointer-events', 'none');
    text.textContent = emoji;
    parent.appendChild(text);

    const notch = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    notch.setAttribute('points', `0,${-s + 8} -4,${-s} 4,${-s}`);
    notch.setAttribute('fill', '#1a1006');
    parent.appendChild(notch);
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

    const handleLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    handleLine.setAttribute('x1', fig.x);
    handleLine.setAttribute('y1', fig.y);
    handleLine.setAttribute('x2', hx);
    handleLine.setAttribute('y2', hy);
    handleLine.setAttribute('stroke', 'rgba(194, 149, 93, 0.7)');
    handleLine.setAttribute('stroke-width', '1.5');
    controlsOverlayGroup.insertBefore(handleLine, knob);
  }

  // ==========================================================================
  // 7. BEZIEHUNGSBÄNDER & KORDELN
  // ==========================================================================

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

      switch (rel.type) {
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
          path.setAttribute('stroke', rel.color || '#c2955d');
          path.setAttribute('stroke-width', '3');
          path.setAttribute('stroke-linecap', 'round');
          break;
      }

      path.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Dieses Beziehungsband entfernen?')) {
          phase.relations.splice(index, 1);
          renderFigures();
          updateRelationUIList();
          playWoodClick(0.8);
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
      });
      list.appendChild(row);
    });
  }

  // ==========================================================================
  // 8. INTERAKTIONS-HANDLER (DRAG, ROTATE, ZOOM, PAN)
  // ==========================================================================

  function getSvgPoint(evt) {
    const pt = svgElem.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svgElem.getScreenCTM().inverse());
  }

  function setupInteractions() {
    const viewport = document.getElementById('boardViewport');

    svgElem.addEventListener('mousedown', (e) => {
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
        STATE.isPanning = true;
        STATE.startPanX = e.clientX - STATE.panX;
        STATE.startPanY = e.clientY - STATE.panY;
      }
    });

    window.addEventListener('mousemove', (e) => {
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

      if (STATE.isPanning) {
        STATE.panX = e.clientX - STATE.startPanX;
        STATE.panY = e.clientY - STATE.startPanY;
        updateTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      if (STATE.draggingFigureId) {
        playWoodClick(1.0);
        STATE.draggingFigureId = null;
        updateInspectorValues(getFigureById(STATE.selectedFigureId));
        runSystemicAnalysis();
      }
      if (STATE.rotatingFigureId) {
        playWoodClick(1.2);
        STATE.rotatingFigureId = null;
        runSystemicAnalysis();
      }
      STATE.isPanning = false;
    });

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

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(2.5, Math.max(0.4, STATE.zoom * zoomFactor));
      STATE.zoom = newZoom;
      updateTransform();
      document.getElementById('zoomLevel').textContent = `${Math.round(STATE.zoom * 100)}%`;
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

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
          }
        }
      }

      if (e.key === 'Escape') {
        cancelRelationMode();
        exitPovMode();
      }
    });
  }

  function updateTransform() {
    const container = document.getElementById('boardTransform');
    if (!container) return;
    if (STATE.viewMode === '25d') {
      container.style.transform = `translate(calc(-50% + ${STATE.panX}px), calc(-50% + ${STATE.panY}px)) rotateX(46deg) rotateZ(-16deg) scale(${STATE.zoom * 0.9})`;
    } else {
      container.style.transform = `translate(calc(-50% + ${STATE.panX}px), calc(-50% + ${STATE.panY}px)) scale(${STATE.zoom})`;
    }
  }

  function resetZoomAndPan() {
    STATE.zoom = 1.0;
    STATE.panX = 0;
    STATE.panY = 0;
    updateTransform();
    document.getElementById('zoomLevel').textContent = '100%';
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

  function addFigure(config = {}) {
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
      x: config.x || (BOARD_GEO.cx + scatterX),
      y: config.y || (BOARD_GEO.cy + scatterY)
    };

    phase.figures.push(newFig);
    selectFigure(newFig.id);
    renderFigures();
    playWoodClick(0.9);
    runSystemicAnalysis();
    return newFig;
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

  function activatePovMode(figId) {
    const fig = getFigureById(figId);
    if (!fig) return;

    STATE.povFigureId = figId;
    const banner = document.getElementById('povBanner');
    const text = document.getElementById('povText');
    if (banner && text) {
      text.innerHTML = `Blick aus den Augen von: <strong>${escapeHtml(fig.name)}</strong>`;
      banner.style.display = 'flex';
    }

    renderFigures();
    playWoodClick(1.3);
  }

  function exitPovMode() {
    STATE.povFigureId = null;
    const banner = document.getElementById('povBanner');
    if (banner) banner.style.display = 'none';
    renderFigures();
  }

  function startRelationMode(type, color) {
    STATE.activeRelationMode = type;
    STATE.activeRelationColor = color;
    STATE.relationFirstFigureId = null;

    const banner = document.getElementById('relationActiveBanner');
    const text = document.getElementById('relationModeText');
    if (banner && text) {
      text.textContent = '1. Klicke auf die erste Figur...';
      banner.style.display = 'flex';
    }

    document.querySelectorAll('.relation-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-relation-type') === type);
    });
  }

  function cancelRelationMode() {
    STATE.activeRelationMode = null;
    STATE.relationFirstFigureId = null;
    const banner = document.getElementById('relationActiveBanner');
    if (banner) banner.style.display = 'none';

    document.querySelectorAll('.relation-mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  function handleRelationClick(figId) {
    if (!STATE.relationFirstFigureId) {
      STATE.relationFirstFigureId = figId;
      const f1 = getFigureById(figId);
      const text = document.getElementById('relationModeText');
      if (text) text.textContent = `2. Klicke auf zweite Figur (Start: ${f1 ? f1.name : ''})...`;
      playWoodClick(1.2);
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
    }
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
  // 15. VORLAGEN (TEMPLATES - INKL. ORIGINAL DSC1833 SETUP)
  // ==========================================================================

  function loadTemplate(templateId) {
    const phase = getCurrentPhase();
    if (!phase) return;

    phase.figures = [];
    phase.relations = [];

    const { cx, cy } = BOARD_GEO;

    switch (templateId) {
      case 'ideen-kollektiv':
      default:
        // EXAKTES SETUP WIE AUF DEM PRODUKTFOTO DSC1833 (DEFAULT: 1 GANZES BRETT)
        STATE.boardType = 'ideen-kollektiv';
        STATE.splitDistance = 0; // DEFAULT = 0 mm (1 ganzes Brett!)
        STATE.woodType = 'buche-hell';
        STATE.showLaserBorder = true;

        phase.figures = [
          // LINKE HÄLFTE: FARBIGE SPIELFIGUREN (OBEN LINKS WIE IM FOTO)
          { id: 'c_red1', name: 'Rot 1', shape: 'kegel', size: 'gross', color: '#c0392b', rotation: 180, scale: 6, x: cx - 280, y: cy - 250 },
          { id: 'c_red2', name: 'Rot 2', shape: 'kegel', size: 'gross', color: '#c0392b', rotation: 180, scale: 6, x: cx - 245, y: cy - 235 },
          { id: 'c_blue1', name: 'Blau 1', shape: 'kegel', size: 'mittel', color: '#2980b9', rotation: 180, scale: 7, x: cx - 265, y: cy - 290 },
          { id: 'c_blue2', name: 'Blau 2', shape: 'kegel', size: 'mittel', color: '#2980b9', rotation: 180, scale: 7, x: cx - 230, y: cy - 290 },
          { id: 'c_green1', name: 'Grün 1', shape: 'kegel', size: 'mittel', color: '#27ae60', rotation: 180, scale: 8, x: cx - 195, y: cy - 285 },
          { id: 'c_black', name: 'Schwarz', shape: 'kegel', size: 'mittel', color: '#1a1a1a', rotation: 180, scale: 4, x: cx - 210, y: cy - 240 },
          { id: 'c_white', name: 'Weiß', shape: 'kegel', size: 'mittel', color: '#f4f4f4', rotation: 180, scale: 7, x: cx - 170, y: cy - 250 },

          // LINKE HÄLFTE: HOLZ-ZYLINDER MIT AUGEN (MITTE LINKS)
          { id: 'z1', name: 'Zylinder A', shape: 'zylinder', size: 'gross', color: 'wood-light', rotation: 180, scale: 6, x: cx - 180, y: cy - 80 },
          { id: 'z2', name: 'Zylinder B', shape: 'zylinder', size: 'gross', color: 'wood-light', rotation: 180, scale: 6, x: cx - 130, y: cy - 90 },
          { id: 'z3', name: 'Zylinder C', shape: 'zylinder', size: 'gross', color: 'wood-light', rotation: 180, scale: 6, x: cx - 75, y: cy - 80 },
          { id: 'z4', name: 'Zylinder D', shape: 'zylinder', size: 'mittel', color: 'wood-light', rotation: 180, scale: 5, x: cx - 150, y: cy - 30 },
          { id: 'z5', name: 'Zylinder E', shape: 'zylinder', size: 'mittel', color: 'wood-light', rotation: 180, scale: 5, x: cx - 95, y: cy - 30 },

          // LINKE HÄLFTE UNTEN: 2 KINDER-MINI-KEGEL & 2 SÄULEN
          { id: 'k_mini1', name: 'Kind 1', shape: 'kegel', size: 'klein', color: 'wood-light', rotation: 0, scale: 7, x: cx - 95, y: cy + 190 },
          { id: 'k_mini2', name: 'Kind 2', shape: 'kegel', size: 'klein', color: 'wood-light', rotation: 0, scale: 7, x: cx - 55, y: cy + 200 },
          { id: 'b_col1', name: 'Säule 1', shape: 'block', size: 'mittel', color: 'wood-light', rotation: 90, scale: 5, x: cx - 25, y: cy + 180 },
          { id: 'b_col2', name: 'Säule 2', shape: 'block', size: 'mittel', color: 'wood-light', rotation: 90, scale: 5, x: cx + 5, y: cy + 185 },

          // RECHTE HÄLFTE OBEN: 3 GROSSE NATURHOLZ-KEGELFIGUREN (MIT AUGEN ••)
          { id: 't_tall1', name: 'Erwachsene 1', shape: 'kegel', size: 'gross', color: 'wood-light', rotation: 180, scale: 7, x: cx + 60, y: cy - 290 },
          { id: 't_tall2', name: 'Erwachsene 2', shape: 'kegel', size: 'gross', color: 'wood-light', rotation: 180, scale: 8, x: cx + 110, y: cy - 280 },
          { id: 't_tall3', name: 'Erwachsene 3', shape: 'kegel', size: 'gross', color: 'wood-light', rotation: 180, scale: 7, x: cx + 155, y: cy - 290 },

          // RECHTE HÄLFTE MITTE: 6 MITTLERE KEGELFIGUREN MIT AUGEN
          { id: 'm1', name: 'Figur 1', shape: 'kegel', size: 'mittel', color: 'wood-light', rotation: 180, scale: 6, x: cx + 110, y: cy - 60 },
          { id: 'm2', name: 'Figur 2', shape: 'kegel', size: 'mittel', color: 'wood-light', rotation: 180, scale: 6, x: cx + 150, y: cy - 70 },
          { id: 'm3', name: 'Figur 3', shape: 'kegel', size: 'mittel', color: 'wood-light', rotation: 180, scale: 6, x: cx + 180, y: cy - 50 },
          { id: 'm4', name: 'Figur 4', shape: 'kegel', size: 'mittel', color: 'wood-light', rotation: 180, scale: 6, x: cx + 225, y: cy - 65 },
          { id: 'm5', name: 'Figur 5', shape: 'kegel', size: 'mittel', color: 'wood-light', rotation: 180, scale: 6, x: cx + 265, y: cy - 75 },
          { id: 'm6', name: 'Figur 6', shape: 'kegel', size: 'mittel', color: 'wood-light', rotation: 180, scale: 6, x: cx + 310, y: cy - 60 },

          // RECHTE HÄLFTE UNTEN: 2 HOLZKLÖTZCHEN
          { id: 'block_r1', name: 'Klötzchen 1', shape: 'block', size: 'mittel', color: 'wood-light', rotation: 0, scale: 5, x: cx + 240, y: cy + 130 },
          { id: 'block_r2', name: 'Klötzchen 2', shape: 'block', size: 'mittel', color: 'wood-light', rotation: 0, scale: 5, x: cx + 290, y: cy + 120 }
        ];

        phase.relations = [
          // Rote Verbindungskordel (wie im Foto)
          { fromId: 'c_red1', toId: 'c_red2', type: 'solid', color: '#c0392b' }
        ];
        break;

      case 'herkunftsfamilie':
        STATE.boardType = 'ideen-kollektiv';
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
        STATE.boardType = 'ideen-kollektiv';
        STATE.splitDistance = 50; // Bei Patchwork leicht geöffnet
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
        STATE.boardType = 'ideen-kollektiv';
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
        STATE.boardType = 'ideen-kollektiv';
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
        STATE.boardType = 'ideen-kollektiv';
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
        STATE.boardType = 'ideen-kollektiv';
        STATE.splitDistance = 40;
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

      case 'leer':
        break;
    }

    updateSplitUI();
    renderBoard();
    renderFigures();
    playWoodClick(1.0);
    runSystemicAnalysis();
  }

  // ==========================================================================
  // 16. EXPORT, JSON SPEICHERN / LADEN & DRUCK
  // ==========================================================================

  function exportAsPng() {
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgElem);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1e1f24';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '14px sans-serif';
      ctx.fillText(`${STATE.sessionTitle} • Phase: ${getCurrentPhase().name} • ${new Date().toLocaleDateString('de-DE')}`, 30, 1170);

      URL.revokeObjectURL(blobURL);

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.download = `Systembrett_${sanitizeFilename(STATE.sessionTitle)}_${Date.now()}.png`;
      a.href = pngUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
        STATE.boardType = data.boardType || 'ideen-kollektiv';
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
        alert('Aufstellung erfolgreich geladen!');
      } catch (err) {
        alert('Fehler beim Einlesen der Datei: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function printReport() {
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgElem);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

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
      URL.revokeObjectURL(blobURL);
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

  function setupUiListeners() {
    const titleInput = document.getElementById('sessionTitle');
    if (titleInput) {
      titleInput.addEventListener('change', (e) => {
        STATE.sessionTitle = e.target.value.trim() || 'Neue Aufstellung';
      });
    }

    // 1-BRETT / TRENNUNG UMSCHALTER (PROMINENT IM HEADER)
    document.getElementById('btnToggleSplit')?.addEventListener('click', toggleBoardSplit);
    document.getElementById('btnSetUnified')?.addEventListener('click', setBoardUnified);
    document.getElementById('btnSetSplit')?.addEventListener('click', setBoardSplit);

    // View-Modes
    document.getElementById('btnView2D')?.addEventListener('click', () => {
      STATE.viewMode = '2d';
      document.body.classList.remove('view-25d');
      document.getElementById('btnView2D').classList.add('active');
      document.getElementById('btnView25D').classList.remove('active');
      updateTransform();
      playWoodClick(1.0);
    });

    document.getElementById('btnView25D')?.addEventListener('click', () => {
      STATE.viewMode = '25d';
      document.body.classList.add('view-25d');
      document.getElementById('btnView25D').classList.add('active');
      document.getElementById('btnView2D').classList.remove('active');
      updateTransform();
      playWoodClick(1.0);
    });

    // Overlays
    document.getElementById('btnToggleCones')?.addEventListener('click', (e) => {
      STATE.showCones = !STATE.showCones;
      e.currentTarget.classList.toggle('active', STATE.showCones);
      renderFigures();
    });

    document.getElementById('btnToggleSightLines')?.addEventListener('click', (e) => {
      STATE.showSightLines = !STATE.showSightLines;
      e.currentTarget.classList.toggle('active', STATE.showSightLines);
      renderFigures();
    });

    document.getElementById('btnToggleGrid')?.addEventListener('click', (e) => {
      STATE.showGrid = !STATE.showGrid;
      e.currentTarget.classList.toggle('active', STATE.showGrid);
      renderGrid();
    });

    // Sound
    document.getElementById('btnSoundToggle')?.addEventListener('click', () => {
      STATE.soundEnabled = !STATE.soundEnabled;
      document.getElementById('soundIconOn').style.display = STATE.soundEnabled ? 'block' : 'none';
      document.getElementById('soundIconOff').style.display = STATE.soundEnabled ? 'none' : 'block';
      if (STATE.soundEnabled) playWoodClick(1.1);
    });

    // Zoom
    document.getElementById('btnZoomIn')?.addEventListener('click', () => {
      STATE.zoom = Math.min(2.5, STATE.zoom + 0.15);
      updateTransform();
      document.getElementById('zoomLevel').textContent = `${Math.round(STATE.zoom * 100)}%`;
    });

    document.getElementById('btnZoomOut')?.addEventListener('click', () => {
      STATE.zoom = Math.max(0.4, STATE.zoom - 0.15);
      updateTransform();
      document.getElementById('zoomLevel').textContent = `${Math.round(STATE.zoom * 100)}%`;
    });

    document.getElementById('btnCenterBoard')?.addEventListener('click', resetZoomAndPan);
    document.getElementById('btnZoomReset')?.addEventListener('click', resetZoomAndPan);

    // Sidebar Tabs
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

    // Schnell-Figuren Button Klick (linke Leiste - DSC1833 Set)
    document.querySelectorAll('.quick-figure-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-create');
        if (type === 'kegel-gross-holz') addFigure({ shape: 'kegel', size: 'gross', color: 'wood-light', name: 'Kegel Groß' });
        else if (type === 'kegel-mittel-holz') addFigure({ shape: 'kegel', size: 'mittel', color: 'wood-light', name: 'Kegel Mittel' });
        else if (type === 'kegel-klein-holz') addFigure({ shape: 'kegel', size: 'klein', color: 'wood-light', name: 'Kind / Klein' });
        else if (type === 'zylinder-gross-holz') addFigure({ shape: 'zylinder', size: 'gross', color: 'wood-light', name: 'Zylinder Groß' });
        else if (type === 'zylinder-mittel-holz') addFigure({ shape: 'zylinder', size: 'mittel', color: 'wood-light', name: 'Zylinder Mittel' });
        else if (type === 'kloetzchen-holz') addFigure({ shape: 'block', size: 'mittel', color: 'wood-light', name: 'Holzklötzchen' });
        else if (type === 'kegel-rot') addFigure({ shape: 'kegel', size: 'mittel', color: '#c0392b', name: 'Rot' });
        else if (type === 'kegel-blau') addFigure({ shape: 'kegel', size: 'mittel', color: '#2980b9', name: 'Blau' });
        else if (type === 'kegel-gruen') addFigure({ shape: 'kegel', size: 'mittel', color: '#27ae60', name: 'Grün' });
        else if (type === 'kegel-schwarz') addFigure({ shape: 'kegel', size: 'mittel', color: '#1a1a1a', name: 'Schwarz' });
        else if (type === 'kegel-weiss') addFigure({ shape: 'kegel', size: 'mittel', color: '#f4f4f4', name: 'Weiß' });
        else if (type === 'eckig-gross-holz') addFigure({ shape: 'eckig', size: 'gross', color: 'wood-light', name: 'Eckig Groß' });
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
        const sym = btn.getAttribute('data-create-symbol');
        const color = btn.getAttribute('data-color');
        const name = btn.querySelector('.symbol-name').textContent;
        addFigure({
          name: name,
          shape: sym,
          size: 'mittel',
          color: color
        });
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
      });
    });

    // Brett Einstellungen
    document.querySelectorAll('.board-shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.board-shape-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.boardType = btn.getAttribute('data-shape');
        const canSplit = STATE.boardType === 'ideen-kollektiv' || STATE.boardType === 'split';
        document.getElementById('splitDistanceGroup').style.display = canSplit ? 'block' : 'none';
        renderBoard();
        playWoodClick(1.0);
      });
    });

    const splitSlider = document.getElementById('splitDistanceSlider');
    if (splitSlider) {
      splitSlider.addEventListener('input', (e) => {
        STATE.splitDistance = parseInt(e.target.value, 10);
        updateSplitUI();
        renderBoard();
      });
    }

    const checkLaser = document.getElementById('checkLaserBorder');
    if (checkLaser) {
      checkLaser.addEventListener('change', (e) => {
        STATE.showLaserBorder = e.target.checked;
        renderBoard();
      });
    }

    document.querySelectorAll('.wood-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.wood-choice').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.woodType = btn.getAttribute('data-wood');
        renderBoard();
        playWoodClick(1.1);
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
        }
      });
    });

    const inspNotes = document.getElementById('inspNotesInput');
    if (inspNotes) {
      inspNotes.addEventListener('input', (e) => {
        const fig = getFigureById(STATE.selectedFigureId);
        if (fig) fig.notes = e.target.value;
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
  }

  // ==========================================================================
  // 18. INITIALISIERUNG
  // ==========================================================================

  function init() {
    renderBoard();
    loadTemplate('ideen-kollektiv'); // Lädt standardmäßig das authentische DSC1833 Set als 1 ganzes Brett
    renderPhasesUI();
    setupInteractions();
    setupUiListeners();
    pickRandomQuestion('all');
    runSystemicAnalysis();
    resetZoomAndPan();
    updateSplitUI();

    console.log('Virtuelles Systembrett (Ideen-Kollektiv Style) erfolgreich initialisiert.');
  }

  window.addEventListener('DOMContentLoaded', init);

})();
