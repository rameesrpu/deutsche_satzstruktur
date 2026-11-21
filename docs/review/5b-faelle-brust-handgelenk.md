# Medical content — not yet checked by a doctor

**Fälle „Brustschmerzen“ und „Sturz auf die Hand“ (cases "chest pain" and "fall on the hand"): review sheet (plan 5b, Task 5)**

Two more invented cases in the same format as „Bauchschmerzen“ (review sheet `docs/review/5b-fall-bauchschmerzen.md`). Both run in all three Klinik exercises: the Anamnese interview (*Gespräch*), *Arztbrief* sorting and the *Fachsprachenprüfung* practice run. Invented patients, invented teaching content — not medical advice.

## The practice run (Fachsprachenprüfung) — format and source

Klinik → *Fachsprachenprüfung* → a case. Three parts, 20 minutes each, as on the Landesärztekammer Baden-Württemberg's own page (checked 21.11.2026; quotes in `docs/medical-sources.md`, section "Fachsprachprüfung format"):

1. **Arzt-Patienten-Gespräch** — the interview of the case with a visible clock.
2. **Dokumentation** — one text box per section of the Anamnesebogen that has a model text (her interview notes are shown above each box). `Vergleichen` shows her text above the model text, section by section; she rates each one herself: `Passt` / `Teilweise` / `Noch nicht`.
3. **Arzt-Arzt-Gespräch** — she sees the presentation skeleton, presents aloud, taps `Ich bin fertig`, then sees (and, with a German voice, hears) the model presentation and rates herself once.

The clock only turns red when time is up; nothing is cut off. A run can be left and continued later (same part, same texts, same time left). There is no automatic grading. Not practised here: the exam's questions from the examiner after the presentation and the list of medical terms to translate into everyday German (part 3 in the real exam; the terms are practised on the "Fachsprache und Alltagssprache" board).

## New standard questions (data/medical/anamnese.json, version 3)

Added so that the red-flag questions of these cases can be asked (they also appear in "Fragen sortieren"):

- Aktuelle Beschwerden: **Treten die Schmerzen bei Belastung auf oder auch in Ruhe?** — Does the pain come on with exertion, or also at rest?
- Aktuelle Beschwerden: **War Ihnen vor dem Sturz schwindelig, oder waren Sie kurz bewusstlos?** — Were you dizzy before the fall, or did you pass out for a moment?
- Vorerkrankungen und Operationen: **Ist bei Ihnen eine Osteoporose bekannt?** — Have you been diagnosed with osteoporosis?

Please check the wording and the section of each.

## Fall „Brustschmerzen“ (chest pain; suspected stable angina pectoris)

Klinik → Anamnese → *Gespräch*, Klinik → *Arztbrief* and Klinik → *Fachsprachenprüfung* → Brustschmerzen. Level B2. Data: `data/medical/faelle/brustschmerzen.json` (version 1). Invented patient, invented teaching content — not medical advice.

The interview has 13 steps.

### Patient

- Thomas Keller, 58 Jahre, Busfahrer — Thomas Keller, 58 years old, bus driver

### Interview (Arzt-Patienten-Gespräch)

#### 1. Aktuelle Beschwerden (Presenting complaint)

- **Right question:** Was führt Sie zu uns? — What brings you to us?
- Wrong question: Schlafen Sie gut? — Do you sleep well?
- Wrong question: Sind Sie gegen Pflaster oder Latex allergisch? — Are you allergic to plasters or latex?
- **Patient:** „Ich habe seit zwei Wochen Schmerzen in der Brust. Sie kommen immer, wenn ich mich anstrenge.“ — "I have had pain in my chest for two weeks. It always comes when I exert myself."
- **Note (right):** seit 2 Wochen Brustschmerzen bei Anstrengung — chest pain on exertion for 2 weeks
- Note (wrong): seit 2 Tagen Oberbauchschmerzen nach dem Essen — upper abdominal pain after meals for 2 days
- Note (wrong): Brustschmerzen seit 2 Jahren — chest pain for 2 years

#### 2. Aktuelle Beschwerden (Presenting complaint)

- **Right question:** Können Sie den Schmerz beschreiben? — Can you describe the pain?
- Wrong question: Haben Sie Kinder? — Do you have children?
- Wrong question: Nehmen Sie die Pille oder andere Hormone ein? — Do you take the contraceptive pill or other hormones?
- **Patient:** „Es drückt, wie ein schweres Gewicht auf der Brust. Hier in der Mitte.“ — "It presses, like a heavy weight on my chest. Here in the middle."
- **Note (right):** drückender Schmerz retrosternal — pressing pain behind the breastbone
- Note (wrong): stechender Schmerz, stärker beim Einatmen — stabbing pain, worse when breathing in
- Note (wrong): Schmerz nur bei Druck auf die Rippen — pain only when pressing on the ribs

#### 3. Aktuelle Beschwerden (Presenting complaint)

- **Right question:** Strahlen die Schmerzen aus? — Does the pain spread anywhere?
- Wrong question: Gibt es in Ihrer Familie Krebserkrankungen? — Is there any cancer in your family?
- Wrong question: Ist Ihr Impfschutz gegen Tetanus aktuell? — Is your tetanus vaccination up to date?
- **Patient:** „Ja, manchmal in den linken Arm und in den Hals.“ — "Yes, sometimes into my left arm and my neck."
- **Note (right):** Ausstrahlung in den linken Arm und den Hals — spreading to the left arm and the neck
- Note (wrong): keine Ausstrahlung — does not spread
- Note (wrong): Ausstrahlung in den Rücken zwischen die Schulterblätter — spreading to the back between the shoulder blades

#### 4. Aktuelle Beschwerden (Presenting complaint)

