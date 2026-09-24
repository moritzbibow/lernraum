#!/usr/bin/env node
/**
 * Demo-Inhalte (wie in den Mockups) über die Ingest-API einspeisen.
 *
 *   LERNRAUM_URL=http://localhost:3000 LERNRAUM_API_TOKEN=… node scripts/seed-demo.mjs [--progress]
 *
 * --progress  setzt zusätzlich Lesefortschritt, Quiz-Ergebnisse und Eingang-Status
 *             direkt in der SQLite-Datei (DATABASE_PATH), damit die Übersicht
 *             aussieht wie im Design. Nur für Demo/Tests gedacht.
 */
const BASE = (process.env.LERNRAUM_URL || 'http://localhost:3000').replace(/\/+$/, '')
const TOKEN = process.env.LERNRAUM_API_TOKEN
if (!TOKEN) {
  console.error('LERNRAUM_API_TOKEN fehlt.')
  process.exit(1)
}

const mc = (prompt, answers, correctIndex, explanation, topic) => ({
  type: 'mc',
  prompt,
  answers: answers.map((text, i) => ({ text, correct: i === correctIndex })),
  explanation,
  topic,
})
const tf = (prompt, correct, explanation, topic) => ({ type: 'tf', prompt, correct, explanation, topic })
const txt = (prompt, accepted, explanation, topic) => ({ type: 'text', prompt, correct: accepted, explanation, topic })

