# Not yet checked by the owner

**Path to the Approbation in Baden-Württemberg: review sheet (plan 5a, Task 1)**

These are licensing facts, not medical content. They were read from official pages on
**2026-11-21**. Rules, fees and waiting times change: check every point against the
authority's current pages (Regierungspräsidium Stuttgart, Landesärztekammer
Baden-Württemberg) before relying on it. This is not legal advice. Details and German quotes:
[docs/medical-sources.md](../medical-sources.md). The app data: `data/medical/approbation.json`.

## Which path applies to her?

**Question (spec, open question 1):** Is she going for the Approbation directly, or the
Berufserlaubnis and work under supervision first? And which proof of medical knowledge?

**Assumed answer (owner ruling):** Indian medical degree (a third country) → Approbation in
Baden-Württemberg: B2 → application → Fachsprachenprüfung → **Kenntnisprüfung** →
Approbation → chamber registration → Weiterbildung. Since 1 November 2026 the Kenntnisprüfung
is the *legal default* for third-country degrees; the document check (Gutachten) is only done
if she asks for it within four weeks of applying. Berufserlaubnis and Gutachten are shown as
optional side stations.

## The stations (in the order she meets them)

Optional stations are marked *(optional)*.

1. **Deutsch B2** — general German B2 / *general German, level B2*
   A B2 certificate (e.g. Goethe, telc, ÖSD) must exist before she applies.
   *"Bitte stellen Sie Ihren Antrag erst, wenn … der Nachweis über deutsche Sprachkenntnisse auf dem Niveau B2 [vorliegt]."*
   Source: RPS Anlage 1 — https://rp.baden-wuerttemberg.de/fileadmin/RP-Internet/Themenportal/Schule_und_Bildung/Berufliche_Ausbildung/Aerztin_Arzt_Ausbildung_Approbation/_DocumentLibraries/Documents/LPA_Arzt_Appr_Antrag_nonEU_Anl1.pdf

2. **Anerkennungsberatung** *(optional)* — recognition counselling
   Free advice on the application. A counselling certificate is one way to prove she wants to work in BW *if she still lives abroad*; living in Stuttgart, the Meldebescheinigung does that.
   Source: RPS Anlage 1 (link above).

3. **Antrag auf Approbation** — application for the full licence
   Sent by post to the Regierungspräsidium Stuttgart, Referat 98 (Landesanerkennungsstelle für Gesundheitsberufe). Plain copies, no originals; English documents need no translation. The Kenntnisprüfung registration form (Anlage 4) goes in with it. Average length of the whole procedure last year: **about three years**.
   Source: RPS Anlage 1 (link above); https://rp.baden-wuerttemberg.de/themen/bildung/ausbildung/seiten/medizin-ausland/

4. **Gleichwertigkeitsprüfung (Gutachten)** *(optional)* — document-based equivalence check
   Only if she chooses it within four weeks of applying (binding). Up to 15 months, usually up to 2,500 €. If substantial differences remain, she still needs the Kenntnisprüfung.
   Source: RPS Anlage 6 — https://rp.baden-wuerttemberg.de/fileadmin/RP-Internet/Themenportal/Schule_und_Bildung/Berufliche_Ausbildung/Aerztin_Arzt_Ausbildung_Approbation/_DocumentLibraries/Documents/LPA_Arzt_Appr_Antrag_nonEU_Anl6.pdf

5. **Fachsprachenprüfung** — medical German exam
   Run by the Landesärztekammer BW (held at the Bezirksärztekammern). The RPS registers her; she pays 420 € before getting a date. Wait about 4–6 months. 60 minutes, three parts of about 20 minutes: **Arzt-Patienten-Gespräch, Dokumentation, Arzt-Arzt-Gespräch**. Retakes unlimited (420 € each). Valid three years.
   Source: https://www.aerztekammer-bw.de/fachsprachenpruefung ; https://rp.baden-wuerttemberg.de/themen/bildung/ausbildung/seiten/fachsprachenpruefung-arzt/

6. **Berufserlaubnis** *(optional)* — temporary permit to practise
   Work under supervision, at most two years, no Facharzt training with it. Voluntary, not needed for the Approbation. Needs a job offer in BW; can be applied for any time during the procedure, e.g. after the FSP. 250 € / 350 €.
   Source: RPS Anlage 1 (link above).

7. **Kenntnisprüfung** — knowledge exam
   Oral-practical exam in German with a patient presentation, 60–90 minutes plus time for examination and a written report; mainly internal medicine and surgery. After the passed FSP. 1,100 € per attempt, wait about 8–10 months, two retakes allowed.
   Source: RPS Anlage 6 (link above); https://www.aerztekammer-bw.de/fachsprachenpruefung

8. **Approbation** — full licence
   Unlimited licence for all of Germany. Before it is issued: German Führungszeugnis (type "OB", only when the RPS asks), medical certificate (Anlage 2), Certificate of Good Standing — each not older than three months. 450 €.
   Source: RPS Anlage 1 (link above).

9. **Meldung bei der Ärztekammer** — chamber registration
   Within one month of starting work in BW, with the Meldebogen, at the Bezirksärztekammer of the workplace (also applies under a Berufserlaubnis).
   Source: https://www.aerztekammer-bw.de/mitglied-werden

10. **Weiterbildung zur Fachärztin** — specialist training
    After the Approbation, at an approved training site under an authorised doctor; ends with an exam and the specialist title. Not possible with a Berufserlaubnis.
    Source: https://www.bundesaerztekammer.de/themen/aerzte/aus-fort-und-weiterbildung/aerztliche-weiterbildung

## Changes compared with the spec

- Kenntnisprüfung is now the default (since 1.11.2026), not "only if not equivalent". The Gutachten is the opt-in side road.
- The Berufserlaubnis is voluntary and comes during the procedure (e.g. after the FSP), not before the FSP as a fixed step.
- The office is "Referat 98, Landesanerkennungsstelle für Gesundheitsberufe" at the RPS, not "Landesprüfungsamt".
- FSP level: specialist language *oriented at* C1, on a B2 base — not a C1 certificate.
- Added: Anerkennungsberatung (optional), chamber registration.

## Open doubts

1. Does she already live in Baden-Württemberg (Hauptwohnsitz)? That decides which proof of responsibility she sends.
2. Has she already passed an FSP or telc/FaMed/ÖAK medical exam? It only counts if sent *with* the application.
3. Kenntnisprüfung waiting time: RPS says 8–10 months, LÄK says a date usually within 4–5 months. Different starting points?
4. Is a passed FSP required before a Berufserlaubnis in BW? The sources only say "e.g. after the FSP".
5. Hospitation is not on any official page read; not a station.
6. Visa / residence permit is outside these sources and not on the route.
7. Weiterbildung: the LÄK BW page could not be read; durations per specialty are not included.
8. Should Weiterbildung count as "on her path" (it is not needed to work as a doctor)? It is marked not optional for now.
9. All fees are "nach dem bisherigen Gebührenstand" and may change.