- **Right question:** Treten die Schmerzen bei Belastung auf oder auch in Ruhe? — Does the pain come on with exertion, or also at rest?
- Wrong question: Vertragen Sie bestimmte Lebensmittel nicht? — Are there any foods you cannot tolerate?
- Wrong question: Sind Sie verheiratet? — Are you married?
- **Patient:** „Nur bei Belastung, zum Beispiel auf der Treppe. Wenn ich stehen bleibe, ist es nach drei, vier Minuten weg. In Ruhe habe ich keine Schmerzen.“ — "Only with exertion, for example on the stairs. When I stop, it goes away after three or four minutes. At rest I have no pain."
- **Note (right):** nur bei Belastung, in Ruhe nach wenigen Minuten rückläufig, kein Ruheschmerz — only on exertion, goes away after a few minutes of rest, no pain at rest
- Note (wrong): Schmerzen auch in Ruhe und nachts — pain also at rest and at night
- Note (wrong): Besserung bei Belastung — better with exertion

#### 5. Aktuelle Beschwerden (Presenting complaint)

- **Right question:** Wie stark sind die Schmerzen auf einer Skala von eins bis zehn? — How bad is the pain on a scale from one to ten?
- Wrong question: Leben Ihre Eltern noch? — Are your parents still alive?
- Wrong question: Wie oft am Tag nehmen Sie das Medikament ein? — How many times a day do you take the medication?
- **Patient:** „Ungefähr fünf. Es ist immer gleich, es wird nicht schlimmer.“ — "About five. It is always the same, it is not getting worse."
- **Note (right):** Schmerzstärke 5/10, seit 2 Wochen gleichbleibend — pain 5/10, unchanged for 2 weeks
- Note (wrong): Schmerzstärke 9/10, zunehmend — pain 9/10, getting worse
- Note (wrong): Schmerzstärke 2/10 — pain 2/10

#### 6. Aktuelle Beschwerden (Presenting complaint)

- **Right question:** Haben Sie noch andere Beschwerden, zum Beispiel Übelkeit oder Erbrechen? — Do you have any other symptoms, for example nausea or vomiting?
- Wrong question: Hatten Sie schon einmal einen Unfall? — Have you ever had an accident?
- Wrong question: Vertragen Sie Penicillin und andere Antibiotika? — Can you tolerate penicillin and other antibiotics?
- **Patient:** „Ja, ich bekomme dann schlecht Luft und ich schwitze. Übel ist mir nicht.“ — "Yes, then I can't breathe well and I sweat. I don't feel sick."
- **Note (right):** begleitend Dyspnoe und Schwitzen, keine Übelkeit — with shortness of breath and sweating, no nausea
- Note (wrong): Übelkeit und Erbrechen — nausea and vomiting
- Note (wrong): Husten mit Fieber — cough with fever

#### 7. Vorerkrankungen und Operationen (Past medical and surgical history)

- **Right question:** Haben Sie chronische Erkrankungen, zum Beispiel Bluthochdruck oder Diabetes? — Do you have any chronic illnesses, for example high blood pressure or diabetes?
- Wrong question: Treiben Sie Sport? — Do you do any sport?
- Wrong question: Hat sich Ihr Stuhlgang verändert? — Have your bowel movements changed?
- **Patient:** „Ich habe seit zehn Jahren hohen Blutdruck. Und mein Cholesterin ist zu hoch.“ — "I have had high blood pressure for ten years. And my cholesterol is too high."
- **Note (right):** arterielle Hypertonie seit 10 Jahren, Hypercholesterinämie — high blood pressure for 10 years, high cholesterol
- Note (wrong): Diabetes mellitus Typ 2 — type 2 diabetes
- Note (wrong): Z. n. Herzinfarkt — status after a heart attack

#### 8. Medikamente (Medication)

- **Right question:** Welche Medikamente nehmen Sie, und in welcher Dosierung? — Which medication do you take, and at what dose?
- Wrong question: Gibt es in Ihrer Familie Diabetes oder Bluthochdruck? — Is there any diabetes or high blood pressure in your family?
- Wrong question: War Ihnen vor dem Sturz schwindelig, oder waren Sie kurz bewusstlos? — Were you dizzy before the fall, or did you pass out for a moment?
- **Patient:** „Ramipril, fünf Milligramm, jeden Morgen. Die Tablette gegen das Cholesterin nehme ich seit einem halben Jahr nicht mehr.“ — "Ramipril, five milligrams, every morning. I stopped taking the cholesterol tablet half a year ago."
- **Note (right):** Ramipril 5 mg 1-0-0; Statin vor 6 Monaten selbst abgesetzt — ramipril 5 mg in the morning; stopped his statin himself 6 months ago
- Note (wrong): keine Dauermedikation — no regular medication
- Note (wrong): ASS 100 mg 1-0-0 — aspirin 100 mg in the morning

#### 9. Allergien (Allergies)

- **Right question:** Haben Sie schon einmal auf ein Kontrastmittel reagiert? — Have you ever reacted to a contrast agent?
- Wrong question: Wo genau tut es weh? — Where exactly does it hurt?
- Wrong question: Mit wem wohnen Sie zusammen? — Who do you live with?
- **Patient:** „Nein, das hatte ich noch nie. Andere Allergien habe ich auch nicht.“ — "No, I have never had that. I don't have any other allergies either."
- **Note (right):** keine Allergien, keine Kontrastmittelreaktion bekannt — no allergies, no known reaction to contrast agent
- Note (wrong): Jodallergie — iodine allergy
- Note (wrong): Penicillinallergie — penicillin allergy

#### 10. Vegetative Anamnese (General symptoms (appetite, weight, sleep, bowels, bladder))

- **Right question:** Haben Sie in letzter Zeit ungewollt ab- oder zugenommen? — Have you lost or gained weight recently without meaning to?
- Wrong question: Wurden Sie schon einmal operiert? — Have you ever had an operation?
- Wrong question: Nehmen Sie auch Medikamente ohne Rezept ein, zum Beispiel Schmerzmittel? — Do you also take medication without a prescription, for example painkillers?
- **Patient:** „Nein, mein Gewicht ist gleich. Aber ich bin zu dick: 98 Kilo bei 1,78 Meter.“ — "No, my weight is the same. But I am too heavy: 98 kilos at 1.78 metres."
- **Note (right):** Gewicht konstant, Adipositas (BMI ca. 31) — weight stable, obesity (BMI about 31)
- Note (wrong): ungewollter Gewichtsverlust von 5 kg — unintended weight loss of 5 kg
- Note (wrong): Untergewicht — underweight

