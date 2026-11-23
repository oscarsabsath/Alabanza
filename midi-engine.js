(function () {
  'use strict';

  const CUSTOM_MIDI_STORAGE_KEY = 'ha2009_custom_midi_v2';
  const AUDIO_CACHE_NAME = 'himnario-2009-official-audios-v1';
  const ARCHIVE_BASE_URL = 'https://archive.org/download/HimnarioAdventista';

  // Pitch helpers: MIDI note numbers (C4 = 60)
  const NOTE_NAMES_ES = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Sib', 'Si'];

  function midiToNoteName(midi) {
    if (!midi || midi <= 0) return '—';
    const n = Math.round(midi);
    const name = NOTE_NAMES_ES[((n % 12) + 12) % 12];
    const octave = Math.floor(n / 12) - 1;
    return `${name}${octave}`;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function padHymnNum(num) {
    return String(num).padStart(3, '0');
  }

  function getOfficialMp3Url(num) {
    return `${ARCHIVE_BASE_URL}/${padHymnNum(num)}.mp3`;
  }

  function getOfficialOggUrl(num) {
    return `${ARCHIVE_BASE_URL}/${padHymnNum(num)}.ogg`;
  }

  // Build compact SATB note lists from chord sequences:
  // Each step is [soprano, alto, tenor, bass, durationBeats]
  function buildScoreFromChords(bpm, timeSig, chords) {
    const voices = { S: [], A: [], T: [], B: [] };
    let beat = 0;
    for (const c of chords) {
      const [s, a, t, b, dur] = c;
      if (s > 0) voices.S.push({ p: s, t: beat, d: dur });
      if (a > 0) voices.A.push({ p: a, t: beat, d: dur });
      if (t > 0) voices.T.push({ p: t, t: beat, d: dur });
      if (b > 0) voices.B.push({ p: b, t: beat, d: dur });
      beat += dur;
    }
    return { bpm, timeSig: timeSig || '4/4', totalBeats: beat, voices, isAuthentic: true };
  }

  // Exact SATB Scores for verified hymns from Himnario Adventista 2009
  // C3=48, D3=50, E3=52, F3=53, F#3=54, G3=55, Ab3=56, A3=57, Bb3=58, B3=59
  // C4=60, C#4=61, D4=62, Eb4=63, E4=64, F4=65, F#4=66, G4=67, Ab4=68, A4=69, Bb4=70, B4=71
  // C5=72, C#5=73, D5=74, Eb5=75, E5=76
  const CURATED_SATB_SCORES = {
    // #1 ¡Cantad alegres al Señor! (Melodía real: DUKE STREET - John Hatton, Re Mayor / D Major)
    1: buildScoreFromChords(96, '4/4', [
      // Can-tad a-le-gres al Se-ñor (D4 - F#4 - G4 - A4 - B4 - C#5 - D5 - C#5 - B4 - A4)
      [62, 57, 54, 50, 2], [66, 62, 57, 50, 1], [67, 62, 59, 55, 1],
      [69, 66, 57, 50, 2], [71, 67, 59, 55, 0.5], [73, 64, 57, 55, 0.5], [74, 66, 57, 54, 1],
      [73, 64, 57, 52, 1], [71, 62, 56, 52, 1], [69, 61, 57, 45, 2],
      // mor-ta-les to-dos por do-quier (A4 - A4 - A4 - B4 - A4 - G4 - F#4 - E4 - D4 - E4)
      [69, 64, 57, 45, 2], [69, 64, 57, 49, 1], [69, 66, 57, 50, 1],
      [71, 67, 59, 55, 1], [69, 66, 57, 50, 1], [67, 59, 55, 52, 1], [66, 62, 57, 50, 1],
      [64, 59, 55, 52, 1], [62, 57, 54, 54, 1], [64, 61, 57, 45, 2],
      // ser-vid-le siem-pre con fer-vor (F#4 - F#4 - E4 - D4 - F#4 - A4 - D5 - B4 - A4 - G4 - F#4)
      [66, 62, 57, 50, 2], [66, 62, 57, 50, 1], [64, 61, 57, 45, 1],
      [62, 57, 54, 50, 1], [66, 62, 57, 50, 1], [69, 66, 57, 50, 1], [74, 66, 57, 50, 1],
      [71, 67, 59, 55, 0.5], [69, 66, 57, 54, 0.5], [67, 59, 55, 52, 1], [66, 62, 57, 50, 2],
      // o-be-de-ced-le con pla-cer (A4 - D5 - C#5 - B4 - A4 - G4 - F#4 - E4 - E4 - D4)
      [69, 62, 57, 54, 2], [74, 66, 57, 50, 1], [73, 66, 57, 54, 1],
      [71, 67, 59, 55, 1], [69, 66, 57, 50, 1], [67, 59, 55, 52, 1], [66, 62, 57, 45, 1],
      [64, 62, 57, 45, 1], [64, 61, 55, 45, 1], [62, 62, 54, 50, 3]
    ]),

    // #2 Da gloria al Señor (Melodía real: ITALIAN HYMN / MOSCOW - Felice de Giardini, Sol Mayor 3/4)
    2: buildScoreFromChords(96, '3/4', [
      // Da glo-ria al Se-ñor (D5 - B4 - G4 | A4 - G4 - F#4 | G4)
      [74, 67, 59, 55, 1], [71, 62, 59, 55, 1], [67, 62, 59, 55, 1],
      [69, 62, 57, 50, 1], [67, 62, 59, 50, 1], [66, 60, 57, 50, 1],
      [67, 62, 59, 55, 3],
      // gran Rey y Crea-dor (G4 - A4 - B4 | C5 - B4 - A4 | B4)
      [67, 62, 59, 55, 1], [69, 66, 62, 50, 1], [71, 67, 59, 55, 1],
      [72, 64, 60, 48, 1], [71, 62, 59, 50, 1], [69, 60, 57, 50, 1],
      [71, 62, 59, 55, 3],
      // can-tad a Él (D5 - B4 - G4 | D4)
      [74, 67, 59, 55, 1], [71, 62, 59, 55, 1], [67, 62, 59, 55, 1],
      [62, 62, 57, 50, 3],
      // ¡Oh, Santo Dios! a ti (B4 - C5 - D5 | D5 - C5 - B4 | C5 - B4 - A4 | B4)
      [71, 67, 59, 55, 1], [72, 66, 60, 50, 1], [74, 67, 59, 55, 1],
      [74, 67, 59, 55, 1.5], [72, 64, 60, 48, 0.5], [71, 62, 59, 55, 1],
      [72, 64, 60, 48, 1], [71, 62, 59, 50, 1], [69, 60, 57, 50, 1],
      [67, 59, 55, 43, 3]
    ]),

    // #22 Jehová está en su santo templo (Entrada de Oficiantes - Geo. F. Root, Re Mayor)
    22: buildScoreFromChords(84, '4/4', [
      [66, 62, 57, 50, 2], [66, 62, 57, 50, 1], [66, 62, 57, 50, 1], [66, 62, 57, 50, 1.5], [67, 62, 59, 50, 0.5], [66, 62, 57, 50, 1], [64, 59, 55, 50, 1], [62, 57, 54, 50, 2],
      [69, 62, 57, 50, 2], [69, 62, 57, 50, 1], [69, 62, 57, 50, 1], [69, 64, 57, 45, 1.5], [71, 64, 59, 45, 0.5], [69, 61, 57, 45, 1], [67, 61, 55, 45, 1], [66, 62, 57, 50, 2],
      [74, 66, 57, 50, 1.5], [73, 66, 57, 50, 0.5], [71, 64, 59, 55, 1], [69, 62, 57, 54, 1], [67, 59, 55, 52, 1], [66, 57, 54, 50, 1], [64, 55, 52, 45, 1], [62, 57, 54, 50, 2],
      [66, 62, 57, 50, 2], [67, 59, 55, 52, 2], [69, 62, 57, 45, 1.5], [66, 62, 57, 45, 0.5], [64, 61, 55, 45, 1], [62, 62, 54, 50, 3]
    ]),

    // #37 Dios os guarde en su santo amor (Clausura - Tomer, Do Mayor)
    37: buildScoreFromChords(88, '4/4', [
      [64, 60, 55, 48, 1], [64, 60, 55, 48, 1], [64, 60, 55, 48, 1], [64, 60, 55, 48, 1], [62, 59, 55, 55, 1], [60, 60, 55, 48, 1], [67, 60, 55, 52, 2],
      [69, 65, 60, 53, 1], [69, 65, 60, 53, 1], [69, 65, 60, 53, 1], [69, 65, 60, 53, 1], [67, 64, 60, 48, 1.5], [64, 60, 55, 48, 0.5], [67, 62, 59, 55, 2],
      [67, 64, 60, 48, 1], [67, 64, 60, 48, 1], [67, 64, 60, 48, 1], [64, 60, 55, 48, 1], [60, 57, 53, 53, 1], [62, 57, 53, 53, 1], [64, 60, 55, 48, 2],
      [64, 60, 55, 48, 1], [65, 60, 57, 53, 1], [67, 64, 60, 55, 1], [72, 65, 60, 57, 1], [71, 65, 59, 55, 1], [62, 59, 55, 55, 1], [60, 60, 55, 48, 3]
    ]),

    // #61 Santo, Santo, Santo (Nicaea - John B. Dykes, Re Mayor)
    61: buildScoreFromChords(92, '4/4', [
      [62, 57, 54, 50, 1], [62, 57, 54, 50, 1], [66, 62, 57, 50, 1], [66, 62, 57, 50, 1], [69, 62, 57, 45, 2], [69, 62, 57, 50, 2],
      [71, 67, 59, 55, 1.5], [71, 67, 59, 55, 0.5], [71, 67, 59, 55, 1], [71, 67, 59, 55, 1], [69, 66, 57, 50, 2], [66, 62, 57, 50, 2],
      [69, 64, 57, 45, 1], [69, 64, 57, 52, 1], [71, 64, 59, 52, 1], [71, 64, 59, 45, 1], [74, 66, 57, 50, 1.5], [71, 67, 59, 55, 0.5], [69, 66, 57, 50, 1], [66, 62, 57, 50, 1],
      [64, 61, 57, 45, 1], [69, 62, 57, 50, 1], [71, 62, 59, 55, 1], [69, 62, 57, 50, 1], [67, 59, 55, 52, 1.5], [66, 57, 54, 50, 0.5], [64, 61, 55, 45, 1], [62, 62, 54, 50, 3]
    ]),

    // #96 Al contemplar la excelsa cruz (Hamburg - Lowell Mason, Fa Mayor - Santa Cena)
    96: buildScoreFromChords(82, '4/4', [
      [65, 60, 57, 53, 2], [65, 60, 57, 53, 1], [67, 64, 58, 48, 1], [69, 65, 60, 53, 1], [67, 64, 60, 48, 1], [69, 65, 60, 53, 1], [70, 65, 62, 58, 1], [69, 65, 60, 53, 2], [67, 64, 60, 48, 2],
      [69, 65, 60, 53, 2], [69, 65, 60, 53, 1], [69, 65, 60, 53, 1], [70, 65, 62, 58, 1], [69, 65, 60, 53, 1], [67, 62, 58, 55, 1], [65, 60, 57, 53, 1], [64, 60, 55, 48, 2], [65, 60, 57, 53, 2],
      [65, 60, 57, 53, 2], [65, 60, 57, 53, 1], [67, 64, 58, 48, 1], [69, 65, 60, 53, 1], [67, 64, 60, 48, 1], [69, 65, 60, 53, 1], [70, 65, 62, 58, 1], [69, 65, 60, 53, 2], [67, 64, 60, 48, 2],
      [69, 65, 60, 53, 2], [70, 65, 62, 58, 1], [69, 65, 60, 53, 1], [67, 62, 58, 55, 1], [65, 60, 57, 50, 1], [67, 60, 58, 48, 1], [64, 60, 55, 48, 1], [65, 60, 57, 53, 3]
    ]),

    // #97 En el monte Calvario (The Old Rugged Cross - Geo. Bennard, Sib Mayor - Santa Cena)
    97: buildScoreFromChords(86, '3/4', [
      [62, 58, 53, 46, 1], [63, 58, 55, 46, 1], [65, 62, 58, 46, 2], [64, 61, 58, 46, 1], [67, 62, 58, 46, 1], [65, 62, 58, 46, 3],
      [65, 62, 58, 46, 1], [65, 62, 58, 50, 1], [67, 63, 58, 51, 2], [66, 63, 60, 51, 1], [69, 63, 60, 51, 1], [67, 63, 58, 51, 3],
      [67, 60, 57, 53, 1], [69, 63, 57, 53, 1], [70, 63, 57, 53, 2], [69, 63, 57, 53, 1], [67, 60, 57, 53, 1], [65, 62, 58, 46, 2], [63, 60, 57, 53, 1], [62, 58, 53, 46, 3],
      [62, 58, 53, 46, 1], [63, 58, 55, 46, 1], [65, 62, 58, 46, 1.5], [70, 62, 58, 46, 0.5], [69, 63, 60, 53, 1], [67, 63, 58, 51, 1], [65, 62, 58, 46, 1.5], [63, 60, 57, 53, 0.5], [62, 58, 55, 53, 1], [60, 57, 53, 53, 1], [58, 58, 53, 46, 3]
    ]),

    // #367 Gracias, Dios (Old Hundredth - Doxología / Diezmos - Sol Mayor)
    367: buildScoreFromChords(92, '4/4', [
      [67, 62, 59, 55, 2], [67, 62, 59, 55, 1], [66, 62, 57, 50, 1], [64, 59, 55, 52, 1], [62, 59, 55, 47, 1], [67, 62, 59, 55, 1], [69, 62, 57, 50, 1], [71, 62, 59, 55, 2],
      [71, 62, 59, 55, 2], [71, 62, 59, 55, 1], [71, 62, 59, 52, 1], [69, 64, 57, 45, 1], [67, 62, 59, 55, 1], [72, 64, 60, 48, 1], [71, 62, 59, 55, 1], [69, 62, 57, 50, 2],
      [67, 62, 59, 55, 2], [69, 62, 57, 54, 1], [71, 62, 59, 55, 1], [69, 62, 57, 50, 1], [67, 62, 59, 55, 1], [64, 60, 55, 48, 1], [66, 60, 57, 50, 1], [67, 59, 55, 52, 2],
      [74, 67, 59, 47, 2], [71, 62, 59, 55, 1], [67, 62, 55, 47, 1], [69, 64, 57, 48, 1], [72, 64, 57, 45, 1], [71, 62, 59, 50, 1], [69, 60, 57, 50, 1], [67, 59, 55, 43, 3]
    ]),

    // #538 Hoy es día de reposo (Himno del Sábado - Sol Mayor)
    538: buildScoreFromChords(94, '4/4', [
      [62, 59, 55, 55, 1], [67, 62, 59, 55, 1.5], [67, 62, 59, 55, 0.5], [69, 62, 57, 54, 1], [71, 62, 59, 55, 1.5], [69, 62, 57, 50, 0.5], [67, 60, 55, 48, 1], [64, 60, 55, 48, 1],
      [62, 59, 55, 55, 1], [67, 62, 59, 55, 1], [71, 62, 59, 55, 1], [74, 67, 59, 55, 1.5], [72, 66, 57, 50, 0.5], [71, 67, 59, 55, 1], [69, 66, 57, 50, 2],
      [62, 59, 55, 55, 1], [67, 62, 59, 55, 1.5], [67, 62, 59, 55, 0.5], [69, 62, 57, 54, 1], [71, 62, 59, 55, 1.5], [69, 62, 57, 50, 0.5], [67, 60, 55, 48, 1], [64, 60, 55, 48, 1],
      [62, 59, 55, 55, 1], [67, 62, 59, 55, 1], [71, 62, 59, 50, 1.5], [69, 60, 57, 50, 0.5], [67, 59, 55, 50, 1], [66, 60, 57, 50, 1], [67, 59, 55, 43, 3]
    ])
  };

  function loadCustomMidisMap() {
    try {
      const raw = localStorage.getItem(CUSTOM_MIDI_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCustomMidiScore(hymnNum, scoreObj) {
    try {
      const map = loadCustomMidisMap();
      map[String(hymnNum)] = { ...scoreObj, isCustomMidi: true };
      localStorage.setItem(CUSTOM_MIDI_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('No se pudo guardar MIDI personalizado:', e);
    }
  }

  function getScoreForHymn(hymn) {
    const num = hymn ? hymn.n : 1;
    const customMap = loadCustomMidisMap();
    if (customMap[String(num)]) {
      return customMap[String(num)];
    }
    if (CURATED_SATB_SCORES[num]) {
      return CURATED_SATB_SCORES[num];
    }
    return null;
  }

  // Parse Standard MIDI File (SMF Format 0 or 1) binary ArrayBuffer into 4 SATB voices
  function parseStandardMidiFile(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let pos = 0;

    function readStr(len) {
      let s = '';
      for (let i = 0; i < len && pos < bytes.length; i++) {
        s += String.fromCharCode(bytes[pos++]);
      }
      return s;
    }

    function readUInt32() {
      const v =
        (bytes[pos] << 24) |
        (bytes[pos + 1] << 16) |
        (bytes[pos + 2] << 8) |
        bytes[pos + 3];
      pos += 4;
      return v >>> 0;
    }

    function readUInt16() {
      const v = (bytes[pos] << 8) | bytes[pos + 1];
      pos += 2;
      return v;
    }

    function readVarLen() {
      let value = 0;
      while (pos < bytes.length) {
        const b = bytes[pos++];
        value = (value << 7) | (b & 0x7f);
        if ((b & 0x80) === 0) break;
      }
      return value;
    }

    if (readStr(4) !== 'MThd') {
      throw new Error('El archivo no es un MIDI válido (falta encabezado MThd).');
    }
    const hdrLen = readUInt32();
    readUInt16(); // format
    const numTracks = readUInt16();
    const division = readUInt16();
    const ticksPerBeat = (division & 0x8000) === 0 ? division : 480;
    pos = 8 + hdrLen;

    let bpm = 92;
    const rawTracks = [];

    for (let t = 0; t < numTracks && pos < bytes.length; t++) {
      const chunkId = readStr(4);
      const chunkLen = readUInt32();
      const trackEnd = pos + chunkLen;
      if (chunkId !== 'MTrk') {
        pos = trackEnd;
        continue;
      }

      let tick = 0;
      let runningStatus = 0;
      const activeNotes = new Map();
      const trackNotes = [];

      while (pos < trackEnd) {
        const delta = readVarLen();
        tick += delta;
        let status = bytes[pos];
        if (status < 0x80) {
          status = runningStatus;
        } else {
          pos++;
          if (status < 0xf0) runningStatus = status;
        }

        const eventType = status & 0xf0;
        const channel = status & 0x0f;

        if (eventType === 0x90 || eventType === 0x80) {
          const pitch = bytes[pos++];
          const vel = bytes[pos++];
          const key = `${channel}_${pitch}`;
          if (eventType === 0x90 && vel > 0) {
            activeNotes.set(key, { pitch, startTick: tick, channel });
          } else {
            const started = activeNotes.get(key);
            if (started) {
              const durBeats = Math.max(0.15, (tick - started.startTick) / ticksPerBeat);
              trackNotes.push({
                p: pitch,
                t: Number((started.startTick / ticksPerBeat).toFixed(3)),
                d: Number(durBeats.toFixed(3)),
                ch: channel
              });
              activeNotes.delete(key);
            }
          }
        } else if (eventType === 0xa0 || eventType === 0xb0 || eventType === 0xe0) {
          pos += 2;
        } else if (eventType === 0xc0 || eventType === 0xd0) {
          pos += 1;
        } else if (status === 0xff) {
          const metaType = bytes[pos++];
          const metaLen = readVarLen();
          if (metaType === 0x51 && metaLen === 3) {
            const mpqn = (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
            if (mpqn > 0) {
              bpm = Math.max(45, Math.min(180, Math.round(60000000 / mpqn)));
            }
          }
          pos += metaLen;
        } else if (status === 0xf0 || status === 0xf7) {
          const sysLen = readVarLen();
          pos += sysLen;
        } else {
          break;
        }
      }

      if (trackNotes.length > 0) {
        rawTracks.push(trackNotes);
      }
      pos = trackEnd;
    }

    const allNotes = rawTracks.flat();
    if (allNotes.length === 0) {
      throw new Error('El archivo MIDI no contiene notas musicales.');
    }

    const voices = { S: [], A: [], T: [], B: [] };

    if (rawTracks.length >= 4) {
      const sortedTracks = [...rawTracks]
        .slice(0, 4)
        .map((notes) => {
          const avgPitch = notes.reduce((acc, n) => acc + n.p, 0) / notes.length;
          return { notes, avgPitch };
        })
        .sort((a, b) => b.avgPitch - a.avgPitch);

      voices.S = sortedTracks[0].notes.map(({ p, t, d }) => ({ p, t, d }));
      voices.A = sortedTracks[1].notes.map(({ p, t, d }) => ({ p, t, d }));
      voices.T = sortedTracks[2].notes.map(({ p, t, d }) => ({ p, t, d }));
      voices.B = sortedTracks[3].notes.map(({ p, t, d }) => ({ p, t, d }));
    } else {
      const timeBuckets = new Map();
      for (const n of allNotes) {
        const bucketKey = Math.round(n.t * 4) / 4;
        if (!timeBuckets.has(bucketKey)) timeBuckets.set(bucketKey, []);
        timeBuckets.get(bucketKey).push(n);
      }

      for (const [, group] of timeBuckets) {
        group.sort((a, b) => b.p - a.p);
        if (group.length >= 4) {
          voices.S.push({ p: group[0].p, t: group[0].t, d: group[0].d });
          voices.A.push({ p: group[1].p, t: group[1].t, d: group[1].d });
          voices.T.push({ p: group[2].p, t: group[2].t, d: group[2].d });
          voices.B.push({ p: group[group.length - 1].p, t: group[group.length - 1].t, d: group[group.length - 1].d });
        } else if (group.length === 3) {
          voices.S.push({ p: group[0].p, t: group[0].t, d: group[0].d });
          voices.A.push({ p: group[1].p, t: group[1].t, d: group[1].d });
          voices.T.push({ p: group[1].p - 5, t: group[1].t, d: group[1].d });
          voices.B.push({ p: group[2].p, t: group[2].t, d: group[2].d });
        } else if (group.length === 2) {
          voices.S.push({ p: group[0].p, t: group[0].t, d: group[0].d });
          voices.A.push({ p: group[0].p - 4, t: group[0].t, d: group[0].d });
          voices.T.push({ p: group[1].p + 7, t: group[1].t, d: group[1].d });
          voices.B.push({ p: group[1].p, t: group[1].t, d: group[1].d });
        } else if (group.length === 1) {
          const note = group[0];
          if (note.p >= 64) voices.S.push({ p: note.p, t: note.t, d: note.d });
          else if (note.p >= 58) voices.A.push({ p: note.p, t: note.t, d: note.d });
          else if (note.p >= 52) voices.T.push({ p: note.p, t: note.t, d: note.d });
          else voices.B.push({ p: note.p, t: note.t, d: note.d });
        }
      }
    }

    const totalBeats = Math.max(
      1,
      ...Object.values(voices)
        .flat()
        .map((n) => n.t + n.d)
    );

    return {
      bpm,
      timeSig: '4/4',
      totalBeats,
      voices,
      isAuthentic: true,
      isCustomMidi: true
    };
  }

  function exportScoreToMidiBlob(score, transposeSemitones) {
    const ticksPerBeat = 480;
    const semi = Number(transposeSemitones) || 0;

    function writeVarLen(val) {
      const buffer = [val & 0x7f];
      while ((val >>= 7)) {
        buffer.unshift((val & 0x7f) | 0x80);
      }
      return buffer;
    }

    function strBytes(str) {
      return Array.from(str).map((c) => c.charCodeAt(0));
    }

    function uint32Bytes(v) {
      return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
    }

    function uint16Bytes(v) {
      return [(v >>> 8) & 0xff, v & 0xff];
    }

    const voiceConfigs = [
      { key: 'S', name: 'Soprano', ch: 0, prog: 0 },
      { key: 'A', name: 'Contralto', ch: 1, prog: 0 },
      { key: 'T', name: 'Tenor', ch: 2, prog: 0 },
      { key: 'B', name: 'Bajo', ch: 3, prog: 0 }
    ];

    const trackChunks = [];
    const mpqn = Math.round(60000000 / (score.bpm || 90));
    const tempoTrackData = [
      0x00, 0xff, 0x51, 0x03,
      (mpqn >>> 16) & 0xff, (mpqn >>> 8) & 0xff, mpqn & 0xff,
      0x00, 0xff, 0x2f, 0x00
    ];
    trackChunks.push([
      ...strBytes('MTrk'),
      ...uint32Bytes(tempoTrackData.length),
      ...tempoTrackData
    ]);

    for (const vc of voiceConfigs) {
      const notes = score.voices[vc.key] || [];
      const events = [];
      for (const n of notes) {
        const pitch = Math.max(24, Math.min(108, Math.round(n.p + semi)));
        const startTick = Math.max(0, Math.round(n.t * ticksPerBeat));
        const endTick = Math.max(startTick + 40, Math.round((n.t + n.d) * ticksPerBeat));
        events.push({ tick: startTick, type: 'on', pitch, vel: 96 });
        events.push({ tick: endTick, type: 'off', pitch, vel: 0 });
      }
      events.sort((a, b) => a.tick - b.tick || (a.type === 'off' ? -1 : 1));

      const trackBytes = [];
      const nameArr = strBytes(vc.name);
      trackBytes.push(0x00, 0xff, 0x03, nameArr.length, ...nameArr);
      trackBytes.push(0x00, 0xc0 | vc.ch, vc.prog);

      let lastTick = 0;
      for (const ev of events) {
        const delta = Math.max(0, ev.tick - lastTick);
        lastTick = ev.tick;
        trackBytes.push(...writeVarLen(delta));
        if (ev.type === 'on') {
          trackBytes.push(0x90 | vc.ch, ev.pitch, ev.vel);
        } else {
          trackBytes.push(0x80 | vc.ch, ev.pitch, 0x00);
        }
      }
      trackBytes.push(0x00, 0xff, 0x2f, 0x00);
      trackChunks.push([
        ...strBytes('MTrk'),
        ...uint32Bytes(trackBytes.length),
        ...trackBytes
      ]);
    }

    const header = [
      ...strBytes('MThd'),
      ...uint32Bytes(6),
      ...uint16Bytes(1),
      ...uint16Bytes(trackChunks.length),
      ...uint16Bytes(ticksPerBeat)
    ];

    const allBytes = new Uint8Array([...header, ...trackChunks.flat()]);
    return new Blob([allBytes], { type: 'audio/midi' });
  }

  // ==================== ENGINE STATE: OFFICIAL AUDIO (613 HYMNS) + MIDI 4-VOICE ====================
  // engineSource: 'official-audio' (Real recordings 001..613 from Himnario Adventista 2009) | 'midi-satb' (4-voice MIDI notes)
  let engineSource = 'official-audio';
  let audioEl = null;
  let audioCtx = null;
  let isPlaying = false;
  let currentBeat = 0;
  let lastFrameTime = 0;
  let rafId = null;
  let currentHymn = null;
  let currentScore = null;
  let isAudioCachedOffline = false;

  // Rehearsal state:
  // practiceMode: 'focus' (selected voice 100%, others 22%) | 'solo' (selected voice 100%, others 0%) | 'mix' (toggle any voice)
  let practiceMode = 'focus';
  let focusedVoice = 'S'; // 'S' | 'A' | 'T' | 'B'
  let voiceEnabled = { S: true, A: true, T: true, B: true };
  let tempoMultiplier = 1.0;
  let transposeSemitones = 0;

  const triggeredNotesSet = new Set();
  const activeVoicePitch = { S: 0, A: 0, T: 0, B: 0 };

  function ensureAudioElement() {
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.preload = 'metadata';

      audioEl.addEventListener('timeupdate', () => {
        if (engineSource === 'official-audio') {
          updateConsoleUI();
        }
      });

      audioEl.addEventListener('loadedmetadata', () => {
        if (engineSource === 'official-audio') {
          updateConsoleUI();
        }
      });

      audioEl.addEventListener('play', () => {
        if (engineSource === 'official-audio') {
          isPlaying = true;
          updateConsoleUI();
        }
      });

      audioEl.addEventListener('pause', () => {
        if (engineSource === 'official-audio') {
          isPlaying = false;
          updateConsoleUI();
        }
      });

      audioEl.addEventListener('ended', () => {
        if (engineSource === 'official-audio') {
          isPlaying = false;
          audioEl.currentTime = 0;
          updateConsoleUI();
        }
      });

      audioEl.addEventListener('error', () => {
        // Fallback from .mp3 to .ogg if .mp3 fails
        if (currentHymn && audioEl.src.endsWith('.mp3')) {
          audioEl.src = getOfficialOggUrl(currentHymn.n);
          if (isPlaying) {
            audioEl.play().catch(() => {});
          }
        }
      });
    }
    return audioEl;
  }

  async function checkIfHymnAudioCached(num) {
    if (!('caches' in window)) return false;
    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const matchMp3 = await cache.match(getOfficialMp3Url(num));
      const matchOgg = await cache.match(getOfficialOggUrl(num));
      return Boolean(matchMp3 || matchOgg);
    } catch (e) {
      return false;
    }
  }

  async function loadOfficialAudioForHymn(num) {
    const el = ensureAudioElement();
    el.pause();
    isAudioCachedOffline = false;
    const mp3Url = getOfficialMp3Url(num);
    if ('caches' in window) {
      try {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        const cachedResp = (await cache.match(mp3Url)) || (await cache.match(getOfficialOggUrl(num)));
        if (cachedResp) {
          const blob = await cachedResp.blob();
          el.src = URL.createObjectURL(blob);
          isAudioCachedOffline = true;
          updateConsoleUI();
          return;
        }
      } catch (e) {
        // Use direct stream URL
      }
    }
    el.src = mp3Url;
    el.playbackRate = tempoMultiplier;
    updateConsoleUI();
  }

  function ensureAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function getVoiceGainLevel(voiceKey) {
    if (practiceMode === 'solo') {
      return voiceKey === focusedVoice ? 1.0 : 0.0;
    }
    if (practiceMode === 'focus') {
      return voiceKey === focusedVoice ? 1.0 : 0.22;
    }
    return voiceEnabled[voiceKey] ? 0.85 : 0.0;
  }

  // Grand Piano / Warm Pipe Organ Synthesis (No harsh buzz)
  function playVoiceNote(voiceKey, midiPitch, durationSec) {
    const level = getVoiceGainLevel(voiceKey);
    if (level <= 0.001) return;
    const ctx = ensureAudioContext();
    const now = ctx.currentTime;
    const freq = midiToFreq(midiPitch + transposeSemitones);

    const env = ctx.createGain();
    const peakGain = 0.26 * level;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + 0.018);
    env.gain.exponentialRampToValueAtTime(peakGain * 0.65, now + Math.min(0.25, durationSec * 0.4));
    env.gain.setValueAtTime(peakGain * 0.55, now + Math.max(0.04, durationSec - 0.06));
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.04);

    // Fundamental + 2nd & 3rd warm harmonics (Piano/Organ timbre)
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    const gain2 = ctx.createGain();
    const isLead = (practiceMode === 'focus' || practiceMode === 'solo') && voiceKey === focusedVoice;
    gain2.gain.setValueAtTime(isLead ? 0.35 : 0.16, now);

    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq, now);

    osc1.connect(env);
    osc3.connect(env);
    osc2.connect(gain2);
    gain2.connect(env);
    env.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + durationSec + 0.05);
    osc2.stop(now + durationSec + 0.05);
    osc3.stop(now + durationSec + 0.05);
  }

  function updateConsoleUI() {
    const playBtn = document.getElementById('btn-midi-play');
    if (playBtn) {
      playBtn.innerHTML = isPlaying ? '<span>⏸ Pausar</span>' : '<span>▶ Ensayar</span>';
      playBtn.classList.toggle('playing', isPlaying);
    }

    // Source tabs: 'official-audio' vs 'midi-satb'
    document.querySelectorAll('[data-engine-source]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-engine-source') === engineSource);
    });

    const midiVoicesSection = document.getElementById('midi-satb-section');
    const officialAudioSection = document.getElementById('official-audio-section');
    if (midiVoicesSection) {
      midiVoicesSection.style.display = engineSource === 'midi-satb' ? 'flex' : 'none';
    }
    if (officialAudioSection) {
      officialAudioSection.style.display = engineSource === 'official-audio' ? 'flex' : 'none';
    }

    const fmt = (s) => {
      const sec = Math.max(0, Math.floor(Number(s) || 0));
      return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    };

    const timeEl = document.getElementById('midi-time-label');
    const seekEl = document.getElementById('midi-seek-slider');
    const badgeEl = document.getElementById('midi-source-badge');

    if (engineSource === 'official-audio') {
      const el = ensureAudioElement();
      const curSec = el.currentTime || 0;
      const totSec = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
      if (timeEl) {
        timeEl.textContent = totSec > 0 ? `${fmt(curSec)} / ${fmt(totSec)}` : `${fmt(curSec)} / --:--`;
      }
      if (seekEl && document.activeElement !== seekEl) {
        seekEl.max = String(totSec > 0 ? totSec : 100);
        seekEl.value = String(curSec);
      }
      if (badgeEl) {
        badgeEl.textContent = isAudioCachedOffline
          ? '✅ Audio Oficial Guardado Offline'
          : '🎧 Audio Coral Oficial (Himnario 2009)';
      }
      const cacheBtn = document.getElementById('btn-cache-official-audio');
      if (cacheBtn) {
        cacheBtn.textContent = isAudioCachedOffline
          ? '✓ Guardado en el Celular (Offline)'
          : '📥 Guardar Audio para usar Sin Internet';
        cacheBtn.classList.toggle('in-list', isAudioCachedOffline);
      }
    } else {
      const hasScore = Boolean(currentScore);
      const totalBeats = hasScore ? currentScore.totalBeats : 32;
      const bpm = (hasScore ? currentScore.bpm : 90) * tempoMultiplier;
      const curSec = (currentBeat / bpm) * 60;
      const totSec = (totalBeats / bpm) * 60;
      if (timeEl) timeEl.textContent = `${fmt(curSec)} / ${fmt(totSec)}`;
      if (seekEl && document.activeElement !== seekEl) {
        seekEl.max = String(totalBeats);
        seekEl.value = String(Math.min(totalBeats, currentBeat));
      }
      if (badgeEl) {
        if (!hasScore) {
          badgeEl.textContent = '📂 Sube el archivo .MID de este himno';
        } else if (currentScore.isCustomMidi) {
          badgeEl.textContent = '🎹 MIDI Personalizado (4 Voces)';
        } else {
          badgeEl.textContent = '🎼 Partitura Verificada SATB (4 Voces)';
        }
      }

      const noMidiNotice = document.getElementById('midi-missing-notice');
      if (noMidiNotice) {
        noMidiNotice.style.display = hasScore ? 'none' : 'block';
      }
    }

    document.querySelectorAll('[data-midi-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-midi-mode') === practiceMode);
    });

    ['S', 'A', 'T', 'B'].forEach((vk) => {
      const btn = document.querySelector(`[data-midi-voice="${vk}"]`);
      const noteBadge = document.getElementById(`midi-note-${vk}`);
      const levelLabel = document.getElementById(`midi-level-${vk}`);
      if (!btn) return;

      const gain = getVoiceGainLevel(vk);
      const isFocused = (practiceMode === 'focus' || practiceMode === 'solo') && focusedVoice === vk;
      const isMuted = gain <= 0.01;

      btn.classList.toggle('voice-focused', isFocused);
      btn.classList.toggle('voice-active', !isMuted && !isFocused);
      btn.classList.toggle('voice-muted', isMuted);

      if (levelLabel) {
        if (practiceMode === 'solo') {
          levelLabel.textContent = isFocused ? '🎧 SOLO 100%' : '🔇 Silenciada';
        } else if (practiceMode === 'focus') {
          levelLabel.textContent = isFocused ? '🎯 MI VOZ 100%' : '🔉 Fondo 22%';
        } else {
          levelLabel.textContent = !isMuted ? '🔊 Activa' : '🔇 Silenciada';
        }
      }

      if (noteBadge) {
        const pitch = activeVoicePitch[vk];
        noteBadge.textContent =
          isPlaying && pitch > 0 && !isMuted ? midiToNoteName(pitch + transposeSemitones) : '—';
        noteBadge.classList.toggle('sounding', isPlaying && pitch > 0 && !isMuted);
      }
    });

    const tempoEl = document.getElementById('midi-tempo-val');
    if (tempoEl) tempoEl.textContent = `${Math.round(tempoMultiplier * 100)}%`;

    const transEl = document.getElementById('midi-transpose-val');
    if (transEl) {
      transEl.textContent =
        transposeSemitones === 0
          ? 'Original'
          : `${transposeSemitones > 0 ? '+' : ''}${transposeSemitones} st`;
    }
  }

  function stepPlayback(timestamp) {
    if (!isPlaying || engineSource !== 'midi-satb' || !currentScore) return;
    if (!lastFrameTime) lastFrameTime = timestamp;
    const dtSec = Math.min(0.1, (timestamp - lastFrameTime) / 1000);
    lastFrameTime = timestamp;

    const effectiveBpm = (currentScore.bpm || 90) * tempoMultiplier;
    const prevBeat = currentBeat;
    currentBeat += dtSec * (effectiveBpm / 60);

    ['S', 'A', 'T', 'B'].forEach((vk) => {
      const notes = currentScore.voices[vk] || [];
      let currentActivePitch = 0;
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        const noteId = `${vk}_${i}`;
        if (n.t >= prevBeat - 0.02 && n.t <= currentBeat && !triggeredNotesSet.has(noteId)) {
          triggeredNotesSet.add(noteId);
          const durSec = Math.max(0.14, (n.d / effectiveBpm) * 60 * 0.95);
          playVoiceNote(vk, n.p, durSec);
        }
        if (currentBeat >= n.t && currentBeat <= n.t + n.d) {
          currentActivePitch = n.p;
        }
      }
      activeVoicePitch[vk] = currentActivePitch;
    });

    if (currentBeat >= currentScore.totalBeats) {
      isPlaying = false;
      currentBeat = 0;
      triggeredNotesSet.clear();
      activeVoicePitch.S = 0;
      activeVoicePitch.A = 0;
      activeVoicePitch.T = 0;
      activeVoicePitch.B = 0;
      updateConsoleUI();
      return;
    }

    updateConsoleUI();
    rafId = requestAnimationFrame(stepPlayback);
  }

  function startPlayback(notifyToast) {
    if (engineSource === 'official-audio') {
      const el = ensureAudioElement();
      el.playbackRate = tempoMultiplier;
      el.play().catch(() => {
        if (notifyToast) {
          notifyToast('Conéctate a internet para reproducir o guardar el audio oficial de este himno');
        }
      });
      return;
    }

    if (!currentScore) {
      if (notifyToast) {
        notifyToast('Usa "🎧 Audio Coral Oficial" o sube el archivo .MID de este himno con "📂 .MID"');
      }
      return;
    }

    ensureAudioContext();
    if (currentBeat >= currentScore.totalBeats) {
      currentBeat = 0;
      triggeredNotesSet.clear();
    }
    isPlaying = true;
    lastFrameTime = 0;
    updateConsoleUI();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(stepPlayback);
  }

  function pausePlayback() {
    isPlaying = false;
    cancelAnimationFrame(rafId);
    if (audioEl) audioEl.pause();
    activeVoicePitch.S = 0;
    activeVoicePitch.A = 0;
    activeVoicePitch.T = 0;
    activeVoicePitch.B = 0;
    updateConsoleUI();
  }

  function stopPlayback() {
    isPlaying = false;
    cancelAnimationFrame(rafId);
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
    currentBeat = 0;
    triggeredNotesSet.clear();
    activeVoicePitch.S = 0;
    activeVoicePitch.A = 0;
    activeVoicePitch.T = 0;
    activeVoicePitch.B = 0;
    updateConsoleUI();
  }

  function loadHymnIntoRehearsal(hymn) {
    const changed = !currentHymn || !hymn || currentHymn.n !== hymn.n;
    currentHymn = hymn;
    currentScore = getScoreForHymn(hymn);
    if (changed) {
      stopPlayback();
      if (hymn) {
        loadOfficialAudioForHymn(hymn.n);
      }
    } else {
      updateConsoleUI();
    }
  }

  function bindRehearsalEvents(notifyToast) {
    document.getElementById('btn-midi-play')?.addEventListener('click', () => {
      if (isPlaying) pausePlayback();
      else startPlayback(notifyToast);
    });

    document.getElementById('btn-midi-stop')?.addEventListener('click', () => {
      stopPlayback();
    });

    // Switch between Official Audio (613 Hymns) & 4-Voice MIDI SATB
    document.querySelectorAll('[data-engine-source]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const src = btn.getAttribute('data-engine-source');
        if (src && src !== engineSource) {
          stopPlayback();
          engineSource = src;
          updateConsoleUI();
        }
      });
    });

    // Save Official Audio offline in Cache Storage
    document.getElementById('btn-cache-official-audio')?.addEventListener('click', async () => {
      if (!currentHymn) return;
      const num = currentHymn.n;
      const url = getOfficialMp3Url(num);
      try {
        if (notifyToast) notifyToast(`Descargando audio oficial del Himno #${num}...`);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Error de red');
        if ('caches' in window) {
          const cache = await caches.open(AUDIO_CACHE_NAME);
          await cache.put(url, resp.clone());
          isAudioCachedOffline = true;
          updateConsoleUI();
          if (notifyToast) notifyToast(`¡Audio del Himno #${num} guardado para usar sin internet!`);
        }
      } catch (e) {
        // Fallback: open direct link so the browser downloads the MP3
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });

    const seekSlider = document.getElementById('midi-seek-slider');
    if (seekSlider) {
      seekSlider.addEventListener('input', () => {
        const val = Number(seekSlider.value) || 0;
        if (engineSource === 'official-audio') {
          const el = ensureAudioElement();
          if (Number.isFinite(el.duration) && el.duration > 0) {
            el.currentTime = val;
          }
          updateConsoleUI();
          return;
        }
        currentBeat = val;
        triggeredNotesSet.clear();
        if (currentScore) {
          ['S', 'A', 'T', 'B'].forEach((vk) => {
            (currentScore.voices[vk] || []).forEach((n, idx) => {
              if (n.t < currentBeat - 0.05) {
                triggeredNotesSet.add(`${vk}_${idx}`);
              }
            });
          });
        }
        updateConsoleUI();
      });
    }

    document.querySelectorAll('[data-midi-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-midi-mode');
        if (mode) {
          practiceMode = mode;
          if (mode === 'mix') {
            voiceEnabled = { S: true, A: true, T: true, B: true };
          }
          updateConsoleUI();
        }
      });
    });

    document.querySelectorAll('[data-midi-voice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vk = btn.getAttribute('data-midi-voice');
        if (!vk) return;
        const voiceNames = { S: 'Soprano', A: 'Contralto', T: 'Tenor', B: 'Bajo' };

        if (practiceMode === 'focus' || practiceMode === 'solo') {
          focusedVoice = vk;
          if (notifyToast) {
            notifyToast(
              practiceMode === 'solo'
                ? `🎧 Escuchando solo ${voiceNames[vk]}`
                : `🎯 Destacando ${voiceNames[vk]} (100%) + Coro suave de fondo`
            );
          }
        } else {
          voiceEnabled[vk] = !voiceEnabled[vk];
          if (notifyToast) {
            notifyToast(
              voiceEnabled[vk]
                ? `🔊 Voz ${voiceNames[vk]} activada`
                : `🔇 Voz ${voiceNames[vk]} silenciada`
            );
          }
        }
        updateConsoleUI();
      });
    });

    document.getElementById('btn-midi-tempo-dec')?.addEventListener('click', () => {
      tempoMultiplier = Math.max(0.6, Number((tempoMultiplier - 0.1).toFixed(2)));
      if (audioEl) audioEl.playbackRate = tempoMultiplier;
      updateConsoleUI();
    });

    document.getElementById('btn-midi-tempo-inc')?.addEventListener('click', () => {
      tempoMultiplier = Math.min(1.4, Number((tempoMultiplier + 0.1).toFixed(2)));
      if (audioEl) audioEl.playbackRate = tempoMultiplier;
      updateConsoleUI();
    });

    document.getElementById('btn-midi-trans-dec')?.addEventListener('click', () => {
      transposeSemitones = Math.max(-6, transposeSemitones - 1);
      updateConsoleUI();
    });

    document.getElementById('btn-midi-trans-inc')?.addEventListener('click', () => {
      transposeSemitones = Math.min(6, transposeSemitones + 1);
      updateConsoleUI();
    });

    const fileInput = document.getElementById('input-midi-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentHymn) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsedScore = parseStandardMidiFile(reader.result);
            saveCustomMidiScore(currentHymn.n, parsedScore);
            currentScore = parsedScore;
            engineSource = 'midi-satb';
            stopPlayback();
            if (notifyToast) {
              notifyToast(`¡Archivo MIDI cargado en 4 voces para el Himno #${currentHymn.n}!`);
            }
          } catch (err) {
            if (notifyToast) {
              notifyToast(err.message || 'No se pudo leer el archivo .mid');
            }
          }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
      });
    }

    document.getElementById('btn-midi-download')?.addEventListener('click', () => {
      if (!currentScore || !currentHymn) {
        if (currentHymn) {
          window.open(getOfficialMp3Url(currentHymn.n), '_blank', 'noopener,noreferrer');
        }
        return;
      }
      const blob = exportScoreToMidiBlob(currentScore, transposeSemitones);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `himno_${currentHymn.n}_4voces_satb.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (notifyToast) {
        notifyToast(`Descargado himno_${currentHymn.n}_4voces_satb.mid`);
      }
    });
  }

  window.HA_MIDI_ENGINE = {
    loadHymnIntoRehearsal,
    bindRehearsalEvents,
    stopPlayback
  };
})();
