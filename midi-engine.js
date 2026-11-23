(function () {
  'use strict';

  const CUSTOM_MIDI_STORAGE_KEY = 'ha2009_custom_midi_v1';

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

  // Helper to build compact SATB note lists from chord sequences:
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

  // Curated 4-Voice SATB Scores (Soprano, Contralto, Tenor, Bajo) for principal hymns
  // Pitches in standard MIDI numbers:
  // C3=48, D3=50, E3=52, F3=53, F#3=54, G3=55, Ab3=56, A3=57, Bb3=58, B3=59
  // C4=60, C#4=61, D4=62, Eb4=63, E4=64, F4=65, F#4=66, G4=67, Ab4=68, A4=69, Bb4=70, B4=71
  // C5=72, C#5=73, D5=74, Eb5=75, E5=76
  const CURATED_SATB_SCORES = {
    // #1 ¡Cantad alegres al Señor! (Old Hundredth - G Major)
    1: buildScoreFromChords(96, '4/4', [
      // Cantad alegres al Señor (G - G - F# - E - D - G - A - B)
      [67, 62, 59, 55, 2], [67, 62, 59, 55, 1], [66, 62, 57, 50, 1], [64, 59, 55, 52, 1], [62, 59, 55, 47, 1], [67, 62, 59, 55, 1], [69, 62, 57, 50, 1], [71, 62, 59, 55, 2],
      // mortales todos por doquier (B - B - B - A - G - C - B - A)
      [71, 62, 59, 55, 2], [71, 62, 59, 55, 1], [71, 62, 59, 52, 1], [69, 64, 57, 45, 1], [67, 62, 59, 55, 1], [72, 64, 60, 48, 1], [71, 62, 59, 55, 1], [69, 62, 57, 50, 2],
      // servidle siempre con fervor (G - A - B - A - G - E - F# - G)
      [67, 62, 59, 55, 2], [69, 62, 57, 54, 1], [71, 62, 59, 55, 1], [69, 62, 57, 50, 1], [67, 62, 59, 55, 1], [64, 60, 55, 48, 1], [66, 60, 57, 50, 1], [67, 59, 55, 52, 2],
      // obedecedle con placer (D - B - G - A - C - B - A - G)
      [74, 67, 59, 47, 2], [71, 62, 59, 55, 1], [67, 62, 55, 47, 1], [69, 64, 57, 48, 1], [72, 64, 57, 45, 1], [71, 62, 59, 50, 1], [69, 60, 57, 50, 1], [67, 59, 55, 43, 3]
    ]),

    // #22 Jehová está en su santo templo (Entrada de Oficiantes - D Major)
    22: buildScoreFromChords(84, '4/4', [
      // Jehová está en su santo templo (F# - F# - F# -F# - G - F# - E - D)
      [66, 62, 57, 50, 2], [66, 62, 57, 50, 1], [66, 62, 57, 50, 1], [66, 62, 57, 50, 1.5], [67, 62, 59, 50, 0.5], [66, 62, 57, 50, 1], [64, 59, 55, 50, 1], [62, 57, 54, 50, 2],
      // Jehová está en su santo templo (A - A - A - A - B - A - G - F#)
      [69, 62, 57, 50, 2], [69, 62, 57, 50, 1], [69, 62, 57, 50, 1], [69, 64, 57, 45, 1.5], [71, 64, 59, 45, 0.5], [69, 61, 57, 45, 1], [67, 61, 55, 45, 1], [66, 62, 57, 50, 2],
      // Calle delante de Él toda la tierra (D5 - C#5 - B4 - A4 - G4 - F#4 - E4 - D4)
      [74, 66, 57, 50, 1.5], [73, 66, 57, 50, 0.5], [71, 64, 59, 55, 1], [69, 62, 57, 54, 1], [67, 59, 55, 52, 1], [66, 57, 54, 50, 1], [64, 55, 52, 45, 1], [62, 57, 54, 50, 2],
      // Calle, calle, calle delante de Él (F#4 - G4 - A4 - F#4 - E4 - D4)
      [66, 62, 57, 50, 2], [67, 59, 55, 52, 2], [69, 62, 57, 45, 1.5], [66, 62, 57, 45, 0.5], [64, 61, 55, 45, 1], [62, 62, 54, 50, 3]
    ]),

    // #23 ¡Silencio! ¡Silencio! (Entrada de Oficiantes - F Major)
    23: buildScoreFromChords(82, '4/4', [
      [69, 65, 60, 53, 1.5], [69, 65, 60, 53, 0.5], [67, 64, 60, 48, 2], [65, 60, 57, 53, 1.5], [65, 60, 57, 53, 0.5], [64, 60, 55, 48, 2],
      [65, 60, 57, 53, 1], [67, 62, 58, 55, 1], [69, 65, 60, 57, 1], [70, 65, 62, 58, 1], [69, 65, 60, 53, 2], [67, 64, 60, 48, 2],
      [72, 65, 60, 53, 1.5], [70, 65, 62, 58, 0.5], [69, 65, 60, 53, 1], [67, 64, 58, 48, 1], [65, 60, 57, 53, 1], [67, 62, 58, 50, 1], [65, 60, 57, 53, 3]
    ]),

    // #37 Dios os guarde en su santo amor (Clausura - C Major)
    37: buildScoreFromChords(88, '4/4', [
      // Dios os guarde en su santo amor (E - E - E - E - D - C - G - G)
      [64, 60, 55, 48, 1], [64, 60, 55, 48, 1], [64, 60, 55, 48, 1], [64, 60, 55, 48, 1], [62, 59, 55, 55, 1], [60, 60, 55, 48, 1], [67, 60, 55, 52, 2],
      // hasta el día en que lleguemos (A - A - A - A - G - E - G)
      [69, 65, 60, 53, 1], [69, 65, 60, 53, 1], [69, 65, 60, 53, 1], [69, 65, 60, 53, 1], [67, 64, 60, 48, 1.5], [64, 60, 55, 48, 0.5], [67, 62, 59, 55, 2],
      // a la patria do estaremos (G - G - G - E - C - D - E)
      [67, 64, 60, 48, 1], [67, 64, 60, 48, 1], [67, 64, 60, 48, 1], [64, 60, 55, 48, 1], [60, 57, 53, 53, 1], [62, 57, 53, 53, 1], [64, 60, 55, 48, 2],
      // para siempre con el Salvador (E - F - G - C5 - B - D - C)
      [64, 60, 55, 48, 1], [65, 60, 57, 53, 1], [67, 64, 60, 55, 1], [72, 65, 60, 57, 1], [71, 65, 59, 55, 1], [62, 59, 55, 55, 1], [60, 60, 55, 48, 3]
    ]),

    // #41 Gracia, amor y comunión (Clausura / Santa Cena - F Major)
    41: buildScoreFromChords(86, '4/4', [
      [65, 60, 57, 53, 1], [67, 62, 58, 53, 1], [69, 65, 60, 53, 1.5], [67, 64, 58, 48, 0.5], [65, 60, 57, 53, 1], [62, 58, 53, 46, 1], [60, 57, 53, 53, 2],
      [67, 64, 58, 48, 1], [69, 65, 60, 53, 1], [70, 65, 62, 58, 1], [69, 65, 60, 53, 1], [67, 64, 60, 48, 2],
      [72, 65, 60, 53, 1], [70, 65, 62, 58, 1], [69, 65, 60, 53, 1], [67, 62, 58, 55, 1], [65, 60, 57, 53, 1], [64, 60, 55, 48, 1], [65, 60, 57, 53, 3]
    ]),

    // #61 Santo, Santo, Santo (Nicaea - D Major)
    61: buildScoreFromChords(92, '4/4', [
      // Santo, Santo, Santo (D - D - F# - F# - A - A)
      [62, 57, 54, 50, 1], [62, 57, 54, 50, 1], [66, 62, 57, 50, 1], [66, 62, 57, 50, 1], [69, 62, 57, 45, 2], [69, 62, 57, 50, 2],
      // Señor Omnipotente (B - B - B - B - A - F#)
      [71, 67, 59, 55, 1.5], [71, 67, 59, 55, 0.5], [71, 67, 59, 55, 1], [71, 67, 59, 55, 1], [69, 66, 57, 50, 2], [66, 62, 57, 50, 2],
      // Siempre el labio mío (A - A - B - B - D5 - D5 - A)
      [69, 64, 57, 45, 1], [69, 64, 57, 52, 1], [71, 64, 59, 52, 1], [71, 64, 59, 45, 1], [74, 66, 57, 50, 1.5], [71, 67, 59, 55, 0.5], [69, 66, 57, 50, 1], [66, 62, 57, 50, 1],
      // loores te dará (E - A - B - A - G - F# - E - D)
      [64, 61, 57, 45, 1], [69, 62, 57, 50, 1], [71, 62, 59, 55, 1], [69, 62, 57, 50, 1], [67, 59, 55, 52, 1.5], [66, 57, 54, 50, 0.5], [64, 61, 55, 45, 1], [62, 62, 54, 50, 3]
    ]),

    // #96 Al contemplar la excelsa cruz (Hamburg - F Major - Santa Cena)
    96: buildScoreFromChords(82, '4/4', [
      // Al contemplar la excelsa cruz (F - F - G - A - G - A - Bb - A - G)
      [65, 60, 57, 53, 2], [65, 60, 57, 53, 1], [67, 64, 58, 48, 1], [69, 65, 60, 53, 1], [67, 64, 60, 48, 1], [69, 65, 60, 53, 1], [70, 65, 62, 58, 1], [69, 65, 60, 53, 2], [67, 64, 60, 48, 2],
      // do el Rey de gloria sucumbió (A - A - A - A - G - F - E - F - G - A)
      [69, 65, 60, 53, 2], [69, 65, 60, 53, 1], [69, 65, 60, 53, 1], [70, 65, 62, 58, 1], [69, 65, 60, 53, 1], [67, 62, 58, 55, 1], [65, 60, 57, 53, 1], [64, 60, 55, 48, 2], [65, 60, 57, 53, 2],
      // tesoros mil que ven la luz (F - F - G - A - G - A - Bb - A - G)
      [65, 60, 57, 53, 2], [65, 60, 57, 53, 1], [67, 64, 58, 48, 1], [69, 65, 60, 53, 1], [67, 64, 60, 48, 1], [69, 65, 60, 53, 1], [70, 65, 62, 58, 1], [69, 65, 60, 53, 2], [67, 64, 60, 48, 2],
      // con gran desdén contemplo yo (A - Bb - A - G - F - G - E - F)
      [69, 65, 60, 53, 2], [70, 65, 62, 58, 1], [69, 65, 60, 53, 1], [67, 62, 58, 55, 1], [65, 60, 57, 50, 1], [67, 60, 58, 48, 1], [64, 60, 55, 48, 1], [65, 60, 57, 53, 3]
    ]),

    // #97 En el monte Calvario (The Old Rugged Cross - Bb Major - Santa Cena)
    97: buildScoreFromChords(86, '3/4', [
      // En el monte Calvario (D - Eb - F - E - G - F)
      [62, 58, 53, 46, 1], [63, 58, 55, 46, 1], [65, 62, 58, 46, 2], [64, 61, 58, 46, 1], [67, 62, 58, 46, 1], [65, 62, 58, 46, 3],
      // estaba una cruz (F - F - G - F# - A - G)
      [65, 62, 58, 46, 1], [65, 62, 58, 50, 1], [67, 63, 58, 51, 2], [66, 63, 60, 51, 1], [69, 63, 60, 51, 1], [67, 63, 58, 51, 3],
      // emblema de afrenta y dolor (G - A - Bb - A - G - F - Eb - D - C)
      [67, 60, 57, 53, 1], [69, 63, 57, 53, 1], [70, 63, 57, 53, 2], [69, 63, 57, 53, 1], [67, 60, 57, 53, 1], [65, 62, 58, 46, 2], [63, 60, 57, 53, 1], [62, 58, 53, 46, 3],
      // y yo amo esa cruz do murió mi Jesús (D - Eb - F - Bb - A - G - F - Eb - D - C - Bb)
      [62, 58, 53, 46, 1], [63, 58, 55, 46, 1], [65, 62, 58, 46, 1.5], [70, 62, 58, 46, 0.5], [69, 63, 60, 53, 1], [67, 63, 58, 51, 1], [65, 62, 58, 46, 1.5], [63, 60, 57, 53, 0.5], [62, 58, 55, 53, 1], [60, 57, 53, 53, 1], [58, 58, 53, 46, 3]
    ]),

    // #100 ¡Dulces momentos! (Santa Cena - Eb Major)
    100: buildScoreFromChords(84, '3/4', [
      [67, 63, 58, 51, 2], [67, 63, 58, 51, 1], [68, 63, 60, 44, 2], [67, 63, 58, 51, 1], [65, 62, 58, 46, 2], [63, 58, 55, 51, 1],
      [67, 63, 58, 51, 2], [70, 63, 58, 51, 1], [68, 65, 60, 53, 2], [67, 63, 58, 51, 1], [65, 62, 58, 46, 3],
      [67, 63, 58, 51, 2], [67, 63, 58, 51, 1], [68, 63, 60, 44, 2], [67, 63, 58, 51, 1], [70, 65, 58, 46, 2], [68, 63, 60, 44, 1], [67, 63, 58, 46, 2], [65, 62, 58, 46, 1], [63, 58, 55, 51, 3]
    ]),

    // #367 Gracias, Dios (Doxología / Diezmos - G Major)
    367: buildScoreFromChords(92, '4/4', [
      [67, 62, 59, 55, 2], [67, 62, 59, 55, 1], [66, 62, 57, 50, 1], [64, 59, 55, 52, 1], [62, 59, 55, 47, 1], [67, 62, 59, 55, 1], [69, 62, 57, 50, 1], [71, 62, 59, 55, 2],
      [71, 62, 59, 55, 2], [71, 62, 59, 55, 1], [71, 62, 59, 52, 1], [69, 64, 57, 45, 1], [67, 62, 59, 55, 1], [72, 64, 60, 48, 1], [71, 62, 59, 55, 1], [69, 62, 57, 50, 2],
      [74, 67, 59, 47, 2], [71, 62, 59, 55, 1], [67, 62, 55, 47, 1], [69, 64, 57, 48, 1], [72, 64, 57, 45, 1], [71, 62, 59, 50, 1], [69, 60, 57, 50, 1], [67, 59, 55, 43, 3]
    ]),

    // #521 Al Cristo ved (Recogida de Diezmos - F Major)
    521: buildScoreFromChords(90, '4/4', [
      [65, 60, 57, 53, 1], [65, 60, 57, 53, 1], [69, 65, 60, 53, 1], [69, 65, 60, 53, 1], [70, 65, 62, 58, 1.5], [69, 65, 60, 53, 0.5], [67, 64, 60, 48, 2],
      [67, 64, 58, 48, 1], [67, 64, 58, 48, 1], [69, 65, 60, 53, 1], [67, 64, 58, 48, 1], [65, 60, 57, 53, 3]
    ]),

    // #522 Suenen las palabras (Recogida de Diezmos - G Major)
    522: buildScoreFromChords(92, '4/4', [
      [67, 62, 59, 55, 1.5], [69, 62, 57, 54, 0.5], [71, 62, 59, 55, 1], [67, 62, 59, 55, 1], [69, 66, 62, 50, 1.5], [67, 64, 61, 49, 0.5], [66, 62, 57, 50, 2],
      [64, 60, 55, 48, 1.5], [66, 60, 57, 50, 0.5], [67, 62, 59, 55, 1], [71, 62, 59, 55, 1], [69, 62, 57, 50, 2],
      [74, 67, 59, 55, 1.5], [72, 66, 60, 50, 0.5], [71, 67, 59, 55, 1], [67, 62, 59, 55, 1], [69, 64, 60, 48, 1], [67, 62, 59, 50, 1], [66, 60, 57, 50, 1], [67, 59, 55, 43, 3]
    ]),

    // #534 En tu nombre comenzamos (Escuela Sabática - F Major)
    534: buildScoreFromChords(94, '4/4', [
      [65, 60, 57, 53, 1], [67, 64, 58, 48, 1], [69, 65, 60, 53, 1], [65, 60, 57, 53, 1], [70, 65, 62, 58, 1], [69, 65, 60, 53, 1], [67, 64, 60, 48, 2],
      [69, 65, 60, 53, 1], [70, 65, 62, 58, 1], [72, 65, 60, 53, 1], [69, 65, 60, 53, 1], [67, 62, 58, 55, 1], [65, 60, 57, 50, 1], [64, 60, 55, 48, 2],
      [65, 60, 57, 53, 1], [67, 64, 58, 48, 1], [69, 65, 60, 53, 1], [70, 65, 62, 58, 1], [72, 65, 60, 53, 1.5], [69, 65, 60, 53, 0.5], [67, 64, 58, 48, 1], [65, 60, 57, 53, 3]
    ]),

    // #538 Hoy es día de reposo (Himno del Sábado - G Major)
    538: buildScoreFromChords(94, '4/4', [
      // Hoy es día de reposo (D - G - G - A - B - A - G - E)
      [62, 59, 55, 55, 1], [67, 62, 59, 55, 1.5], [67, 62, 59, 55, 0.5], [69, 62, 57, 54, 1], [71, 62, 59, 55, 1.5], [69, 62, 57, 50, 0.5], [67, 60, 55, 48, 1], [64, 60, 55, 48, 1],
      // el gran día de solaz (D - G - B - D5 - C5 - B - A)
      [62, 59, 55, 55, 1], [67, 62, 59, 55, 1], [71, 62, 59, 55, 1], [74, 67, 59, 55, 1.5], [72, 66, 57, 50, 0.5], [71, 67, 59, 55, 1], [69, 66, 57, 50, 2],
      // es el día venturoso (D - G - G - A - B - A - G - E)
      [62, 59, 55, 55, 1], [67, 62, 59, 55, 1.5], [67, 62, 59, 55, 0.5], [69, 62, 57, 54, 1], [71, 62, 59, 55, 1.5], [69, 62, 57, 50, 0.5], [67, 60, 55, 48, 1], [64, 60, 55, 48, 1],
      // que nos trae dulce paz (D - G - B - A - G - F# - G)
      [62, 59, 55, 55, 1], [67, 62, 59, 55, 1], [71, 62, 59, 50, 1.5], [69, 60, 57, 50, 0.5], [67, 59, 55, 50, 1], [66, 60, 57, 50, 1], [67, 59, 55, 43, 3]
    ]),

    // #581 El Pan de vida soy (Santa Cena - D Major)
    581: buildScoreFromChords(84, '4/4', [
      // El Pan de vida soy, dice el Señor (F# - E - D - A - G - F# - E - D - E - F#)
      [66, 62, 57, 50, 1.5], [64, 61, 57, 45, 0.5], [62, 57, 54, 50, 1], [69, 62, 57, 54, 1], [67, 59, 55, 55, 1.5], [66, 62, 57, 50, 0.5], [64, 59, 55, 52, 1], [62, 57, 54, 50, 1], [64, 61, 55, 45, 1], [66, 62, 57, 50, 2],
      // ven, alma hambrienta, hoy al Salvador (F# - G - A - B - A - G - F# - E - D)
      [66, 62, 57, 50, 1], [67, 62, 59, 55, 1], [69, 66, 57, 50, 1.5], [71, 67, 59, 55, 0.5], [69, 66, 57, 50, 1], [67, 59, 55, 52, 1], [66, 62, 57, 45, 1], [64, 61, 55, 45, 1], [62, 62, 54, 50, 3]
    ]),

    // #582 Hoy venimos cual hermanos (Rito de Humildad / Santa Cena - F Major)
    582: buildScoreFromChords(86, '4/4', [
      // Hoy venimos cual hermanos (A - A - G - F - C5 - Bb - A - G)
      [69, 65, 60, 53, 1.5], [69, 65, 60, 53, 0.5], [67, 64, 58, 48, 1], [65, 60, 57, 53, 1], [72, 65, 60, 57, 1.5], [70, 65, 62, 58, 0.5], [69, 65, 60, 53, 1], [67, 64, 60, 48, 1],
      // a la Cena del Señor (F - G - A - Bb - A - G - F)
      [65, 60, 57, 53, 1], [67, 62, 58, 55, 1], [69, 65, 60, 53, 1.5], [70, 65, 62, 58, 0.5], [69, 65, 60, 48, 1], [67, 64, 58, 48, 1], [65, 60, 57, 53, 2],
      // acerquémonos cristianos (C5 - C5 - D5 - C5 - Bb - A - G)
      [72, 65, 60, 53, 1.5], [72, 65, 60, 53, 0.5], [74, 65, 62, 58, 1], [72, 65, 60, 53, 1], [70, 65, 62, 55, 1], [69, 65, 60, 53, 1], [67, 64, 60, 48, 2],
      // respirando tierno amor (A - Bb - C5 - F - G - E - F)
      [69, 65, 60, 53, 1], [70, 65, 62, 58, 1], [72, 65, 60, 53, 1], [65, 62, 58, 50, 1], [67, 60, 58, 48, 1], [64, 60, 55, 48, 1], [65, 60, 57, 53, 3]
    ]),

    // #583 La Cena de la Comunión (Santa Cena - Eb Major)
    583: buildScoreFromChords(84, '3/4', [
      [67, 63, 58, 51, 2], [67, 63, 58, 51, 1], [70, 63, 58, 51, 2], [67, 63, 58, 51, 1], [65, 62, 58, 46, 2], [63, 58, 55, 51, 1],
      [68, 63, 60, 44, 2], [68, 63, 60, 44, 1], [67, 63, 58, 51, 2], [63, 58, 55, 51, 1], [65, 62, 58, 46, 3],
      [67, 63, 58, 51, 2], [70, 63, 58, 51, 1], [72, 68, 60, 44, 2], [70, 67, 58, 51, 1], [68, 63, 60, 44, 2], [67, 63, 58, 51, 1], [65, 62, 58, 46, 2], [63, 58, 55, 51, 3]
    ]),

    // #584 Amémonos, hermanos (Rito de Humildad / Santa Cena - G Major)
    584: buildScoreFromChords(86, '3/4', [
      [62, 59, 55, 55, 1], [67, 62, 59, 55, 2], [66, 60, 57, 50, 1], [64, 60, 55, 48, 2], [62, 59, 55, 55, 1], [71, 62, 59, 55, 2], [69, 62, 57, 50, 3],
      [69, 66, 60, 50, 1], [72, 66, 60, 50, 2], [71, 67, 59, 55, 1], [69, 62, 57, 50, 2], [67, 62, 59, 55, 1], [66, 60, 57, 50, 2], [67, 59, 55, 43, 3]
    ]),

    // #585 Loámoste, ¡oh Dios! (Santa Cena / Oficiantes - G Major)
    585: buildScoreFromChords(90, '4/4', [
      [62, 59, 55, 55, 1], [67, 62, 59, 55, 2], [69, 62, 57, 50, 1], [71, 62, 59, 55, 2], [72, 64, 60, 48, 1], [74, 67, 59, 55, 2], [71, 62, 59, 55, 1], [69, 62, 57, 50, 2],
      [71, 67, 59, 55, 1], [72, 64, 60, 48, 1], [71, 62, 59, 55, 1], [69, 62, 57, 50, 1], [67, 62, 59, 55, 1], [64, 60, 55, 48, 1], [62, 59, 55, 50, 1], [66, 60, 57, 50, 1], [67, 59, 55, 43, 3]
    ]),

    // #586 En memoria de mí (Santa Cena - F Major)
    586: buildScoreFromChords(82, '4/4', [
      [65, 60, 57, 53, 1.5], [67, 62, 58, 53, 0.5], [69, 65, 60, 53, 1], [65, 60, 57, 53, 1], [67, 64, 58, 48, 1.5], [65, 60, 57, 53, 0.5], [64, 60, 55, 48, 2],
      [65, 60, 57, 53, 1], [69, 65, 60, 53, 1], [72, 65, 60, 57, 1.5], [70, 65, 62, 58, 0.5], [69, 65, 60, 53, 1], [67, 64, 58, 48, 1], [65, 60, 57, 53, 3]
    ])
  };

  // Classical SATB Hymn Harmony Templates (8 keys & progressions) for deterministic generation
  // when a hymn does not have a custom .mid uploaded yet.
  const HYMN_KEY_PROGRESSIONS = [
    // Key of F Major
    {
      bpm: 88,
      chords: [
        [65, 60, 57, 53], // I (F)
        [69, 65, 60, 53], // I6
        [70, 65, 62, 58], // IV (Bb)
        [69, 65, 60, 53], // I
        [67, 64, 58, 48], // V7 (C7)
        [69, 65, 60, 57], // vi (Dm)
        [67, 62, 58, 55], // ii (Gm)
        [64, 60, 55, 48], // V (C)
        [72, 65, 60, 53], // I high
        [70, 65, 62, 55], // ii6
        [69, 65, 60, 48], // I64
        [67, 64, 58, 48], // V7
        [65, 60, 57, 53]  // I final
      ]
    },
    // Key of G Major
    {
      bpm: 92,
      chords: [
        [67, 62, 59, 55], // I (G)
        [71, 62, 59, 55], // I
        [72, 64, 60, 48], // IV (C)
        [71, 62, 59, 55], // I
        [69, 62, 57, 50], // V (D)
        [67, 59, 55, 52], // vi (Em)
        [69, 64, 57, 45], // ii (Am)
        [66, 60, 57, 50], // V7 (D7)
        [74, 67, 59, 47], // I6
        [72, 64, 60, 48], // IV
        [71, 62, 59, 50], // I64
        [69, 60, 57, 50], // V7
        [67, 59, 55, 43]  // I final
      ]
    },
    // Key of D Major
    {
      bpm: 90,
      chords: [
        [66, 62, 57, 50], // I (D)
        [69, 62, 57, 50], // I
        [71, 67, 59, 55], // IV (G)
        [69, 66, 57, 50], // I
        [67, 61, 55, 45], // V7 (A7)
        [66, 59, 54, 47], // vi (Bm)
        [67, 59, 55, 52], // ii (Em)
        [64, 61, 57, 45], // V (A)
        [74, 66, 57, 50], // I high
        [71, 67, 59, 55], // IV
        [69, 62, 57, 45], // I64
        [64, 61, 55, 45], // V7
        [62, 62, 54, 50]  // I final
      ]
    },
    // Key of Eb Major
    {
      bpm: 86,
      chords: [
        [67, 63, 58, 51], // I (Eb)
        [70, 63, 58, 51], // I
        [72, 68, 60, 44], // IV (Ab)
        [70, 63, 58, 51], // I
        [68, 62, 58, 46], // V7 (Bb7)
        [67, 60, 55, 48], // vi (Cm)
        [68, 60, 56, 53], // ii (Fm)
        [65, 62, 58, 46], // V (Bb)
        [75, 67, 58, 51], // I high
        [72, 68, 60, 44], // IV
        [67, 63, 58, 46], // I64
        [65, 62, 58, 46], // V7
        [63, 58, 55, 51]  // I final
      ]
    }
  ];

  function countLineSyllables(line) {
    const clean = (line || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z\s]/g, '');
    const vowelGroups = clean.match(/[aeiouy]+/g);
    return Math.max(4, Math.min(14, vowelGroups ? vowelGroups.length : 8));
  }

  function generateHymnSATBScore(hymn) {
    const num = hymn ? hymn.n : 1;
    if (CURATED_SATB_SCORES[num]) {
      return CURATED_SATB_SCORES[num];
    }

    const template = HYMN_KEY_PROGRESSIONS[num % HYMN_KEY_PROGRESSIONS.length];
    const firstStanza = hymn && hymn.s && hymn.s[0] ? hymn.s[0].t : '';
    const rawLines = firstStanza.split('\n').filter((l) => l.trim().length > 0);
    const lines = rawLines.length > 0 ? rawLines.slice(0, 6) : ['a', 'b', 'c', 'd'];

    const chordSeq = [];
    const prog = template.chords;

    lines.forEach((line, lineIdx) => {
      const syllables = countLineSyllables(line);
      const isLastLine = lineIdx === lines.length - 1;
      for (let i = 0; i < syllables; i++) {
        const isLineEnd = i === syllables - 1;
        let chordIdx;
        if (isLastLine && isLineEnd) {
          chordIdx = prog.length - 1; // Final tonic cadence
        } else if (isLastLine && i === syllables - 2) {
          chordIdx = prog.length - 2; // Dominant V7 before final tonic
        } else if (isLineEnd) {
          chordIdx = lineIdx % 2 === 0 ? 4 : 0; // Half cadence or tonic
        } else {
          chordIdx = (lineIdx * 3 + i + (num % 5)) % (prog.length - 2);
        }
        const [s, a, t, b] = prog[chordIdx];
        const dur = isLineEnd ? (isLastLine ? 3 : 2) : 1;
        chordSeq.push([s, a, t, b, dur]);
      }
    });

    const built = buildScoreFromChords(template.bpm, '4/4', chordSeq);
    built.isAuthentic = false;
    return built;
  }

  // ==================== CUSTOM MIDI STORAGE & PARSER (.MID) ====================
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
      console.warn('No se pudo guardar MIDI personalizado en localStorage:', e);
    }
  }

  function getScoreForHymn(hymn) {
    const num = hymn ? hymn.n : 1;
    const customMap = loadCustomMidisMap();
    if (customMap[String(num)]) {
      return customMap[String(num)];
    }
    return generateHymnSATBScore(hymn);
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
    const format = readUInt16();
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

    // Case 1: Multi-track MIDI with 4 melodic tracks (S, A, T, B)
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
      // Case 2: Single-track or 2-staff (Treble + Bass) polyphonic MIDI -> group simultaneous notes into chords and split into SATB
      const timeBuckets = new Map();
      for (const n of allNotes) {
        const bucketKey = Math.round(n.t * 4) / 4;
        if (!timeBuckets.has(bucketKey)) timeBuckets.set(bucketKey, []);
        timeBuckets.get(bucketKey).push(n);
      }

      for (const [, group] of timeBuckets) {
        group.sort((a, b) => b.p - a.p); // Highest to lowest pitch
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

  // Export any 4-voice SATB score to a standard 4-Track binary .MID file
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
      { key: 'S', name: 'Soprano', ch: 0, prog: 52 },  // Choir Aahs
      { key: 'A', name: 'Contralto', ch: 1, prog: 52 },
      { key: 'T', name: 'Tenor', ch: 2, prog: 52 },
      { key: 'B', name: 'Bajo', ch: 3, prog: 52 }
    ];

    const trackChunks = [];

    // Tempo & Meta Track 0
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
      // Track Name
      const nameArr = strBytes(vc.name);
      trackBytes.push(0x00, 0xff, 0x03, nameArr.length, ...nameArr);
      // Program Change (Choir / Organ)
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
      ...uint16Bytes(1), // Format 1 (multi-track)
      ...uint16Bytes(trackChunks.length),
      ...uint16Bytes(ticksPerBeat)
    ];

    const allBytes = new Uint8Array([...header, ...trackChunks.flat()]);
    return new Blob([allBytes], { type: 'audio/midi' });
  }

  // ==================== WEB AUDIO API 4-VOICE SATB SYNTHESIZER ====================
  let audioCtx = null;
  let isPlaying = false;
  let currentBeat = 0;
  let lastFrameTime = 0;
  let rafId = null;
  let currentHymn = null;
  let currentScore = null;

  // Rehearsal state:
  // practiceMode: 'mix' (toggle any voice on/off) | 'focus' (selected voice 100%, others 22%) | 'solo' (selected voice 100%, others 0%)
  let practiceMode = 'focus';
  let focusedVoice = 'S'; // 'S' | 'A' | 'T' | 'B'
  let voiceEnabled = { S: true, A: true, T: true, B: true };
  let tempoMultiplier = 1.0;
  let transposeSemitones = 0;

  // Active scheduled/playing oscillators per voice
  const triggeredNotesSet = new Set();
  const activeVoicePitch = { S: 0, A: 0, T: 0, B: 0 };

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
    // 'mix' mode
    return voiceEnabled[voiceKey] ? 0.85 : 0.0;
  }

  function playVoiceNote(voiceKey, midiPitch, durationSec) {
    const level = getVoiceGainLevel(voiceKey);
    if (level <= 0.001) return;
    const ctx = ensureAudioContext();
    const now = ctx.currentTime;
    const freq = midiToFreq(midiPitch + transposeSemitones);

    // Master envelope for this note
    const env = ctx.createGain();
    const peakGain = 0.24 * level;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + 0.035);
    env.gain.setValueAtTime(peakGain * 0.88, now + Math.max(0.05, durationSec - 0.05));
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    // Warm low-pass filter for pleasant choral/organ tone
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const isLead =
      (practiceMode === 'focus' || practiceMode === 'solo') && voiceKey === focusedVoice;
    filter.frequency.setValueAtTime(isLead ? 2600 : 1650, now);

    // Oscillator 1: Primary harmonic
    const osc1 = ctx.createOscillator();
    osc1.type = isLead ? 'sawtooth' : 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    // Oscillator 2: Warm chorus sub/detune
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq, now);
    osc2.detune.setValueAtTime(voiceKey === 'S' ? 4 : voiceKey === 'B' ? -4 : 2, now);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec + 0.02);
    osc2.stop(now + durationSec + 0.02);
  }

  function updateConsoleUI() {
    const playBtn = document.getElementById('btn-midi-play');
    if (playBtn) {
      playBtn.innerHTML = isPlaying ? '<span>⏸ Pausar</span>' : '<span>▶ Ensayar</span>';
      playBtn.classList.toggle('playing', isPlaying);
    }

    const totalBeats = currentScore ? currentScore.totalBeats : 32;
    const bpm = (currentScore ? currentScore.bpm : 90) * tempoMultiplier;
    const curSec = Math.floor((currentBeat / bpm) * 60);
    const totSec = Math.floor((totalBeats / bpm) * 60);
    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    const timeEl = document.getElementById('midi-time-label');
    if (timeEl) timeEl.textContent = `${fmt(curSec)} / ${fmt(totSec)}`;

    const seekEl = document.getElementById('midi-seek-slider');
    if (seekEl && document.activeElement !== seekEl) {
      seekEl.max = String(totalBeats);
      seekEl.value = String(Math.min(totalBeats, currentBeat));
    }

    // Update mode chips
    document.querySelectorAll('[data-midi-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-midi-mode') === practiceMode);
    });

    // Status badge
    const badgeEl = document.getElementById('midi-source-badge');
    if (badgeEl && currentScore) {
      if (currentScore.isCustomMidi) {
        badgeEl.textContent = '🎹 MIDI Personalizado (4 Voces)';
      } else if (currentScore.isAuthentic) {
        badgeEl.textContent = '🎼 Partitura Coral SATB';
      } else {
        badgeEl.textContent = '🎵 Armonía Coral SATB (4 Voces)';
      }
    }

    // Update 4 voice cards
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

    // Update tempo & transpose labels
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
    if (!isPlaying || !currentScore) return;
    if (!lastFrameTime) lastFrameTime = timestamp;
    const dtSec = Math.min(0.1, (timestamp - lastFrameTime) / 1000);
    lastFrameTime = timestamp;

    const effectiveBpm = (currentScore.bpm || 90) * tempoMultiplier;
    const prevBeat = currentBeat;
    currentBeat += dtSec * (effectiveBpm / 60);

    // Check notes starting in [prevBeat, currentBeat]
    ['S', 'A', 'T', 'B'].forEach((vk) => {
      const notes = currentScore.voices[vk] || [];
      let currentActivePitch = 0;
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        const noteId = `${vk}_${i}`;
        if (n.t >= prevBeat - 0.02 && n.t <= currentBeat && !triggeredNotesSet.has(noteId)) {
          triggeredNotesSet.add(noteId);
          const durSec = Math.max(0.12, (n.d / effectiveBpm) * 60 * 0.94);
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

  function startPlayback() {
    if (!currentScore) return;
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
    activeVoicePitch.S = 0;
    activeVoicePitch.A = 0;
    activeVoicePitch.T = 0;
    activeVoicePitch.B = 0;
    updateConsoleUI();
  }

  function stopPlayback() {
    isPlaying = false;
    cancelAnimationFrame(rafId);
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
    } else {
      updateConsoleUI();
    }
  }

  function bindRehearsalEvents(notifyToast) {
    document.getElementById('btn-midi-play')?.addEventListener('click', () => {
      if (isPlaying) pausePlayback();
      else startPlayback();
    });

    document.getElementById('btn-midi-stop')?.addEventListener('click', () => {
      stopPlayback();
    });

    const seekSlider = document.getElementById('midi-seek-slider');
    if (seekSlider) {
      seekSlider.addEventListener('input', () => {
        currentBeat = Number(seekSlider.value) || 0;
        triggeredNotesSet.clear();
        // Mark earlier notes as already triggered
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

    // Mode switching ('focus' | 'solo' | 'mix')
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

    // 4 Voice buttons (Soprano, Contralto, Tenor, Bajo)
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
          // 'mix' mode: toggle individual voice on/off
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

    // Tempo controls
    document.getElementById('btn-midi-tempo-dec')?.addEventListener('click', () => {
      tempoMultiplier = Math.max(0.6, Number((tempoMultiplier - 0.1).toFixed(2)));
      updateConsoleUI();
    });

    document.getElementById('btn-midi-tempo-inc')?.addEventListener('click', () => {
      tempoMultiplier = Math.min(1.4, Number((tempoMultiplier + 0.1).toFixed(2)));
      updateConsoleUI();
    });

    // Transpose controls
    document.getElementById('btn-midi-trans-dec')?.addEventListener('click', () => {
      transposeSemitones = Math.max(-6, transposeSemitones - 1);
      updateConsoleUI();
    });

    document.getElementById('btn-midi-trans-inc')?.addEventListener('click', () => {
      transposeSemitones = Math.min(6, transposeSemitones + 1);
      updateConsoleUI();
    });

    // Upload custom .MID file for the current hymn
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

    // Download 4-track .MID file of the current hymn
    document.getElementById('btn-midi-download')?.addEventListener('click', () => {
      if (!currentScore || !currentHymn) return;
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