#### 11. Familienanamnese (Family history)

- **Right question:** Hatte jemand in Ihrer Familie einen Herzinfarkt oder einen Schlaganfall? — Has anyone in your family had a heart attack or a stroke?
- Wrong question: Seit wann haben Sie die Beschwerden? — Since when have you had the symptoms?
- Wrong question: Wie äußert sich die Allergie? — How does the allergy show itself?
- **Patient:** „Ja, mein Vater hatte mit 52 Jahren einen Herzinfarkt. Er ist daran gestorben.“ — "Yes, my father had a heart attack at 52. He died of it."
- **Note (right):** Vater: Herzinfarkt mit 52 Jahren, verstorben — father: heart attack at 52, died
- Note (wrong): Mutter: Schlaganfall mit 85 Jahren — mother: stroke at 85
- Note (wrong): keine Herz-Kreislauf-Erkrankungen in der Familie — no heart or circulation disease in the family

#### 12. Sozialanamnese (Social history)

- **Right question:** Rauchen Sie? — Do you smoke?
- Wrong question: Sind Sie zurzeit wegen einer anderen Erkrankung in Behandlung? — Are you currently being treated for another illness?
- Wrong question: Haben Sie Nachtschweiß? — Do you have night sweats?
- **Patient:** „Ja, seit 35 Jahren. Ungefähr eine Schachtel am Tag.“ — "Yes, for 35 years. About one pack a day."
- **Note (right):** Raucher, ca. 35 Packungsjahre — smoker, about 35 pack-years
- Note (wrong): Nichtraucher — non-smoker
- Note (wrong): Ex-Raucher seit 10 Jahren — ex-smoker for 10 years

#### 13. Sozialanamnese (Social history)

- **Right question:** Trinken Sie Alkohol? — Do you drink alcohol?
- Wrong question: Haben Sie Allergien? — Do you have any allergies?
- Wrong question: Haben Sie gegen die Beschwerden schon etwas eingenommen? — Have you already taken anything for the symptoms?
- **Patient:** „Selten. Vielleicht ein Bier am Wochenende.“ — "Rarely. Maybe one beer at the weekend."
- **Note (right):** gelegentlicher Alkoholkonsum — occasional alcohol
- Note (wrong): täglicher Alkoholkonsum — drinks alcohol every day
- Note (wrong): kein Alkohol — no alcohol

### Arztbrief (letter), by section

#### Diagnosen (Diagnoses)

- Koronare Herzkrankheit mit stabiler Angina pectoris — Coronary heart disease with stable angina pectoris
- Kardiovaskuläre Risikofaktoren: Nikotinabusus, arterielle Hypertonie, Hypercholesterinämie, Adipositas, positive Familienanamnese — Cardiovascular risk factors: smoking, high blood pressure, high cholesterol, obesity, positive family history

#### Anamnese (History)

- Herr Keller stellte sich mit seit zwei Wochen bestehenden, belastungsabhängigen retrosternalen Druckschmerzen vor. — Mr Keller presented with pressing pain behind the breastbone on exertion for two weeks.
- Die Schmerzen strahlten in den linken Arm und den Hals aus und bildeten sich in Ruhe innerhalb weniger Minuten zurück. — The pain spread to the left arm and the neck and went away within a few minutes at rest.
- Begleitend bestanden Dyspnoe und Schwitzen; Ruheschmerzen wurden verneint. — There was also shortness of breath and sweating; he denied pain at rest.

#### Befund (Findings)

- Das Ruhe-EKG zeigte einen Sinusrhythmus ohne Ischämiezeichen. — The resting ECG showed sinus rhythm without signs of ischaemia.
- Das hochsensitive Troponin T war im Verlauf zweimal negativ. — The high-sensitivity troponin T was negative twice.
- In der Koronarangiografie zeigte sich eine hochgradige Stenose des Ramus interventricularis anterior (RIVA). — Coronary angiography showed a severe narrowing of the left anterior descending artery (LAD).

#### Therapie und Verlauf (Treatment and course)

- In gleicher Sitzung erfolgte eine PCI mit Implantation eines medikamentenfreisetzenden Stents (DES). — In the same session a PCI was performed and a drug-eluting stent was placed.
- Wir begannen eine duale Thrombozytenaggregationshemmung mit ASS und Clopidogrel sowie eine hochdosierte Statintherapie; der Verlauf war komplikationslos. — We started dual antiplatelet therapy with aspirin and clopidogrel and a high-dose statin; the course was without complications.

#### Empfehlung (Recommendation)

- Wir empfehlen die Einnahme von Clopidogrel für sechs Monate und von ASS dauerhaft. — We recommend taking clopidogrel for six months and aspirin for life.
- Ein Rauchstopp wird dringend empfohlen. — We strongly recommend that he stops smoking.
- Vor der Rückkehr an den Arbeitsplatz als Busfahrer sollte die Fahreignung kardiologisch beurteilt werden. — Before he goes back to work as a bus driver, a cardiologist should assess his fitness to drive.

### Dokumentation (model text per Anamnese section, FSP part 2)

**Aktuelle Beschwerden** (Presenting complaint)

> Der Patient klagt über seit zwei Wochen bestehende, belastungsabhängige, drückende retrosternale Schmerzen mit Ausstrahlung in den linken Arm und den Hals. Die Schmerzen bessern sich in Ruhe innerhalb weniger Minuten, kein Ruheschmerz. Schmerzstärke 5/10, seit Beginn gleichbleibend. Begleitend Dyspnoe und Schwitzen, keine Übelkeit.

