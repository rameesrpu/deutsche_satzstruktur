# Medical track ("Klinik"): design

Status: written 2026-11-16 by Claude at the owner's request ("write all plans"). The owner has
**not** reviewed the calls marked *my call*. This is the least certain of the designs: it is
the furthest away, it depends on three earlier projects, and it contains facts about German
licensing that **must be checked against official sources** before anything ships. Re-read
this design when its turn comes; expect to change it.

Roadmap project 5 ([docs/roadmap.md](../../roadmap.md)). Two plans come out of it:

| Plan | Contents |
|---|---|
| [5a maps and terms](../plans/2026-11-16-klinik-maps-terms.md) | The Klinik screen, the path to the Approbation, medical ↔ everyday terms, the ward |
| [5b Anamnese, Arztbrief, FSP](../plans/2026-11-16-klinik-anamnese-fsp.md) | Patient interview, doctor's letter, exam practice |

5a needs the boards framework (plan 4a). 5b needs 5a, and is far more useful once the content
pipeline (translations), typing and speaking exist.

## Intent

She is a doctor. The medicine is not new to her; the German around it is, and so is the German
system: who decides about her licence, which exam comes when, how a ward is organised, how a
German doctor talks to a patient and writes a letter. This track gives each of those a
picture: a route, a floor plan, a form, a letter with fixed places.

## Goals

- She can see the whole path to working as a doctor in Baden-Württemberg, and mark where she is.
- She learns the everyday word for each medical term, because patients do not say *Appendizitis*.
- She knows the rooms and roles of a German ward before her first day of Hospitation.
- She can run a patient interview in German along the standard sections.
- She knows where each kind of sentence goes in an Arztbrief.
- She can rehearse the three parts of the Fachsprachprüfung on invented cases.

## Non-goals

- Teaching medicine, or giving medical or legal advice. Cases and patients are invented.
- Automatic grading of free German text or speech. Long answers are compared with a model
  answer by her (self-rating).
- Covering every Bundesland. The path is for Baden-Württemberg; the data names its sources.
- Kenntnisprüfung preparation (a medical exam, not a language one).

## Anti-goals

- A wrong or outdated statement about the licensing process. Every station on the path carries
  its source and the date it was checked, and the screen shows "Stand: <date>".
- Medical terms or model answers that a German doctor would not use. The owner's wife is a
  doctor and the owner lives in Stuttgart; both review the content before it ships.
- Language far above her level shown as if she should know it. Each part states its level.

## Parts

### The Klinik screen (5a)

A card on Üben, "Klinik", opens a screen with one tile per part. Parts that need a higher
level show it ("ab B1") but are not locked: seeing what is coming is part of the motivation
(*my call*).

### The path to the Approbation (5a)

A route with stations, drawn as a line she follows. Each station opens a card: what it is, the
German words she will meet there, what to hand in, how long it tends to take, the official
source. She can tick a station as done; the route fills in.

Stations as understood at the time of writing, **to be verified in plan 5a Task 1**:
general German (B2) → application for the Approbation at the Regierungspräsidium Stuttgart
(Landesprüfungsamt) → assessment of the degree (Gleichwertigkeitsprüfung) → Berufserlaubnis
(temporary permission to work under supervision) → Fachsprachprüfung at the
Landesärztekammer Baden-Württemberg (medical German, level C1) → Kenntnisprüfung if the degree
is not judged equivalent → Approbation → Weiterbildung zur Fachärztin.

### Medical ↔ everyday terms (5a)

About fifty pairs, grouped by organ system: *die Appendizitis* ↔ *die Blinddarmentzündung*.
A new board kind, "pairs":
- **Paare:** six pairs face up as twelve tiles; she taps a medical term, then its everyday word.
- **Für den Patienten:** a medical term; she picks the everyday word from four.
- **Für die Kollegin:** the everyday word; she picks the medical term from four.

### The ward (5a)

Two hotspot pictures on the existing body-map engine: the floor plan of a ward (rooms) and the
team as a diagram of boxes (roles, from Chefärztin to Pflegefachkraft), no people drawn.

### Anamnese (5b)

The interview has fixed sections (aktuelle Beschwerden, Vorerkrankungen, Medikamente,
Allergien, vegetative Anamnese, Familienanamnese, Sozialanamnese). They are drawn as the
Anamnesebogen: a form whose boxes are the sections.
- **Fragen sortieren:** standard questions as chips; she drops each on its section.
- **Gespräch:** an invented patient. Section by section she picks the fitting question from
  three; the patient answers (text and voice); she taps the key fact, and it lands in the
  form's box. At the end the form is full.

### Arztbrief (5b)

The letter as a page with its fixed sections (Diagnosen, Anamnese, Befund, Therapie und
Verlauf, Empfehlung). The sentences of the case's letter arrive shuffled; she drops each on
its section.

### FSP practice (5b)

One case, three parts, as the exam is understood at the time of writing (**to be verified**):
patient interview, written documentation, presentation to a colleague, twenty minutes each.
- Part 1 is the Gespräch above, with a visible clock.
- Part 2: she types the documentation into the form; then her text and a model text stand
  side by side, and she rates each section herself.
- Part 3: she sees a skeleton ("Frau … , 34 Jahre, stellt sich vor mit …"), presents aloud,
  listens to the model, and rates herself.

Three cases to start: abdominal pain, chest pain, a fall with a painful wrist.

## My calls (correct any of them)

- Klinik is open from the start, with levels marked, not locked.
- Baden-Württemberg only.
- Self-rating for long written and spoken answers.
- The first three cases.

## Open questions for the owner

1. Is she aiming for Approbation directly, or Hospitation and Berufserlaubnis first? The route
   can highlight her path.
2. Will she review the medical content herself, and in which language should reviewer notes be?
3. Is there a language school or FSP course she will take whose material we should match?
