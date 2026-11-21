# Medical track: sources

Sources for `data/medical/approbation.json` (the path to the Approbation, Baden-Württemberg).
All pages read on **2026-11-21**. Only official sources: Regierungspräsidium Stuttgart (RPS),
Landesärztekammer Baden-Württemberg (LÄK BW), Bundesärztekammer, gesetze-im-internet.de.
Quotes are short and in German, as on the page.

Short names used below:

| Short | URL |
|---|---|
| RPS-Ausland | https://rp.baden-wuerttemberg.de/themen/bildung/ausbildung/seiten/medizin-ausland/ |
| RPS-Anl1 | https://rp.baden-wuerttemberg.de/fileadmin/RP-Internet/Themenportal/Schule_und_Bildung/Berufliche_Ausbildung/Aerztin_Arzt_Ausbildung_Approbation/_DocumentLibraries/Documents/LPA_Arzt_Appr_Antrag_nonEU_Anl1.pdf ("Anlage 1 – Informationen zum Antrag und den Unterlagen (Ärzte)", Stand: 29.10.2026) |
| RPS-Anl6 | https://rp.baden-wuerttemberg.de/fileadmin/RP-Internet/Themenportal/Schule_und_Bildung/Berufliche_Ausbildung/Aerztin_Arzt_Ausbildung_Approbation/_DocumentLibraries/Documents/LPA_Arzt_Appr_Antrag_nonEU_Anl6.pdf ("Anlage 6 – Kenntnisprüfung oder dokumentenbasierte Gleichwertigkeitsprüfung? (Ärzte)", Stand: 29.10.2026) |
| RPS-FSP | https://rp.baden-wuerttemberg.de/themen/bildung/ausbildung/seiten/fachsprachenpruefung-arzt/ |
| LÄK-FSP | https://www.aerztekammer-bw.de/fachsprachenpruefung (no Stand shown) |
| LÄK-Ausland | https://www.aerztekammer-bw.de/aerztinnen-aerzte-ausland-5c45f98764a43ed8 |
| LÄK-Mitglied | https://www.aerztekammer-bw.de/mitglied-werden |
| BÄK-WB | https://www.bundesaerztekammer.de/themen/aerzte/aus-fort-und-weiterbildung/aerztliche-weiterbildung |
| BÄO § 3 | https://www.gesetze-im-internet.de/b_o/__3.html |
| BÄO § 9d | https://www.gesetze-im-internet.de/b_o/__9d.html |
| BÄO § 10 | https://www.gesetze-im-internet.de/b_o/__10.html |

## The biggest correction to the spec

Since **1 November 2026** the Kenntnisprüfung is the legal default for third-country degrees;
the document-based equivalence check (Gutachten) is now an opt-in. The spec's order
("Gleichwertigkeitsprüfung → … → Kenntnisprüfung if not equivalent") is out of date.

- RPS-Anl6: „Die Kenntnisprüfung ist ab dem 1. November 2026 der gesetzliche Regelfall (§ 9d Abs. 2 Bundesärzteordnung – BÄO).“
- RPS-Anl6: „Sie müssen diesen Weg nicht ausdrücklich wählen.“
- BÄO § 9d Abs. 2 (as read on gesetze-im-internet.de): the proof is „durch das Ablegen einer Berufszulassungsprüfung erbracht“ … „sofern der Antragsteller sich nicht für das Verfahren nach Absatz 3 entscheidet“; the choice is possible „bis vier Wochen nach Antragstellung“ and is binding.

## Per station

### deutsch-b2 — Deutsch B2
Source: RPS-Anl1 (C.10.1, A.1).
- „Bitte stellen Sie Ihren Antrag erst, wenn Ihnen alle erforderlichen Unterlagen vorliegen, insbesondere auch der Nachweis über deutsche Sprachkenntnisse auf dem Niveau B2.“
- „Sie müssen deutsche Sprachkenntnisse auf mindestens Niveau B2 … nachweisen.“
- „… Sprachzertifikat eines anerkannten Prüfungsanbieters, der Vollmitglied der ALTE … ist, z. B. Goethe-Institut, telc oder ÖSD.“
- Exemptions (C.10.3): no B2 and no FSP if German is the mother tongue, the medical degree was in German, ten years of German-language school with a leaving certificate, or a three-year vocational training in German. Not relevant for her (assumed).
- Legal basis: BÄO § 3 Abs. 1 Nr. 5: „über die für die Ausübung der Berufstätigkeit erforderlichen Kenntnisse der deutschen Sprache verfügt“.