*The patient reports pressing pain behind the breastbone on exertion for two weeks, spreading to the left arm and the neck. The pain gets better within a few minutes at rest, no pain at rest. Pain 5/10, unchanged since it began. With shortness of breath and sweating, no nausea.*

**Vorerkrankungen und Operationen** (Past medical and surgical history)

> Arterielle Hypertonie seit zehn Jahren, Hypercholesterinämie.

*High blood pressure for ten years, high cholesterol.*

**Medikamente** (Medication)

> Ramipril 5 mg 1-0-0. Statin vor sechs Monaten eigenständig abgesetzt.

*Ramipril 5 mg in the morning. Stopped his statin on his own six months ago.*

**Allergien** (Allergies)

> Keine Allergien bekannt, keine Kontrastmittelreaktion.

*No known allergies, no reaction to contrast agent.*

**Vegetative Anamnese** (General symptoms (appetite, weight, sleep, bowels, bladder))

> Gewicht konstant, Adipositas (98 kg bei 1,78 m, BMI ca. 31).

*Weight stable, obesity (98 kg at 1.78 m, BMI about 31).*

**Familienanamnese** (Family history)

> Vater: Herzinfarkt mit 52 Jahren, daran verstorben.

*Father: heart attack at 52, died of it.*

**Sozialanamnese** (Social history)

> Busfahrer. Nikotinabusus mit ca. 35 Packungsjahren. Gelegentlicher Alkoholkonsum.

*Bus driver. Smoker with about 35 pack-years. Occasional alcohol.*

### Vorstellung (Arzt-Arzt-Gespräch, FSP part 3)

**Skeleton (… = gap):**

> Ich möchte Ihnen Herrn … vorstellen, einen …-jährigen … . Er kam heute wegen … zu uns. Die Schmerzen bestehen seit … , treten bei … auf und strahlen in … aus. In Ruhe … . Begleitend … . An Vorerkrankungen sind … bekannt. Er nimmt … ; das Statin … . Allergien … . Weitere kardiovaskuläre Risikofaktoren sind … . Mein Verdacht ist … . Differenzialdiagnostisch … . Ich würde … veranlassen.

*I would like to present Mr …, a …-year-old … . He came to us today because of … . The pain has been there since … , comes on with … and spreads to … . At rest … . Also … . Known previous illnesses are … . He takes … ; the statin … . Allergies … . Further cardiovascular risk factors are … . My suspected diagnosis is … . As differential diagnoses … . I would arrange … .*

**Model:**

> Ich möchte Ihnen Herrn Thomas Keller vorstellen, einen 58-jährigen Busfahrer. Er kam heute wegen Brustschmerzen zu uns. Die Schmerzen bestehen seit zwei Wochen, treten bei Belastung auf, sind drückend, liegen hinter dem Brustbein und strahlen in den linken Arm und den Hals aus. In Ruhe bessern sie sich innerhalb weniger Minuten, Ruheschmerzen hat er nicht. Begleitend bestehen Luftnot und Schwitzen. An Vorerkrankungen sind eine arterielle Hypertonie und eine Hypercholesterinämie bekannt. Er nimmt Ramipril 5 mg; das Statin hat er vor sechs Monaten selbst abgesetzt. Allergien sind nicht bekannt. Weitere kardiovaskuläre Risikofaktoren sind ein Nikotinabusus mit etwa 35 Packungsjahren, eine Adipositas und eine positive Familienanamnese: Sein Vater hatte mit 52 Jahren einen Herzinfarkt. Mein Verdacht ist eine stabile Angina pectoris bei koronarer Herzkrankheit. Differenzialdiagnostisch muss vor allem ein akutes Koronarsyndrom ausgeschlossen werden; außerdem kommen eine Lungenembolie, eine Refluxkrankheit oder muskuloskelettale Schmerzen in Frage. Ich würde ein Ruhe-EKG, ein Labor mit hochsensitivem Troponin, Blutbild, Elektrolyten, Blutfetten und HbA1c sowie eine Echokardiografie veranlassen und je nach Ergebnis eine weitere Ischämiediagnostik oder eine Koronarangiografie planen.

*I would like to present Mr Thomas Keller, a 58-year-old bus driver. He came to us today because of chest pain. The pain has been there for two weeks, comes on with exertion, is pressing, lies behind the breastbone and spreads to the left arm and the neck. At rest it gets better within a few minutes; he has no pain at rest. He also has shortness of breath and sweating. Known previous illnesses are high blood pressure and high cholesterol. He takes ramipril 5 mg; he stopped his statin himself six months ago. No known allergies. Further cardiovascular risk factors are smoking with about 35 pack-years, obesity and a positive family history: his father had a heart attack at 52. My suspected diagnosis is stable angina pectoris due to coronary heart disease. Above all, an acute coronary syndrome must be ruled out; other differential diagnoses are a pulmonary embolism, reflux disease or musculoskeletal pain. I would arrange a resting ECG, blood tests with high-sensitivity troponin, full blood count, electrolytes, blood lipids and HbA1c, and an echocardiogram, and depending on the results plan further ischaemia testing or a coronary angiography.*

### What to check

