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
    rotStart: null,
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
    g.setAttribute('fill', '#000');
    g.setAttribute('filter', 'url(#woodGrainTex)');
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

    phase.figures.forEach(fig => {
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
    return clientToBoard(evt.clientX, evt.clientY);
  }

  function setupInteractions() {
    const viewport = document.getElementById('boardViewport');

    svgElem.addEventListener('mousedown', (e) => {
      initAudio();
      const svgPt = getSvgPoint(e);

      const viewHandle = e.target.closest('[data-view-handle]');
      if (viewHandle) {
        e.stopPropagation();
        e.preventDefault();
        startCornerRotate(e);
        return;
      }

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
    viewport.addEventListener('mousedown', (e) => {
      if (e.target === viewport || e.target.id === 'boardTransform') {
        initAudio();
        selectFigure(null);
        startViewDrag(e);
      }
    });

    // Freie Fläche ziehen: Brett verschieben
    function startViewDrag(e) {
      STATE.isPanning = true;
      STATE.startPanX = e.clientX - STATE.panX;
      STATE.startPanY = e.clientY - STATE.panY;
    }

    // 3D: An einer Brett-Ecke anfassen und ziehen dreht das Brett
    function startCornerRotate(e) {
      const pt = clientToBoard(e.clientX, e.clientY);
      STATE.isRotatingView = true;
      STATE.rotStart = { a0: Math.atan2(pt.y - BOARD_GEO.cy, pt.x - BOARD_GEO.cx) * 180 / Math.PI };
      boardTransformEl.classList.add('no-transition');
      document.body.classList.add('view-rotating');
    }

    // Doppelklick auf freie Fläche: Ausgangsansicht der 3D-Perspektive
    svgElem.addEventListener('dblclick', (e) => {
      if (STATE.viewMode !== '25d') return;
      if (e.target.id === 'outerSpace' || e.target.classList.contains('board-half') || e.target.id === 'boardSvg') {
        STATE.viewYaw = -16;
        STATE.viewTilt = 46;
        fitToView(true);
      }
    });

    viewport.addEventListener('contextmenu', (e) => {
      if (STATE.viewMode === '25d') e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
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
        // Die gegriffene Ecke bleibt unter dem Mauszeiger: Winkelunterschied in der Brettebene
        const pt = clientToBoard(e.clientX, e.clientY);
        const a = Math.atan2(pt.y - BOARD_GEO.cy, pt.x - BOARD_GEO.cx) * 180 / Math.PI;
        const d = ((a - STATE.rotStart.a0 + 540) % 360) - 180;
        STATE.viewYaw += d;
        if (STATE.autoFit) fitToView(false);   // Brett bleibt dabei bildschirmfüllend
        else updateTransform();
        return;
      }

      if (STATE.isPanning) {
        STATE.autoFit = false;
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
        if (STATE.povFigureId) applyPovCamera(true);
      }
      STATE.isPanning = false;
      STATE.isRotatingView = false;
      STATE.rotStart = null;
      boardTransformEl.classList.remove('no-transition');
      document.body.classList.remove('view-rotating');
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

      const unit = e.deltaMode === 1 ? 33 : 1;   // Zeilen- statt Pixel-Scrollen (Firefox)
      const dY = e.deltaY * unit;
      const dX = e.deltaX * unit;

      // Pinch-Geste am Trackpad (oder Strg + Mausrad): Zoom
      if (e.ctrlKey) {
        STATE.autoFit = false;
        STATE.zoom = clamp(STATE.zoom * Math.exp(clamp(-dY * 0.01, -0.25, 0.25)), MIN_ZOOM, MAX_ZOOM);
        updateTransform();
        return;
      }

      // 3D: Mausrad / Zwei-Finger-Scrollen ändert den Blickwinkel (seitlich: Drehung)
      if (STATE.viewMode === '25d' && !STATE.povFigureId) {
        STATE.viewTilt = clamp(STATE.viewTilt + dY * 0.12, 10, 75);
        STATE.viewYaw += dX * 0.25;
        if (STATE.autoFit) fitToView(false);
        else updateTransform();
        return;
      }

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      STATE.autoFit = false;
      STATE.zoom = clamp(STATE.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
      updateTransform();
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
        if (STATE.focusMode) {
          e.preventDefault();
          exitFocusMode();
          return;
        }
        if (STATE.selectedFigureId) {
          selectFigure(null);
        }
        return;
      }

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

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
    return `translate(calc(-50% + ${STATE.panX}px), calc(-50% + ${STATE.panY}px)) rotateX(${tilt}deg) rotateZ(${rotZ}deg) scale(${STATE.zoom})`;
  }

  function updateZoomLabel() {
    const label = document.getElementById('zoomLevel');
    if (label) label.textContent = `${Math.round(STATE.zoom * 100)}%`;
  }

  // Eck-Griffe zum Drehen (nur in der 3D-Ansicht)
  const viewHandlesGroup = svgEl('g', { id: 'viewHandlesGroup' });
  svgElem.appendChild(viewHandlesGroup);

  function renderViewHandles() {
    viewHandlesGroup.innerHTML = '';
    if (STATE.viewMode !== '25d' || STATE.povFigureId) return;

    const b = getBoardBounds();
    const r = clamp(19 / STATE.zoom, 14, 38);     // bleibt auf dem Bildschirm etwa gleich groß
    const off = r * 0.55;
    const corners = [
      [b.x - off, b.y - off], [b.x + b.w + off, b.y - off],
      [b.x + b.w + off, b.y + b.h + off], [b.x - off, b.y + b.h + off]
    ];
    corners.forEach(([x, y]) => {
      const g = svgEl('g', { transform: `translate(${x}, ${y})`, 'data-view-handle': '1', class: 'view-handle' });
      const title = svgEl('title', {});
      title.textContent = 'Ecke ziehen: Brett drehen';
      g.appendChild(title);
      g.appendChild(svgEl('circle', { r: r, fill: 'rgba(255,255,255,0.92)', stroke: '#b9803f', 'stroke-width': r * 0.14 }));
      // Dreh-Symbol (Kreisbogen mit Pfeilspitze)
      const k = r * 0.52;
      g.appendChild(svgEl('path', {
        d: `M ${-k},${-k * 0.1} A ${k},${k} 0 1 1 ${k * 0.15},${k}`,
        fill: 'none', stroke: '#7a4a1c', 'stroke-width': r * 0.16, 'stroke-linecap': 'round'
      }));
      g.appendChild(svgEl('path', {
        d: `M ${k * 0.15 - r * 0.3},${k - r * 0.3} L ${k * 0.15 + r * 0.05},${k + r * 0.05} L ${k * 0.15 - r * 0.38},${k + r * 0.3}`,
        fill: 'none', stroke: '#7a4a1c', 'stroke-width': r * 0.16, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
      viewHandlesGroup.appendChild(g);
    });
  }

  function updateTransform() {
    if (!boardTransformEl) return;
    boardTransformEl.style.transform = buildTransformString();
    updateZoomLabel();
    renderViewHandles();
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
    const pad = (STATE.viewMode === '25d' && !STATE.povFigureId) ? 46 : 10;   // in 3D Platz für die Eck-Griffe
    boardFitProxy.style.left = (b.x - pad) + 'px';
    boardFitProxy.style.top = (b.y - pad) + 'px';
    boardFitProxy.style.width = (b.w + pad * 2) + 'px';
    boardFitProxy.style.height = (b.h + pad * 2) + 'px';
  }

  // Passt das Brett so ein, dass es in jeder Ansicht (2D / 3D) den Bildschirm füllt und zentriert ist.
  // Gemessen wird die tatsächlich projizierte Fläche, daher funktioniert es auch mit Perspektive.
  function fitToView(animate) {
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
    renderViewHandles();

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
    renderViewHandles();
    document.getElementById('btnView2D')?.classList.toggle('active', mode === '2d');
    document.getElementById('btnView25D')?.classList.toggle('active', mode === '25d');
    if (!opts.skipFit) fitToView(true);
    if (!opts.silent) playWoodClick(1.0);
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

  function clientToBoard(clientX, clientY) {
    const cs = getComputedStyle(boardTransformEl);
    const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform);
    const vr = boardViewportEl.getBoundingClientRect();
    const persp = parseFloat(getComputedStyle(boardViewportEl).perspective) || 1e9;
    const ox = CONTAINER_W / 2;
    const oy = CONTAINER_H / 2;

    const forward = (lx, ly) => {
      const x = lx - ox;
      const y = ly - oy;
      const X = m.m11 * x + m.m21 * y + m.m41;
      const Y = m.m12 * x + m.m22 * y + m.m42;
      const Z = m.m13 * x + m.m23 * y + m.m43;
      const k = persp / (persp - Z);
      return [vr.left + vr.width / 2 + (ox + X) * k, vr.top + vr.height / 2 + (oy + Y) * k];
    };

    const src = [[0, 0], [CONTAINER_W, 0], [CONTAINER_W, CONTAINER_H], [0, CONTAINER_H]];
    const dst = src.map(p => forward(p[0], p[1]));
    const H = solveHomography(src, dst);
    const inv = invert3(H);
    const w = inv[6] * clientX + inv[7] * clientY + inv[8];
    return {
      x: (inv[0] * clientX + inv[1] * clientY + inv[2]) / w,
      y: (inv[3] * clientX + inv[4] * clientY + inv[5]) / w
    };
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
    return newFig;
  }

  // Inspektor liegt über dem linken Menü, solange eine Figur ausgewählt ist
  let lastInspectorFigId = null;

  function syncInspectorOverlay() {
    const left = document.getElementById('sidebarLeft');
    if (!left) return;
    const has = !!getFigureById(STATE.selectedFigureId);
    left.classList.toggle('inspector-open', has);
    // Ist das Menü eingeklappt, wird es für den Inspektor automatisch geöffnet
    if (has && lastInspectorFigId !== STATE.selectedFigureId && left.classList.contains('collapsed')) {
      setSidebarCollapsed('left', false);
    }
    lastInspectorFigId = has ? STATE.selectedFigureId : null;
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

  function startRelationMode(type, color) {
    STATE.activeRelationMode = type;
    STATE.activeRelationColor = color;
    STATE.relationFirstFigureId = null;
    document.body.classList.add('relation-mode');

    const banner = document.getElementById('relationActiveBanner');
    const text = document.getElementById('relationModeText');
    if (banner && text) {
      text.textContent = '1. Klicke auf die erste Figur…  (Esc bricht ab)';
      banner.style.display = 'flex';
    }

    document.querySelectorAll('.relation-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-relation-type') === type && btn.getAttribute('data-color') === color);
    });
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
  }

  function handleRelationClick(figId) {
    if (!STATE.relationFirstFigureId) {
      STATE.relationFirstFigureId = figId;
      const f1 = getFigureById(figId);
      const text = document.getElementById('relationModeText');
      if (text) text.textContent = `2. Ziehe die Linie zur Zielfigur und klicke sie an (Start: ${f1 ? f1.name : ''}) – Esc bricht ab`;
      playWoodClick(1.2);
      updateRubberband();
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

  // ---- Fokus-Modus (Vollbild: nur Brett und Notizen) -------------------------

  function enterFocusMode() {
    if (STATE.focusMode) return;
    STATE.focusMode = true;
    document.body.classList.add('focus-mode');

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
    const clone = svgElem.cloneNode(true);

    ['controlsOverlayGroup', 'rubberbandGroup', 'viewHandlesGroup'].forEach(id => {
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
        alert('Aufstellung erfolgreich geladen!');
      } catch (err) {
        alert('Fehler beim Einlesen der Datei: ' + err.message);
      }
    };
    reader.readAsText(file);
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
    'kegel-gross-holz': { shape: 'kegel', size: 'gross', color: 'wood-light', name: 'Kegel Groß' },
    'kegel-mittel-holz': { shape: 'kegel', size: 'mittel', color: 'wood-light', name: 'Kegel Mittel' },
    'kegel-klein-holz': { shape: 'kegel', size: 'klein', color: 'wood-light', name: 'Kind / Klein' },
    'zylinder-gross-holz': { shape: 'zylinder', size: 'gross', color: 'wood-light', name: 'Zylinder Groß' },
    'zylinder-mittel-holz': { shape: 'zylinder', size: 'mittel', color: 'wood-light', name: 'Zylinder Mittel' },
    'kloetzchen-holz': { shape: 'block', size: 'mittel', color: 'wood-light', name: 'Holzklötzchen' },
    'kegel-rot': { shape: 'kegel', size: 'mittel', color: '#c0392b', name: 'Rot' },
    'kegel-blau': { shape: 'kegel', size: 'mittel', color: '#2980b9', name: 'Blau' },
    'kegel-gruen': { shape: 'kegel', size: 'mittel', color: '#27ae60', name: 'Grün' },
    'kegel-schwarz': { shape: 'kegel', size: 'mittel', color: '#1a1a1a', name: 'Schwarz' },
    'kegel-weiss': { shape: 'kegel', size: 'mittel', color: '#f4f4f4', name: 'Weiß' },
    'eckig-gross-holz': { shape: 'eckig', size: 'gross', color: 'wood-light', name: 'Eckig Groß' }
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

  function setupDragAndDrop() {
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
      titleInput.addEventListener('change', (e) => {
        STATE.sessionTitle = e.target.value.trim() || 'Neue Aufstellung';
      });
    }

    // 1-BRETT / TRENNUNG UMSCHALTER (PROMINENT IM HEADER)
    document.getElementById('btnToggleSplit')?.addEventListener('click', toggleBoardSplit);
    document.getElementById('btnSetUnified')?.addEventListener('click', setBoardUnified);
    document.getElementById('btnSetSplit')?.addEventListener('click', setBoardSplit);

    // View-Modes (Brett wird bei jedem Wechsel bildschirmfüllend eingepasst)
    document.getElementById('btnView2D')?.addEventListener('click', () => setViewMode('2d'));
    document.getElementById('btnView25D')?.addEventListener('click', () => setViewMode('25d'));

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
      STATE.autoFit = false;
      STATE.zoom = clamp(STATE.zoom * 1.18, MIN_ZOOM, MAX_ZOOM);
      updateTransform();
    });

    document.getElementById('btnZoomOut')?.addEventListener('click', () => {
      STATE.autoFit = false;
      STATE.zoom = clamp(STATE.zoom / 1.18, MIN_ZOOM, MAX_ZOOM);
      updateTransform();
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
        if (preset) addFigure(preset, { select: false });
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
        if (preset) addFigure(preset, { select: false });
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
      });
    });

    const splitSlider = document.getElementById('splitDistanceSlider');
    if (splitSlider) {
      splitSlider.addEventListener('input', (e) => {
        STATE.splitDistance = parseInt(e.target.value, 10);
        updateSplitUI();
        renderBoard();
      });
      splitSlider.addEventListener('change', () => {
        if (STATE.autoFit && !STATE.povFigureId) fitToView(true);
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

    // Fokus-Modus
    document.getElementById('btnEnterFocus')?.addEventListener('click', enterFocusMode);
    document.getElementById('btnExitFocus')?.addEventListener('click', exitFocusMode);
    document.addEventListener('fullscreenchange', () => {
      // Vollbild wurde vom Browser beendet (z. B. durch Esc) -> Fokus-Modus ebenfalls beenden
      if (!document.fullscreenElement && STATE.focusMode) exitFocusMode();
    });
  }

  // ==========================================================================
  // 18. INITIALISIERUNG
  // ==========================================================================

  function init() {
    renderBoard();
    loadTemplate('leer'); // Startet mit einem leeren, ganzen Brett
    renderPhasesUI();
    setupInteractions();
    setupUiListeners();
    pickRandomQuestion('all');
    runSystemicAnalysis();
    updateSplitUI();

    // Brett immer bildschirmfüllend: beim Start, bei Größenänderung und bei Ansichtswechsel
    fitToView(false);
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (STATE.povFigureId) applyPovCamera(false);
        else if (STATE.autoFit) fitToView(false);
      }).observe(boardViewportEl);
    }

    console.log('Virtuelles Systembrett erfolgreich initialisiert.');
  }

  window.addEventListener('DOMContentLoaded', init);

})();