### beratung — Anerkennungsberatung (optional)
Source: RPS-Anl1 (A.1, C.1), RPS-Ausland (links to IQ Netzwerk BW and the Zentrale Servicestelle Berufsanerkennung).
- „Bei Fragen können Sie sich kostenlos an eine Anerkennungsberatungsstelle wenden.“
- If living abroad, one of: „Beratungsnachweis nach § 1a Anerkennungsberatungsgesetz Baden-Württemberg“, „Nachweis familiärer Bindungen in Baden-Württemberg“, „Stellenzusage eines Arbeitgebers in Baden-Württemberg (Anlage 3)“.
- Optional because: counselling is offered, not required; the Beratungsnachweis is one of three alternatives and only when living abroad. If she already lives in Stuttgart, a Meldebescheinigung is the proof instead.

### antrag — Antrag auf Approbation
Source: RPS-Anl1, RPS-Ausland.
- Address (RPS-Ausland): Regierungspräsidium Stuttgart, Referat 98, Landesanerkennungsstelle für Gesundheitsberufe (LAfG BW), Ruppmannstraße 21, 70565 Stuttgart; by post.
- „Das Regierungspräsidium Stuttgart ist grundsätzlich nur zuständig, wenn Sie Ihren gewöhnlichen Aufenthalt (in der Regel Ihre Hauptwohnung) in Baden-Württemberg haben.“
- „Bitte reichen Sie alle erforderlichen Unterlagen als einfache Kopien ein.“ / „Bitte schicken Sie uns keine Originale.“
- „Deutsch- und englischsprachige Unterlagen benötigen grundsätzlich keine deutsche Übersetzung.“
- Missing documents: „Frist von drei Monaten“; otherwise possible „kostenpflichtigen Ablehnung Ihres Antrags (Gebühr: 100 €)“.
- „Im letzten Jahr betrug die durchschnittliche Dauer der abgeschlossenen Anerkennungsverfahren in Baden-Württemberg rund drei Jahre.“
- Document names (C.0–C.15) copied into `documents` as the RPS names them. CoGS, foreign Führungszeugnis and ärztliche Bescheinigung „können … später nachreichen“ and must be „nicht älter als drei Monate“ on arrival.

### gutachten — Gleichwertigkeitsprüfung (Gutachten) (optional)
Source: RPS-Anl6, RPS-Anl1 (C.16, C.17), BÄO § 9d Abs. 3.
- „Wenn Sie stattdessen eine dokumentenbasierte Gleichwertigkeitsprüfung wünschen, müssen Sie dies ausdrücklich bei Antragstellung oder innerhalb von vier Wochen nach Eingang Ihres Antrags … erklären. Diese Entscheidung ist … bindend.“
- Cost: „Gutachten in der Regel bis zu 2.500 €“; „Vorschuss von bis zu 2.000 €“.
- Wait: „Bis zu 15 Monate für das Gutachten.“
- „Bleiben wesentliche Unterschiede bestehen …, ist zusätzlich eine Kenntnisprüfung erforderlich.“
- Gutachten „der Gutachtenstelle für Gesundheitsberufe (GfG) oder eines anderen Sachverständigen“.

### fachsprachpruefung — Fachsprachenprüfung
Source: LÄK-FSP, RPS-FSP, RPS-Anl1. Format: see the section "Fachsprachprüfung format" below.
- RPS-FSP: „Die Fachsprachenprüfung ist über die Landesärztekammer Baden-Württemberg abzulegen, welche die Prüfung im Auftrag des Regierungspräsidiums Stuttgart (RPS), Abteilung 9, durchführt.“
- RPS-FSP: „Für die Fachsprachenprüfung ist keine persönliche Anmeldung notwendig.“
- LÄK-FSP: „Erst nach Erhalt der Prüfungsgebühr in Höhe von 420 Euro“ (then the invitation).
- LÄK-FSP: „Die Anzahl der Wiederholungsprüfungen ist nicht begrenzt.“ (each 420 €)
- LÄK-FSP: „Die Prüfungen finden derzeit bei den Bezirksärztekammern statt.“
- RPS-Anl1: wait „Fachsprachenprüfung: ca. 4 bis 6 Monate“.
- Validity (RPS-Anl1 / RPS-FSP): „grundsätzlich drei Jahre ab dem Prüfungsdatum anerkannt“; „Eine ärztliche Tätigkeit im Rahmen einer Berufserlaubnis verlängert die Gültigkeit“.
- Accepted alternatives (RPS-Anl1 C.10.2): an FSP from another Land; „FaMed – Fachsprachenprüfung Medizin (abgelegt nach dem 13. Mai 2024)“, „telc Deutsch B2/C1 Medizin Fachsprachprüfung“, „ÖAK Sprachprüfung Deutsch“ — only if submitted **with the application**: „Später eingereichte Nachweise werden grundsätzlich nicht mehr berücksichtigt.“