1. **Diagnosis wording:** The plan asked for *suspected stable angina pectoris*. Chest pain on exertion for only two weeks is, in classic German teaching, a *new-onset angina* („Erstangina“), which some textbooks count as **unstable** angina pectoris (acute coronary syndrome). The case keeps „stabile Angina pectoris“ in the letter and says in the presentation that an acute coronary syndrome must be ruled out first. Is this acceptable, or should the diagnosis read e.g. „V. a. KHK, DD instabile Angina pectoris“ (or the history be made longer, e.g. three months)?
2. **Work-up and treatment:** Is the course typical for a German hospital: resting ECG without ischaemia, hs-Troponin T negative twice, direct coronary angiography because of high pre-test probability, LAD (RIVA) stenosis with PCI and a drug-eluting stent in the same session, DAPT with ASS + Clopidogrel for six months then ASS for life, high-dose statin? Would you add a beta blocker or anything else?
3. **Fitness to drive:** The letter asks for a cardiological assessment of his fitness to drive as a bus driver (professional licence) before he goes back to work. Is that the right wording, and is anything more specific usual?
4. **Interview:** Ausstrahlung, Belastung/Ruhe, Begleitsymptome (Atemnot, Schwitzen), Risikofaktoren (Blutdruck, Cholesterin, Rauchen, Gewicht, Familie). Is anything important missing (e.g. Diabetes asked explicitly, Ruhe-/Nachtschmerz, Synkope, Beinschwellung)? The patient drinks „ein Bier am Wochenende“ — answered plainly, as the content rules allow.
5. **Differential diagnoses in the presentation:** ACS, Lungenembolie, Refluxkrankheit, muskuloskelettale Schmerzen — the ones you would name?
6. **German a doctor would use:** Do the notes, the letter sentences, the documentation and the presentation sound like a German doctor (Arztbrief style, abbreviations such as „1-0-0“, „Z. n.“)?
7. **B1 patient language:** Are the patient's answers short, natural everyday German at B1?
8. **Wrong options:** Is each "wrong" question really wrong at that point, and each wrong note clearly not what the patient said?

## Fall „Sturz auf die Hand“ (fall on the outstretched hand; suspected distal radius fracture)

Klinik → Anamnese → *Gespräch*, Klinik → *Arztbrief* and Klinik → *Fachsprachenprüfung* → Sturz auf die Hand. Level B1. Data: `data/medical/faelle/handgelenk.json` (version 1). Invented patient, invented teaching content — not medical advice.

The interview has 13 steps.

### Patient

- Ingrid Wagner, 67 Jahre, Lehrerin im Ruhestand — Ingrid Wagner, 67 years old, retired teacher

### Interview (Arzt-Patienten-Gespräch)

#### 1. Aktuelle Beschwerden (Presenting complaint)

- **Right question:** Was führt Sie zu uns? — What brings you to us?
- Wrong question: Wie ist Ihr Appetit? — How is your appetite?
- Wrong question: Hatte jemand in Ihrer Familie einen Herzinfarkt oder einen Schlaganfall? — Has anyone in your family had a heart attack or a stroke?
- **Patient:** „Ich bin heute Morgen auf dem Eis ausgerutscht und auf die rechte Hand gefallen. Ich hatte den Arm ausgestreckt.“ — "I slipped on the ice this morning and fell onto my right hand. I had my arm stretched out."
- **Note (right):** heute Morgen Sturz auf Glatteis auf die ausgestreckte rechte Hand — fell on ice this morning onto her outstretched right hand
- Note (wrong): Sturz auf die linke Schulter — fall onto her left shoulder
- Note (wrong): Sturz vor drei Tagen — fall three days ago

#### 2. Aktuelle Beschwerden (Presenting complaint)

- **Right question:** War Ihnen vor dem Sturz schwindelig, oder waren Sie kurz bewusstlos? — Were you dizzy before the fall, or did you pass out for a moment?
- Wrong question: Nehmen Sie die Pille oder andere Hormone ein? — Do you take the contraceptive pill or other hormones?
- Wrong question: Treiben Sie Sport? — Do you do any sport?
- **Patient:** „Nein, mir war nicht schwindelig. Ich bin einfach ausgerutscht. Ich war die ganze Zeit wach.“ — "No, I wasn't dizzy. I just slipped. I was awake the whole time."
- **Note (right):** kein Schwindel, keine Bewusstlosigkeit; Ausrutschen auf Glätte — no dizziness, no loss of consciousness; slipped on ice
- Note (wrong): Schwindel vor dem Sturz — dizzy before the fall
- Note (wrong): kurze Bewusstlosigkeit — brief loss of consciousness

#### 3. Aktuelle Beschwerden (Presenting complaint)

- **Right question:** Wo genau tut es weh? — Where exactly does it hurt?
- Wrong question: Waren Sie schon einmal im Krankenhaus? — Have you ever been in hospital?
- Wrong question: Haben Sie schon einmal auf ein Kontrastmittel reagiert? — Have you ever reacted to a contrast agent?
- **Patient:** „Hier am rechten Handgelenk. Es ist ganz dick geworden, und ich kann die Hand kaum bewegen.“ — "Here at my right wrist. It has become very swollen and I can hardly move my hand."
- **Note (right):** rechtes Handgelenk geschwollen, Beweglichkeit stark eingeschränkt — right wrist swollen, movement very limited
- Note (wrong): linkes Handgelenk — left wrist
- Note (wrong): Schmerzen im rechten Ellenbogen — pain in the right elbow

#### 4. Aktuelle Beschwerden (Presenting complaint)

- **Right question:** Wie stark sind die Schmerzen auf einer Skala von eins bis zehn? — How bad is the pain on a scale from one to ten?
- Wrong question: Sind Ihre Eltern und Geschwister gesund? — Are your parents and siblings healthy?
- Wrong question: Wie oft am Tag nehmen Sie das Medikament ein? — How many times a day do you take the medication?
- **Patient:** „Acht. Wenn ich die Hand bewege, ist es noch schlimmer.“ — "Eight. When I move my hand, it is even worse."
- **Note (right):** Schmerzstärke 8/10, stärker bei Bewegung — pain 8/10, worse on movement
- Note (wrong): Schmerzstärke 3/10 — pain 3/10
- Note (wrong): besser bei Bewegung — better on movement

#### 5. Aktuelle Beschwerden (Presenting complaint)