const items = [
  {
    subject: 'Sport',
    path: ['Sporttheorie'],
    page: {
      title: 'Stunde 1 – Motorik',
      date: '2026-08-29',
      content_md: `## Motorische Fähigkeiten

Motorische Fähigkeiten sind die Grundlage jeder sportlichen Bewegung. Man unterscheidet **konditionelle** (energetisch bestimmte) und **koordinative** (informationell gesteuerte) Fähigkeiten.

| Konditionell | Koordinativ |
|---|---|
| Kraft | Gleichgewicht |
| Ausdauer | Reaktion |
| Schnelligkeit | Orientierung |
| Beweglichkeit | Rhythmisierung |

:::merke
Schnelligkeit und Beweglichkeit gelten als Mischformen – sie hängen sowohl von energetischen als auch von koordinativen Faktoren ab.
:::

## Motorisches Lernen

Motorisches Lernen verläuft in drei Phasen: Grobform, Feinform und Feinstform (variable Verfügbarkeit).

:::beispiel
Beim Erlernen des Pritschens im Volleyball gelingt die Bewegung zuerst nur mit Zuspiel aus der Hand (Grobform), später auch im Spiel unter Druck (Feinstform).
:::`,
    },
    quiz: {
      title: 'Motorik',
      questions: [
        mc('Welche Fähigkeit gehört zu den koordinativen Fähigkeiten?', ['Kraft', 'Gleichgewicht', 'Ausdauer', 'Beweglichkeit'], 1, 'Gleichgewicht wird informationell gesteuert – also koordinativ.', 'Motorische Fähigkeiten'),
        mc('Wie heißt die erste Phase des motorischen Lernens?', ['Feinform', 'Grobform', 'Feinstform', 'Automatisierung'], 1, 'Zuerst gelingt die Bewegung nur in der Grobform.', 'Motorisches Lernen'),
        tf('Kraft ist eine konditionelle Fähigkeit.', true, 'Kraft ist energetisch bestimmt.'),
        tf('Schnelligkeit ist rein koordinativ.', false, 'Schnelligkeit ist eine Mischform.'),
        mc('Was kennzeichnet die Feinstform?', ['Bewegung gelingt nur ohne Störung', 'Variable Verfügbarkeit auch unter Druck', 'Erste Ausführung', 'Bewegung wird vorgestellt'], 1, 'In der Feinstform ist die Bewegung stabil und variabel verfügbar.'),
        txt('Nenne die Mischform aus Kondition und Koordination, die mit „B“ beginnt.', ['Beweglichkeit'], 'Beweglichkeit hängt von Gelenkstruktur und Muskelelastizität ab.'),
        tf('Reaktionsfähigkeit ist eine koordinative Fähigkeit.', true),
        mc('Welche Einteilung ist korrekt?', ['Konditionell = informationell', 'Koordinativ = energetisch', 'Konditionell = energetisch', 'Beide rein energetisch'], 2),
      ],
    },
  },
  {
    subject: 'Sport',
    path: ['Sporttheorie'],
    page: {
      title: 'Stunde 2 – Kraft',
      date: '2026-09-05',
      content_md: `## Kraftarten

Man unterscheidet **Maximalkraft**, **Schnellkraft**, **Reaktivkraft** und **Kraftausdauer**. Die Maximalkraft ist die Basisfähigkeit für alle anderen Kraftarten.

## Arbeitsweisen der Muskulatur

- **konzentrisch** – überwindend, der Muskel verkürzt sich
- **exzentrisch** – nachgebend, der Muskel wird verlängert
- **isometrisch** – haltend, keine Längenänderung

:::tipp
Eselsbrücke: *exzentrisch* = e wie „entschleunigen“ – der Muskel bremst.
:::

## Trainingsmethoden

| Ziel | Intensität | Wiederholungen |
|---|---|---|
| Hypertrophie | 60–80 % | 8–12 |
| Intramuskuläre Koordination | 85–100 % | 1–5 |
| Kraftausdauer | 30–50 % | 20+ |`,
    },
    quiz: {
      title: 'Kraft',
      questions: [
        mc('Welche Kraftart ist die Basis für alle anderen?', ['Schnellkraft', 'Maximalkraft', 'Reaktivkraft', 'Kraftausdauer'], 1, 'Maximalkraft beeinflusst alle anderen Kraftarten.', 'Kraftarten'),
        mc('Wie arbeitet der Muskel beim Absenken einer Hantel?', ['konzentrisch', 'exzentrisch', 'isometrisch', 'gar nicht'], 1, 'Nachgebende Arbeit = exzentrisch.', 'Arbeitsweisen der Muskulatur'),
        tf('Bei isometrischer Arbeit ändert sich die Muskellänge.', false, 'Isometrisch heißt haltend – ohne Längenänderung.'),
        mc('Welche Intensität passt zum Hypertrophietraining?', ['30–50 %', '60–80 %', '85–100 %', '100–120 %'], 1, undefined, 'Trainingsmethoden'),
        txt('Wie heißt die Kraftart, die bei Sprüngen mit kurzem Bodenkontakt wichtig ist?', ['Reaktivkraft'], 'Reaktivkraft nutzt den Dehnungs-Verkürzungs-Zyklus.'),
        tf('Kraftausdauer wird mit vielen Wiederholungen trainiert.', true),
        mc('Wofür stehen 1–5 Wiederholungen bei 85–100 %?', ['Kraftausdauer', 'Hypertrophie', 'Intramuskuläre Koordination', 'Aufwärmen'], 2),
        tf('Konzentrische Arbeit ist überwindend.', true),
        mc('Welche Arbeitsweise ist beim Halten im Liegestütz gefragt?', ['isometrisch', 'exzentrisch', 'konzentrisch', 'reaktiv'], 0),
        txt('Wie nennt man die Vergrößerung des Muskelquerschnitts?', ['Hypertrophie', 'Muskelhypertrophie']),
      ],
    },
  },
  {
    subject: 'Sport',
    path: ['Sporttheorie'],
    page: {
      title: 'Stunde 3 – Schnelligkeit',
      date: '2026-09-09',
      content_md: `## Erscheinungsformen

Schnelligkeit zeigt sich als **Reaktionsschnelligkeit**, **Aktionsschnelligkeit** und **Frequenzschnelligkeit**.

## Einflussfaktoren

Entscheidend sind der Anteil schneller Muskelfasern (Typ II), die neuromuskuläre Ansteuerung und die Technik.

:::achtung
Schnelligkeit nur im ausgeruhten Zustand trainieren – Ermüdung verschlechtert die Qualität und prägt langsame Bewegungsmuster ein.
:::`,
    },
  },
  {
    subject: 'Sport',
    path: ['Sporttheorie'],
    page: {
      title: 'Stunde 4 – Trainingsprinzipien',
      heading: 'Trainingsprinzipien & Superkompensation',
      date: '2026-09-12',
      content_md: `## Superkompensation

Nach einer Trainingsbelastung sinkt die Leistungsfähigkeit zunächst ab. In der Erholungsphase baut der Körper sie nicht nur wieder auf, sondern kurzzeitig über das Ausgangsniveau hinaus – das ist die Superkompensation.

:::merke
Der nächste Reiz sollte im Hoch der Superkompensation gesetzt werden – zu früh führt zu Übertraining, zu spät verpufft der Effekt.
:::

## Progressive Belastung

Belastungen müssen in Abständen gesteigert werden, damit weiterhin Anpassungen erfolgen. Möglich über Umfang, Intensität, Dichte oder Häufigkeit.

| Stellgröße | Beispiel |
|---|---|
| Umfang | mehr Wiederholungen oder Kilometer |
| Intensität | höheres Gewicht, schnelleres Tempo |
| Dichte | kürzere Pausen |
| Häufigkeit | mehr Einheiten pro Woche |

## Regeneration

Regeneration ist Teil des Trainings: Erst in der Pause entstehen die Anpassungen. Schlaf, Ernährung und aktive Erholung beschleunigen sie.

:::tipp
Faustregel: Nach intensiven Einheiten 48–72 Stunden, bis dieselbe Muskelgruppe wieder hart belastet wird.
:::

## Individualität

Jeder Mensch reagiert anders auf Trainingsreize. Alter, Trainingszustand, Veranlagung und Tagesform bestimmen die richtige Belastung.

## Kontinuität

Anpassungen bleiben nur erhalten, wenn regelmäßig trainiert wird. Längere Pausen führen zur Rückbildung (Reversibilität).

:::details[Selbsttest: Was passiert bei zu früher Belastung?]
Die Leistungsfähigkeit hat das Ausgangsniveau noch nicht wieder erreicht. Wer jetzt erneut belastet, summiert Ermüdung – auf Dauer droht Übertraining.
:::`,
    },
    quiz: {
      title: 'Trainingsprinzipien',
      questions: [
        mc('Was beschreibt Superkompensation?', ['Sofortige Leistungssteigerung während der Belastung', 'Anstieg der Leistungsfähigkeit über das Ausgangsniveau nach der Erholung', 'Dauerhafte Ermüdung', 'Absinken der Leistung bei Pausen'], 1, 'Nach der Erholung steigt die Leistungsfähigkeit kurzzeitig über das Ausgangsniveau.', 'Superkompensation'),
        txt('Nenne eine Stellgröße der Belastung (Umfang, Intensität, Dichte oder Häufigkeit).', ['Umfang', 'Intensität', 'Dichte', 'Häufigkeit'], 'Alle vier Stellgrößen steuern die Belastung.', 'Progressive Belastung'),
        mc('Übertraining entsteht, wenn …', ['… die Pausen zu lang sind', '… der nächste Reiz zu früh gesetzt wird', '… zu wenig trainiert wird', '… nur Ausdauer trainiert wird'], 1, 'Zu frühe Reize summieren die Ermüdung.', 'Superkompensation'),
        mc('Wann sollte der nächste Trainingsreiz idealerweise gesetzt werden?', ['Direkt nach der Belastung', 'Am Tiefpunkt der Ermüdung', 'Im Hoch der Superkompensation', 'Nach vollständiger Rückkehr auf das Ausgangsniveau'], 2, 'Dann ist die Leistungsfähigkeit über dem Ausgangsniveau – der neue Reiz baut darauf auf.', 'Superkompensation'),
        tf('Regeneration ist Teil des Trainings.', true, 'Anpassungen entstehen in der Erholungsphase.', 'Regeneration'),
        mc('Was bedeutet Individualität im Training?', ['Alle trainieren gleich', 'Belastung wird an die Person angepasst', 'Training nur allein', 'Keine Trainingspläne'], 1, undefined, 'Individualität'),
        tf('Längere Trainingspausen führen zur Rückbildung von Anpassungen.', true, 'Das Prinzip der Reversibilität.', 'Kontinuität'),
        mc('Welche Maßnahme erhöht die Belastungsdichte?', ['Mehr Einheiten pro Woche', 'Kürzere Pausen', 'Höheres Gewicht', 'Längere Läufe'], 1, undefined, 'Progressive Belastung'),
        mc('Was passiert, wenn der nächste Reiz zu spät kommt?', ['Übertraining', 'Der Trainingseffekt verpufft', 'Die Leistung explodiert', 'Nichts'], 1, 'Die Superkompensation ist wieder abgeklungen.', 'Superkompensation'),
        tf('Progressive Belastung heißt, immer mit maximaler Intensität zu trainieren.', false, 'Belastung wird schrittweise gesteigert, nicht sofort maximal.', 'Progressive Belastung'),
        txt('Wie heißt das Prinzip, nach dem Anpassungen ohne Training verloren gehen?', ['Reversibilität', 'Reversibilitätsprinzip'], undefined, 'Kontinuität'),
        mc('Welcher Faktor gehört NICHT zur Individualität?', ['Alter', 'Trainingszustand', 'Wetterbericht', 'Veranlagung'], 2, undefined, 'Individualität'),
      ],
    },
  },
  {
    subject: 'Sport',
    path: ['Sportpraxis'],
    page: {
      title: 'Volleyball – Pritschen',
      content_md: `## Technik

Die Hände bilden ein Dreieck über der Stirn, der Ball wird mit allen Fingern gespielt. Die Bewegung kommt aus den Beinen.

## Typische Fehler

:::achtung
Ball zu tief gespielt, Finger steif, keine Streckung aus den Beinen.
:::`,
    },
  },
  {
    subject: 'Englisch',
    path: ['Grammatik'],
    page: {
      title: 'Past Perfect vs. Simple Past',
      content_md: `## Simple Past

The simple past describes completed actions at a specific time in the past: *I **visited** London last year.*

## Past Perfect

The past perfect (*had* + past participle) shows that one past action happened **before** another: *When we arrived, the film **had** already **started**.*

:::merke
Past Perfect = „Vorvergangenheit“. Es braucht immer einen zweiten Zeitpunkt in der Vergangenheit, auf den es sich bezieht.
:::

## Signalwörter

| Simple Past | Past Perfect |
|---|---|
| yesterday, ago, last week | already, before, after, by the time |
| in 2019 | just, never … before |

## Übung

:::details[Lösung: „After she ___ (finish) her homework, she went out.“]
**had finished** – das Beenden der Hausaufgaben passierte vor dem Rausgehen.
:::`,
    },
  },
  {
    subject: 'Englisch',
    path: ['Vokabeln'],
    page: {
      title: 'Irregular Verbs',
      content_md: `## Die wichtigsten unregelmäßigen Verben

| Infinitive | Simple Past | Past Participle | Deutsch |
|---|---|---|---|
| be | was/were | been | sein |
| begin | began | begun | beginnen |
| bring | brought | brought | bringen |
| choose | chose | chosen | wählen |
| go | went | gone | gehen |
| take | took | taken | nehmen |
| write | wrote | written | schreiben |

:::tipp
Verben mit gleichem Muster zusammen lernen: *bring – brought – brought*, *think – thought – thought*.
:::`,
    },
    quiz: {
      title: 'Irregular Verbs',
      questions: [
        txt('Simple Past von „go“?', ['went']),
        txt('Past Participle von „write“?', ['written']),
        mc('Welche Formenreihe ist korrekt?', ['bring – brang – brung', 'bring – brought – brought', 'bring – bringed – bringed', 'bring – brought – brung'], 1),
        txt('Simple Past von „choose“?', ['chose']),
        tf('„begin – began – begun“ ist korrekt.', true),
        txt('Past Participle von „take“?', ['taken']),
      ],
    },
  },
  {
    subject: 'Mathe',
    path: ['Analysis'],
    page: {
      title: 'Quadratische Funktionen',
      content_md: `## Normalform und Scheitelpunktform

Eine quadratische Funktion hat die Normalform $f(x) = ax^2 + bx + c$ mit $a \\neq 0$. In der Scheitelpunktform

$$
f(x) = a(x - d)^2 + e
$$

liest man den Scheitelpunkt $S(d \\mid e)$ direkt ab.

## Nullstellen

Mit der **p-q-Formel** (für $x^2 + px + q = 0$):

$$
x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{\\left(\\frac{p}{2}\\right)^2 - q}
$$

:::merke
Ist die Diskriminante $\\left(\\frac{p}{2}\\right)^2 - q$ negativ, gibt es keine reellen Nullstellen.
:::`,
    },
  },
  {
    subject: 'Philosophie',
    path: ['Ethik'],
    page: {
      title: 'Kants kategorischer Imperativ',
      content_md: `## Grundformel

:::zitat{quelle="Immanuel Kant, Grundlegung zur Metaphysik der Sitten"}
Handle nur nach derjenigen Maxime, durch die du zugleich wollen kannst, dass sie ein allgemeines Gesetz werde.
:::

## Selbstzweckformel

Menschen dürfen nie **bloß als Mittel**, sondern müssen immer auch als **Zweck an sich** behandelt werden.

:::definition
**Maxime:** eine subjektive Handlungsregel, z. B. „Ich lüge, wenn es mir nützt.“
:::`,
    },
  },
  {
    subject: 'Geschichte',
    path: ['20. Jh.'],
    page: {
      title: 'Die Weimarer Republik',
      content_md: `## Überblick

Die Weimarer Republik (1918–1933) war die erste parlamentarische Demokratie Deutschlands.

\`\`\`mermaid
timeline
  title Weimarer Republik
  1918 : Novemberrevolution
  1919 : Weimarer Verfassung
  1923 : Hyperinflation
  1929 : Weltwirtschaftskrise
  1933 : Machtübernahme der NSDAP
\`\`\`

## Belastungen

- Versailler Vertrag und „Dolchstoßlegende“
- Inflation 1923 und Weltwirtschaftskrise 1929
- Artikel 48 (Notverordnungsrecht des Reichspräsidenten)

:::merke
Die Kombination aus wirtschaftlicher Krise, Präsidialkabinetten (Art. 48) und fehlendem Rückhalt für die Demokratie ebnete den Weg in die Diktatur.
:::`,
    },
  },
  {
    page: {
      title: 'Lerntechniken – Active Recall',
      content_md: `## Active Recall

Statt Texte nur erneut zu lesen, holst du das Wissen aktiv aus dem Gedächtnis – mit Fragen, Karteikarten oder Quizzen.

## Spaced Repetition

Wiederhole in wachsenden Abständen: nach 1 Tag, 3 Tagen, 1 Woche, 2 Wochen.

:::tipp
Nach jeder Lernseite direkt das Quiz spielen – das ist Active Recall in Reinform.
:::`,
    },
  },
  {
    subject: 'Sport',
    path: ['Sporttheorie'],
    page: {
      title: 'Stunde 5 – Ausdauertraining',
      date: '2026-09-19',
      content_md: `## Grundlagen

Ausdauer ist die Widerstandsfähigkeit gegen Ermüdung. Man unterscheidet **aerobe** (mit Sauerstoff) und **anaerobe** Energiebereitstellung.

## Methoden

| Methode | Belastung | Ziel |
|---|---|---|
| Dauermethode | lange, gleichmäßig | Grundlagenausdauer |
| Intervallmethode | Wechsel Belastung/lohnende Pause | Tempo, VO₂max |
| Wiederholungsmethode | maximal, volle Pause | Wettkampfspezifik |
| Wettkampfmethode | Wettkampfbedingungen | Leistungsüberprüfung |

:::merke
Die „lohnende Pause“ der Intervallmethode endet bei einer Herzfrequenz von etwa 120–130 Schlägen pro Minute.
:::

## Anpassungen

Regelmäßiges Ausdauertraining vergrößert das Herz (Sportlerherz), senkt den Ruhepuls und erhöht die Kapillarisierung der Muskulatur.`,
    },
    quiz: {
      title: 'Ausdauer',
      questions: [
        mc('Welche Methode trainiert vor allem die Grundlagenausdauer?', ['Dauermethode', 'Wiederholungsmethode', 'Wettkampfmethode', 'Sprintmethode'], 0, undefined, 'Methoden'),
        tf('Aerob bedeutet „mit Sauerstoff“.', true, undefined, 'Grundlagen'),
        mc('Wann endet die lohnende Pause?', ['bei 60–70 Schlägen/min', 'bei 120–130 Schlägen/min', 'bei 180 Schlägen/min', 'nach genau 5 Minuten'], 1, undefined, 'Methoden'),
        txt('Wie heißt das durch Training vergrößerte Herz?', ['Sportlerherz'], undefined, 'Anpassungen'),
        tf('Ausdauertraining erhöht den Ruhepuls.', false, 'Der Ruhepuls sinkt.', 'Anpassungen'),
        mc('Welche Methode arbeitet mit maximaler Belastung und vollständiger Pause?', ['Intervallmethode', 'Wiederholungsmethode', 'Dauermethode', 'Fahrtspiel'], 1, undefined, 'Methoden'),
        mc('Was verbessert die Intervallmethode besonders?', ['Beweglichkeit', 'Tempo und VO₂max', 'Koordination', 'Maximalkraft'], 1, undefined, 'Methoden'),
        tf('Anaerobe Energiebereitstellung kommt ohne Sauerstoff aus.', true, undefined, 'Grundlagen'),
        txt('Wie nennt man die bessere Versorgung des Muskels mit feinen Blutgefäßen?', ['Kapillarisierung'], undefined, 'Anpassungen'),
        mc('Wofür eignet sich die Wettkampfmethode?', ['Regeneration', 'Leistungsüberprüfung', 'Technikerwerb', 'Aufwärmen'], 1, undefined, 'Methoden'),
      ],
    },
  },
]