### berufserlaubnis — Berufserlaubnis (optional)
Source: RPS-Anl1 (C.18, D), RPS-Ausland, BÄO § 10.
- „Die Berufserlaubnis ist freiwillig und für den Erwerb der Approbation nicht erforderlich.“
- „… grundsätzlich für höchstens zwei Jahre und nur unter Aufsicht. Eine Facharztweiterbildung ist damit nicht möglich.“
- Needs „eine konkrete Stellenzusage eines Arbeitgebers in Baden-Württemberg (Anlage 3)“ and a running Approbation application.
- „Sie können diese jederzeit während des laufenden Approbationsverfahrens nachträglich beantragen, beispielsweise nach bestandener Fachsprachenprüfung.“ → placed after the FSP on the route.
- Fees: „250 € (bis zu einem Jahr) beziehungsweise 350 € (über ein Jahr)“.
- BÄO § 10 Abs. 2: „nur widerruflich und nur bis zu einer Gesamtdauer der ärztlichen Tätigkeit von höchstens zwei Jahren“.

### kenntnispruefung — Kenntnisprüfung
Source: RPS-Anl6, LÄK-FSP, BÄO § 9d.
- Legal default since 1.11.2026 (see above).
- RPS-Anl6: „Die Kenntnisprüfung wird von der Landesärztekammer Baden-Württemberg organisiert. Das Regierungspräsidium Stuttgart meldet Sie an, sobald … die bestandene Fachsprachenprüfung“ vorliegt.
- RPS-Anl6: „… klinisch-praktische Prüfung mit Patientenvorstellung und ein anschließendes mündliches Prüfungsgespräch. Die mündlich-praktische Prüfung dauert 60 bis 90 Minuten; zusätzlich ist Zeit für die Untersuchung und einen schriftlichen Patientenbericht vorgesehen.“
- Subjects: Innere Medizin, Chirurgie, Notfallmedizin, Klinische Pharmakologie/Pharmakotherapie, Bildgebende Verfahren, Strahlenschutz, Rechtlicher Rahmen der ärztlichen Berufsausübung, Ärztliche Gesprächsführung.
- „Derzeit 1.100 € pro Prüfungsversuch“; „Ca. 8–10 Monate“ wait; „Die Kenntnisprüfung kann zweimal wiederholt werden.“
- LÄK-FSP: „Seit Februar 2025 ist die Landesärztekammer Baden-Württemberg für die Organisation und Durchführung von Kenntnisprüfungen“ zuständig; „Dauer: mindestens 60, höchstens 90 Minuten“.

### approbation — Approbation
Source: RPS-Anl1 (A.2, C.14, D, E), BÄO § 3.
- „Wenn Sie die Kenntnisprüfung bestanden haben oder durch ein Gutachten festgestellt wurde, dass Ihre Ausbildung keine wesentlichen Unterschiede … aufweist, benötigen wir noch ein aktuelles deutsches Führungszeugnis.“
- „Beantragen Sie das deutsche Führungszeugnis erst, wenn wir Sie dazu auffordern.“ Belegart „OB“, sent directly to the RPS.
- „Approbation = Unbefristete Erlaubnis zum Arbeiten als Arzt in ganz Deutschland.“
- „Erteilung der Approbation: 450 €“.
- BÄO § 3 Abs. 1: Würdigkeit/Zuverlässigkeit (Nr. 2), „nicht in gesundheitlicher Hinsicht zur Ausübung des Berufs ungeeignet“ (Nr. 3), Ausbildung (Nr. 4), Sprache (Nr. 5).

### kammer — Meldung bei der Ärztekammer
Source: LÄK-Mitglied, LÄK-Ausland.
- „… Kammermitglied verpflichtet, sich innerhalb eines Monats nach Beginn seiner beruflichen Tätigkeit in Baden-Württemberg“ zu melden.
- „Die zuständige Bezirksärztekammer richtet sich immer nach dem Arbeitsort.“
- LÄK-Ausland: membership „erst mit Berufserlaubnis oder Approbation“ possible. So this station also applies during a Berufserlaubnis; on the route it sits after the Approbation because that is when it is certain.
- LÄK-Ausland also lists (not stations): BWVA (Versorgungswerk) membership on starting work, Berufshaftpflicht, Arztausweis.