- **Right question:** Haben Sie noch andere Beschwerden, zum Beispiel Übelkeit oder Erbrechen? — Do you have any other symptoms, for example nausea or vomiting?
- Wrong question: Nehmen Sie Drogen? — Do you take any drugs?
- Wrong question: Sind Sie gegen Medikamente allergisch? — Are you allergic to any medication?
- **Patient:** „Nein. Den Kopf habe ich nicht angeschlagen, und sonst tut mir nichts weh.“ — "No. I didn't hit my head, and nothing else hurts."
- **Note (right):** kein Kopfanprall, keine weiteren Verletzungen — did not hit her head, no other injuries
- Note (wrong): Kopfschmerzen nach Kopfanprall — headache after hitting her head
- Note (wrong): Übelkeit und Erbrechen — nausea and vomiting

#### 6. Vorerkrankungen und Operationen (Past medical and surgical history)

- **Right question:** Haben Sie chronische Erkrankungen, zum Beispiel Bluthochdruck oder Diabetes? — Do you have any chronic illnesses, for example high blood pressure or diabetes?
- Wrong question: Haben Sie Beschwerden beim Wasserlassen? — Do you have any problems when passing urine?
- Wrong question: Was machen Sie beruflich? — What do you do for a living?
- **Patient:** „Ich habe Vorhofflimmern, schon seit fünf Jahren. Sonst bin ich gesund.“ — "I have atrial fibrillation, for five years now. Otherwise I am healthy."
- **Note (right):** Vorhofflimmern seit 5 Jahren — atrial fibrillation for 5 years
- Note (wrong): Diabetes mellitus Typ 2 — type 2 diabetes
- Note (wrong): keine Vorerkrankungen — no previous illnesses

#### 7. Vorerkrankungen und Operationen (Past medical and surgical history)

- **Right question:** Ist bei Ihnen eine Osteoporose bekannt? — Have you been diagnosed with osteoporosis?
- Wrong question: Gibt es in Ihrer Familie Krebserkrankungen? — Is there any cancer in your family?
- Wrong question: Sind Sie gegen Pflaster oder Latex allergisch? — Are you allergic to plasters or latex?
- **Patient:** „Das weiß ich nicht. Meine Knochen wurden noch nie untersucht.“ — "I don't know. My bones have never been checked."
- **Note (right):** Osteoporose nicht bekannt, bisher keine Knochendichtemessung — no known osteoporosis, bone density never measured
- Note (wrong): bekannte Osteoporose unter Therapie — known osteoporosis, being treated
- Note (wrong): Z. n. Schenkelhalsfraktur — status after a hip fracture

#### 8. Medikamente (Medication)

- **Right question:** Nehmen Sie blutverdünnende Medikamente ein? — Do you take any blood thinners?
- Wrong question: Strahlen die Schmerzen aus? — Does the pain spread anywhere?
- Wrong question: Haben Sie Kinder? — Do you have children?
- **Patient:** „Ja, für das Herz. Ich nehme Apixaban, fünf Milligramm, morgens und abends. Die Tablette von heute Morgen habe ich schon genommen.“ — "Yes, for my heart. I take apixaban, five milligrams, morning and evening. I have already taken this morning's tablet."
- **Note (right):** Apixaban 5 mg 1-0-1, letzte Einnahme heute Morgen — apixaban 5 mg morning and evening, last dose this morning
- Note (wrong): keine Antikoagulation — no anticoagulation
- Note (wrong): Phenprocoumon (Marcumar) nach INR — phenprocoumon (Marcumar) adjusted to the INR

#### 9. Medikamente (Medication)

- **Right question:** Haben Sie gegen die Beschwerden schon etwas eingenommen? — Have you already taken anything for the symptoms?
- Wrong question: Hatten Sie schon einmal einen Unfall? — Have you ever had an accident?
- Wrong question: Haben Sie Fieber? — Do you have a fever?
- **Patient:** „Ja, zu Hause eine Paracetamol. Das hat aber kaum geholfen.“ — "Yes, one paracetamol at home. But it hardly helped."
- **Note (right):** einmalig Paracetamol, kaum Besserung — paracetamol once, hardly any relief
- Note (wrong): Ibuprofen 600 mg, deutliche Besserung — ibuprofen 600 mg, clearly better
- Note (wrong): noch nichts eingenommen — has not taken anything yet

#### 10. Allergien (Allergies)

- **Right question:** Haben Sie Allergien? — Do you have any allergies?
- Wrong question: Können Sie den Schmerz beschreiben? — Can you describe the pain?
- Wrong question: Gibt es in Ihrer Familie Diabetes oder Bluthochdruck? — Is there any diabetes or high blood pressure in your family?
- **Patient:** „Ja, gegen Penicillin. Davon bekomme ich einen Ausschlag.“ — "Yes, to penicillin. It gives me a rash."
- **Note (right):** Penicillinallergie (Hautausschlag) — penicillin allergy (rash)
- Note (wrong): keine Allergien bekannt — no known allergies
- Note (wrong): Pflasterallergie — allergy to plasters

#### 11. Familienanamnese (Family history)

- **Right question:** Gibt es Erkrankungen in Ihrer Familie? — Are there any illnesses in your family?
- Wrong question: Haben Sie in letzter Zeit ungewollt ab- oder zugenommen? — Have you lost or gained weight recently without meaning to?
- Wrong question: Rauchen Sie? — Do you smoke?
- **Patient:** „Meine Mutter hatte Osteoporose. Sie hat sich mit 75 den Oberschenkelhals gebrochen.“ — "My mother had osteoporosis. She broke her hip at 75."
- **Note (right):** Mutter: Osteoporose, Schenkelhalsfraktur mit 75 Jahren — mother: osteoporosis, hip fracture at 75
- Note (wrong): Vater: Herzinfarkt — father: heart attack
- Note (wrong): Familienanamnese unauffällig — nothing of note in the family history

#### 12. Sozialanamnese (Social history)