async function post(body) {
  const res = await fetch(`${BASE}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`)
  return json
}

const results = {}
for (const item of items) {
  const r = await post(item)
  results[item.page.title] = r
  console.log(`${r.created ? '+' : '~'} ${r.path}${r.quizId ? ` (+ Quiz, ${r.questionCount} Fragen)` : ''}`)
}

if (process.argv.includes('--progress')) {
  const { default: Database } = await import('better-sqlite3')
  const path = await import('node:path')
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'lernraum.db')
  const db = new Database(file)
  const now = Date.now()
  const min = 60_000
  const day = 24 * 60 * min
  const page = (title) => results[title].pageId
  const quiz = (title) => results[title].quizId

  // Realistic ages so lists and the Verwalten table look lived-in.
  const ages = {
    'Stunde 1 – Motorik': 26 * day,
    'Stunde 2 – Kraft': 19 * day,
    'Stunde 3 – Schnelligkeit': 15 * day,
    'Stunde 4 – Trainingsprinzipien': 12 * day,
    'Volleyball – Pritschen': 23 * day,
    'Past Perfect vs. Simple Past': day + 5 * 60 * min,
    'Irregular Verbs': day + 6 * 60 * min,
    'Quadratische Funktionen': 3 * day,
    'Kants kategorischer Imperativ': 9 * day,
    'Die Weimarer Republik': day + 3 * 60 * min,
    'Lerntechniken – Active Recall': 14 * day,
    'Stunde 5 – Ausdauertraining': 12 * min,
  }
  db.prepare('UPDATE pages SET created_at = ?, updated_at = ?, content_updated_at = ?').run(now - 27 * day, now - 27 * day, now - 27 * day)
  db.prepare('UPDATE quizzes SET created_at = ?, updated_at = ?').run(now - 27 * day, now - 27 * day)
  const setAge = db.prepare('UPDATE pages SET created_at = ?, updated_at = ?, content_updated_at = ? WHERE id = ?')
  const setQuizAge = db.prepare('UPDATE quizzes SET created_at = ?, updated_at = ? WHERE id = ?')
  const setInboxAge = db.prepare('UPDATE inbox_items SET created_at = ? WHERE ref_id = ?')
  for (const [title, age] of Object.entries(ages)) {
    const t = now - age
    setAge.run(t, t, t, page(title))
    setInboxAge.run(t, page(title))
    if (results[title].quizId) {
      setQuizAge.run(t, t, quiz(title))
      setInboxAge.run(t, quiz(title))
    }
  }
  // Folders: as old as their oldest child
  db.prepare(
    `UPDATE pages SET created_at = (SELECT min(c.created_at) FROM pages c WHERE c.parent_id = pages.id),
                      updated_at = (SELECT min(c.created_at) FROM pages c WHERE c.parent_id = pages.id)
     WHERE EXISTS (SELECT 1 FROM pages c WHERE c.parent_id = pages.id)`,
  ).run()
  db.prepare('UPDATE subjects SET created_at = ?, updated_at = ?').run(now - 27 * day, now - 27 * day)

  const setProgress = db.prepare('UPDATE pages SET topic_progress = ?, read_progress = ?, last_opened_at = ? WHERE id = ?')
  setProgress.run(
    JSON.stringify({ superkompensation: 1, 'progressive-belastung': 1, regeneration: 0.5, individualitaet: 0.5, kontinuitaet: 0 }),
    0.6,
    now - 2 * 60 * min,
    page('Stunde 4 – Trainingsprinzipien'),
  )
  setProgress.run(JSON.stringify({ 'simple-past': 1, 'past-perfect': 0.6 }), 0.4, now - day, page('Past Perfect vs. Simple Past'))
  setProgress.run(JSON.stringify({ grundformel: 0.8 }), 0.2, now - 2 * day, page('Kants kategorischer Imperativ'))
  setProgress.run(JSON.stringify({ ueberblick: 1, belastungen: 1 }), 1, now - 30 * min, page('Die Weimarer Republik'))

  const addAttempt = db.prepare('INSERT INTO attempts (id, quiz_id, score, total, details, finished_at) VALUES (?, ?, ?, ?, ?, ?)')
  addAttempt.run(`demo${now}a`, quiz('Stunde 4 – Trainingsprinzipien'), 9, 12, '[]', now - 3 * day)
  addAttempt.run(`demo${now}b`, quiz('Irregular Verbs'), 5, 6, '[]', now - 50 * min)

  // Inbox: only the latest ingests are unseen (as in the mockup: badge 3).
  db.prepare('UPDATE inbox_items SET seen_at = ?').run(now)
  const unsee = db.prepare('UPDATE inbox_items SET seen_at = NULL WHERE ref_id = ?')
  unsee.run(page('Stunde 5 – Ausdauertraining'))
  unsee.run(quiz('Stunde 5 – Ausdauertraining'))
  unsee.run(page('Die Weimarer Republik'))
  db.close()
  console.log('Fortschritt, Ergebnisse und Eingang für die Demo gesetzt.')
}
console.log(`Fertig: ${BASE}`)