### weiterbildung — Weiterbildung zur Fachärztin
Source: BÄK-WB; RPS-Anl1 (D.1, „Eine Facharztweiterbildung ist damit nicht möglich“ about the Berufserlaubnis).
- BÄK-WB: Weiterbildung „an zugelassenen Weiterbildungsstätten“ under „befugter Ärzte“; times and contents are „Mindestanforderungen“; ends with „einer Prüfung“; leads to the „Qualifikation als Facharzt“. Landesärztekammern are „für alle Angelegenheiten ärztlicher Weiterbildung zuständig“.
- The LÄK BW Weiterbildung page (https://www.aerztekammer-bw.de/weiterbildung-b8efcbf0ed5a094e) could not be read (only navigation came back). Durations per specialty are not given here on purpose.

## Fachsprachprüfung format

Checked against the Landesärztekammer's own page (LÄK-FSP), 2026-11-21. **Confirmed: three
parts, about twenty minutes each, sixty minutes in all, one candidate at a time.**

- „Die 60-minütige Fachsprachenprüfung findet in Form einer Einzelprüfung statt und ist praxisnah gestaltet.“
- „Die Fachsprachenprüfung besteht aus drei Teilen, die jeweils ca. 20 Minuten dauern.“

| # | Official title (LÄK BW) | Duration | Content (LÄK-FSP, paraphrased) |
|---|---|---|---|
| 1 | **Arzt-Patienten-Gespräch** | ca. 20 Minuten | Simulated history taking; a physician of the commission plays the patient. The candidate explains suspected diagnoses and planned measures and answers the patient's questions. Listening is central; notes are allowed. |
| 2 | **Dokumentation** | ca. 20 Minuten | The candidate sums up the findings „in einem Arztbericht schriftlich zusammen“, using an „Anamnesebogen“; „das zur Verfügung gestellte medizinische Fachwörterbuch“ may be used; supervised in a separate room. Handwritten or typed: not stated. |
| 3 | **Arzt-Arzt-Gespräch** | ca. 20 Minuten | The candidate presents the patient to a physician of the commission; „Anschließend antwortet der Prüfungskandidat auf Fragen des Prüfers.“ At the end a short list of medical terms whose German (everyday) equivalents must be given. |

Level: „basierend auf dem Sprachniveau C1 nach dem Gemeinsamen Europäischen Referenzrahmen“,
„auf der nachgewiesenen Grundlage eines GER-B2“ (Gesundheitsministerkonferenz 2014). Medical
knowledge itself is not assessed (that is the Kenntnisprüfung). Result is told „unmittelbar nach
der Prüfung“.

Differences to the spec: the spec's parts (patient interview, written documentation,
presentation to a colleague, twenty minutes each) match. Use the official titles above in 5b.
Part 3 also includes **naming German equivalents of medical terms** — this supports the 5a
"Medical ↔ everyday terms" boards. The spec says the FSP is "level C1"; officially it is
specialist language *oriented at* C1 on a B2 foundation.

Part 1 note-taking: „Der Prüfungskandidat darf sich währenddessen schriftliche Aufzeichnungen machen.“
Not stated by the LÄK page: whether part 2 is handwritten or typed, and what the Anamnesebogen looks like.

## Unclear or differing between sources

1. **Kenntnisprüfung wait time.** RPS-Anl1/Anl6: „ca. 8 bis 10 Monate“. LÄK-FSP: dates usually within four to five months (of registration by the RPS, presumably). Different starting points? The JSON uses the RPS figure.
2. **FSP registration.** RPS-FSP: „keine persönliche Anmeldung notwendig“. LÄK-FSP: confirmation and fee notice first, invitation only after paying 420 €. Not a contradiction, but the order (fee before date) is only on the LÄK page.
3. **Who runs the FSP.** RPS-FSP names the LÄK „im Auftrag des … RPS, Abteilung 9“; LÄK-FSP says the exams take place at the Bezirksärztekammern. Address for the application is Referat 98 (LAfG BW). The spec's "Landesprüfungsamt" is not the name used on the current pages for this procedure.
4. **Berufserlaubnis and language.** BÄO § 10 as read does not state a language requirement; the RPS suggests applying „beispielsweise nach bestandener Fachsprachenprüfung“. Whether a passed FSP is required for the Berufserlaubnis in BW is not stated explicitly in what I read.
5. **Hospitation.** No official BW page read mentions it; it is not a station. (Spec open question 1 mentions it.)
6. **Visa / residence permit** (e.g. for recognition or job seeking) is outside these sources and not on the route.
7. **Weiterbildung details** (LÄK BW page not readable; durations per specialty not recorded).
8. **Fees** are given „nach dem bisherigen Gebührenstand“ (RPS-Anl1) — may change.
9. **Legal text of § 9d BÄO** was read as a single-provision page; the entry-into-force date (1.11.2026) comes from RPS-Anl6, not from the law page itself.