- **Right question:** Mit wem wohnen Sie zusammen? — Who do you live with?
- Wrong question: Wurden Sie schon einmal operiert? — Have you ever had an operation?
- Wrong question: Nehmen Sie regelmäßig Medikamente ein? — Do you take any medication regularly?
- **Patient:** „Ich wohne allein, seit mein Mann gestorben ist. Meine Tochter wohnt aber in der Nähe.“ — "I have lived alone since my husband died. But my daughter lives nearby."
- **Note (right):** verwitwet, lebt allein; Tochter wohnt in der Nähe — widowed, lives alone; daughter lives nearby
- Note (wrong): lebt im Pflegeheim — lives in a care home
- Note (wrong): lebt mit dem Ehemann zusammen — lives with her husband

#### 13. Sozialanamnese (Social history)

- **Right question:** Trinken Sie Alkohol? — Do you drink alcohol?
- Wrong question: Seit wann haben Sie die Beschwerden? — Since when have you had the symptoms?
- Wrong question: Vertragen Sie bestimmte Lebensmittel nicht? — Are there any foods you cannot tolerate?
- **Patient:** „Nein, ich trinke keinen Alkohol. Ich rauche auch nicht.“ — "No, I don't drink alcohol. I don't smoke either."
- **Note (right):** kein Alkohol, Nichtraucherin — no alcohol, non-smoker
- Note (wrong): Raucherin, 20 Zigaretten am Tag — smoker, 20 cigarettes a day
- Note (wrong): täglicher Alkoholkonsum — drinks alcohol every day

*Vegetative Anamnese (General symptoms (appetite, weight, sleep, bowels, bladder)): not asked in this case — the form shows „nicht erhoben“.*

### Arztbrief (letter), by section

#### Diagnosen (Diagnoses)

- Distale Radiusfraktur rechts vom Extensionstyp (Colles-Fraktur) — Distal radius fracture on the right, extension type (Colles fracture)
- Vorhofflimmern unter oraler Antikoagulation mit Apixaban — Atrial fibrillation on oral anticoagulation with apixaban

#### Anamnese (History)

- Die Patientin stellte sich nach einem Sturz auf Glatteis mit Abfangen auf die ausgestreckte rechte Hand vor. — The patient presented after a fall on ice in which she caught herself on her outstretched right hand.
- Schwindel, eine Bewusstlosigkeit und ein Kopfanprall wurden verneint. — She denied dizziness, loss of consciousness and hitting her head.
- Eine Osteoporose war bisher nicht bekannt; die Mutter hatte eine Schenkelhalsfraktur. — Osteoporosis was not known so far; her mother had a hip fracture.

#### Befund (Findings)

- Klinisch zeigten sich eine Schwellung und eine Fourchette-Fehlstellung des rechten Handgelenks mit Druckschmerz über dem distalen Radius. — On examination the right wrist was swollen with a dinner-fork deformity and tender over the distal radius.
- Durchblutung, Motorik und Sensibilität der Finger waren intakt. — Blood flow, movement and feeling in the fingers were intact.
- Röntgenologisch zeigte sich eine dislozierte extraartikuläre distale Radiusfraktur. — The X-ray showed a displaced distal radius fracture outside the joint.

#### Therapie und Verlauf (Treatment and course)

- In Bruchspaltanästhesie erfolgte die geschlossene Reposition mit Anlage einer dorsalen Unterarmgipsschiene. — Under a haematoma block the fracture was set without surgery and a dorsal forearm plaster splint was put on.
- Die Röntgenkontrolle nach Reposition zeigte eine regelrechte Stellung. — The X-ray after setting the fracture showed correct alignment.

#### Empfehlung (Recommendation)

- Wir empfehlen Röntgenkontrollen nach einer und nach zwei Wochen sowie eine Ruhigstellung für insgesamt fünf bis sechs Wochen. — We recommend X-ray checks after one and after two weeks and keeping the wrist immobilised for five to six weeks in all.
- Bei zunehmender Schwellung, Taubheitsgefühl oder Verfärbung der Finger sollte sich die Patientin sofort wieder vorstellen. — If the swelling increases, or the fingers become numb or change colour, the patient should come back at once.
- Bei Verdacht auf eine osteoporotische Fraktur empfehlen wir eine Osteoporose-Diagnostik mit Knochendichtemessung (DXA). — As this may be an osteoporotic fracture, we recommend tests for osteoporosis with a bone density scan (DXA).

### Dokumentation (model text per Anamnese section, FSP part 2)

**Aktuelle Beschwerden** (Presenting complaint)

> Die Patientin ist heute Morgen auf Glatteis ausgerutscht und hat sich mit der ausgestreckten rechten Hand abgefangen. Kein Schwindel, keine Bewusstlosigkeit, kein Kopfanprall, keine weiteren Verletzungen. Seitdem starke Schmerzen im rechten Handgelenk, Schmerzstärke 8/10, stärker bei Bewegung; Schwellung und deutlich eingeschränkte Beweglichkeit.

*The patient slipped on ice this morning and caught herself with her outstretched right hand. No dizziness, no loss of consciousness, did not hit her head, no other injuries. Since then severe pain in the right wrist, pain 8/10, worse on movement; swelling and clearly limited movement.*

**Vorerkrankungen und Operationen** (Past medical and surgical history)

> Vorhofflimmern seit fünf Jahren. Osteoporose nicht bekannt, bisher keine Knochendichtemessung.

*Atrial fibrillation for five years. No known osteoporosis, bone density never measured.*

**Medikamente** (Medication)

> Apixaban 5 mg 1-0-1, letzte Einnahme heute Morgen. Einmalig Paracetamol ohne wesentliche Besserung.

*Apixaban 5 mg morning and evening, last dose this morning. Paracetamol once without much relief.*

**Allergien** (Allergies)

> Penicillinallergie (Exanthem).

*Penicillin allergy (rash).*

**Familienanamnese** (Family history)

> Mutter: Osteoporose mit Schenkelhalsfraktur im Alter von 75 Jahren.

*Mother: osteoporosis with a hip fracture at the age of 75.*

**Sozialanamnese** (Social history)

> Lehrerin im Ruhestand, verwitwet, lebt allein; die Tochter wohnt in der Nähe. Kein Alkohol, Nichtraucherin.

*Retired teacher, widowed, lives alone; her daughter lives nearby. No alcohol, non-smoker.*

### Vorstellung (Arzt-Arzt-Gespräch, FSP part 3)

**Skeleton (… = gap):**

> Ich möchte Ihnen Frau … vorstellen, eine …-jährige … . Sie ist heute … und hat sich mit … abgefangen. Schwindel, Bewusstlosigkeit und Kopfanprall … . Jetzt hat sie … . An Vorerkrankungen ist … bekannt, dafür nimmt sie … ; die letzte Einnahme war … . Sie hat eine Allergie gegen … . Eine Osteoporose … , die Mutter hatte … . Sie lebt … . Mein Verdacht ist … . Differenzialdiagnostisch kommen … in Frage. Ich würde … .

*I would like to present Ms …, a …-year-old … . Today she … and caught herself with … . Dizziness, loss of consciousness and hitting her head … . Now she has … . A known previous illness is … , for which she takes … ; the last dose was … . She is allergic to … . Osteoporosis … , her mother had … . She lives … . My suspected diagnosis is … . Differential diagnoses are … . I would … .*

**Model:**

> Ich möchte Ihnen Frau Ingrid Wagner vorstellen, eine 67-jährige Lehrerin im Ruhestand. Sie ist heute Morgen auf Glatteis ausgerutscht und hat sich mit der ausgestreckten rechten Hand abgefangen. Schwindel, Bewusstlosigkeit und Kopfanprall verneint sie. Jetzt hat sie starke Schmerzen im rechten Handgelenk, 8 von 10; das Handgelenk ist geschwollen und kaum beweglich. An Vorerkrankungen ist ein Vorhofflimmern bekannt, dafür nimmt sie Apixaban 5 mg zweimal täglich; die letzte Einnahme war heute Morgen. Sie hat eine Allergie gegen Penicillin. Eine Osteoporose ist nicht bekannt, die Mutter hatte aber eine Schenkelhalsfraktur. Sie lebt allein, ihre Tochter wohnt in der Nähe. Mein Verdacht ist eine distale Radiusfraktur rechts. Differenzialdiagnostisch kommen eine Skaphoidfraktur oder eine Bandverletzung des Handgelenks in Frage. Ich würde Durchblutung, Motorik und Sensibilität prüfen, das Handgelenk in zwei Ebenen röntgen, eine Schmerztherapie beginnen und den Arm ruhigstellen und hochlagern. Wegen der Antikoagulation muss vor einer möglichen Operation die letzte Apixaban-Einnahme beachtet werden. Außerdem sollte eine Osteoporose-Diagnostik folgen.

*I would like to present Ms Ingrid Wagner, a 67-year-old retired teacher. This morning she slipped on ice and caught herself with her outstretched right hand. She denies dizziness, loss of consciousness and hitting her head. Now she has severe pain in the right wrist, 8 out of 10; the wrist is swollen and she can hardly move it. A known previous illness is atrial fibrillation, for which she takes apixaban 5 mg twice a day; the last dose was this morning. She is allergic to penicillin. Osteoporosis is not known, but her mother had a hip fracture. She lives alone; her daughter lives nearby. My suspected diagnosis is a distal radius fracture on the right. Differential diagnoses are a scaphoid fracture or a ligament injury of the wrist. I would check blood flow, movement and feeling, X-ray the wrist in two planes, start pain relief, and immobilise and raise the arm. Because of the anticoagulation, the last apixaban dose must be taken into account before any operation. Tests for osteoporosis should also follow.*

### What to check

1. **Diagnosis and treatment:** Is a 67-year-old with a displaced extra-articular distal radius fracture (Colles type) typically treated closed (haematoma block, reduction, dorsal forearm splint) in Germany, or would you write operative treatment (palmar locking plate)? Are X-ray checks after one and two weeks and immobilisation for five to six weeks in all right?
2. **Anticoagulation:** She takes Apixaban 5 mg twice a day for atrial fibrillation (dose not reduced: age 67). Is the haematoma block under Apixaban acceptable as written? Is the remark in the presentation (last dose matters before an operation) enough?
3. **Osteoporosis:** A wrist fracture after a fall from standing height at 67, mother with a hip fracture: the letter recommends osteoporosis work-up with DXA. Is that how a German letter would say it?
4. **Interview:** Why she fell (Schwindel, Bewusstlosigkeit), head injury, blood thinners, osteoporosis, living situation. Is anything important missing (right- or left-handed, numbness or tingling in the fingers)? The Vegetative Anamnese is not asked in this case (the form shows „nicht erhoben“) — acceptable for an emergency trauma history?
5. **Differential diagnoses in the presentation:** Skaphoidfraktur, Bandverletzung — the ones you would name?
6. **German a doctor would use:** Do the notes, the letter sentences, the documentation and the presentation sound like a German doctor (Arztbrief style, abbreviations such as „1-0-0“, „Z. n.“)?
7. **B1 patient language:** Are the patient's answers short, natural everyday German at B1?
8. **Wrong options:** Is each "wrong" question really wrong at that point, and each wrong note clearly not what the patient said?

### Further points to check (from the implementation review)

- **Brustschmerzen, stable angina:** the case lists „stabile Angina pectoris“ for pain that began two weeks ago. Pain of recent onset is arguably new-onset angina, i.e. an unstable pattern (instabile Angina / ACS). Which wording would you keep?
- **Brustschmerzen, Lungenembolie:** it is in the differential diagnoses, but the interview does not ask about it (no question on leg swelling, long travel or immobilisation, previous thrombosis). Add a question or drop it from the differential?
- **Handgelenk, numbness and hand dominance:** the interview has no question on numbness or tingling in the fingers (median nerve) and none on right- or left-handedness. Add them?
- **Handgelenk, „Fourchette-Fehlstellung“:** is that the wording a German doctor would use for the typical dorsal displacement of a Colles fracture (Bajonett- or Fourchette-Stellung), and does the case use it correctly?
