import { STORY_CONTENT } from './storyContent.js';

export const LEVEL_CONTENT = {
    A1: {
        label: 'A1 – Beginner',
        categories: {
            hauptsatz:        { label: 'Hauptsatz',        file: 'data/levels/A1_hauptsatz.json'        },
            fragen:           { label: 'Fragen',            file: 'data/levels/A1_fragen.json'           },
            modal:            { label: 'Modalverben',       file: 'data/levels/A1_modal.json'            },
            negation:         { label: 'Negation',          file: 'data/levels/A1_negation.json'         },
            trennbare_verben: { label: 'Trennbare Verben',  file: 'data/levels/A1_trennbare_verben.json' },
            possessivartikel: { label: 'Possessivartikel',  file: 'data/levels/A1_possessivartikel.json' },
            praepositionen:   { label: 'Präpositionen',     file: 'data/levels/A1_praepositionen.json'   },
            zahlen_zeit:      { label: 'Zahlen & Zeit',     file: 'data/levels/A1_zahlen_zeit.json'      },
            alltag:           { label: 'Alltag',            file: 'data/levels/A1_alltag.json'           }
        }
    },
    A2: {
        label: 'A2 – Elementary',
        categories: {
            nebensatz:            { label: 'Nebensatz',           file: 'data/levels/A2_nebensatz.json'            },
            perfekt:              { label: 'Perfekt',              file: 'data/levels/A2_perfekt.json'              },
            imperativ:            { label: 'Imperativ',            file: 'data/levels/A2_imperativ.json'            },
            praeteritum:          { label: 'Präteritum',           file: 'data/levels/A2_praeteritum.json'          },
            dativ:                { label: 'Dativ',                file: 'data/levels/A2_dativ.json'                },
            reflexivverben:       { label: 'Reflexivverben',       file: 'data/levels/A2_reflexivverben.json'       },
            komparativ:           { label: 'Komparativ',           file: 'data/levels/A2_komparativ.json'           },
            futur1:               { label: 'Futur I',              file: 'data/levels/A2_futur1.json'               },
            wechselpraepositionen:{ label: 'Wechselpräpositionen', file: 'data/levels/A2_wechselpraepositionen.json'}
        }
    },
    B1: {
        label: 'B1 – Intermediate',
        categories: {
            konjunktiv:             { label: 'Konjunktiv II',         file: 'data/levels/B1_konjunktiv.json'             },
            passiv:                 { label: 'Passiv',                 file: 'data/levels/B1_passiv.json'                 },
            relativsatz:            { label: 'Relativsatz',            file: 'data/levels/B1_relativsatz.json'            },
            infinitivkonstruktionen:{ label: 'Infinitivkonstruktionen',file: 'data/levels/B1_infinitivkonstruktionen.json'},
            temporalsaetze:         { label: 'Temporalsätze',          file: 'data/levels/B1_temporalsaetze.json'         },
            konzessivsaetze:        { label: 'Konzessivsätze',         file: 'data/levels/B1_konzessivsaetze.json'        },
            adjektivdeklination:    { label: 'Adjektivdeklination',    file: 'data/levels/B1_adjektivdeklination.json'    },
            zweiteilige_konnektoren:{ label: 'Zweiteilige Konnektoren',file: 'data/levels/B1_zweiteilige_konnektoren.json'},
            pronominaladverbien:    { label: 'Pronominaladverbien',    file: 'data/levels/B1_pronominaladverbien.json'    },
            indirekte_rede:         { label: 'Indirekte Rede',         file: 'data/levels/B1_indirekte_rede.json'         },
            kausale_konnektoren:    { label: 'Kausale Konnektoren',    file: 'data/levels/B1_kausale_konnektoren.json'    }
        }
    }
};

/**
 * Story chapters and their drills, generated from data/stories/ (storyContent.js).
 * They are added to LEVEL_CONTENT ahead of the grammar categories, each with
 * `story` metadata: { kind: 'chapter'|'drill', chapterKey, index } where `index`
 * is the chapter's position in the level's unlock order.
 */
for (const [level, stories] of Object.entries(STORY_CONTENT)) {
    if (!LEVEL_CONTENT[level]) continue;
    const storyCategories = {};
    let index = 0;
    stories.forEach(story => story.chapters.forEach(ch => {
        storyCategories[ch.key] = { label: ch.label, file: ch.file, version: ch.version,
            story: { kind: 'chapter', chapterKey: ch.key, index, storyNo: story.story, storyTitle: story.title } };
        storyCategories[ch.drillKey] = { label: ch.drillLabel, file: ch.drillFile, version: ch.drillVersion,
            story: { kind: 'drill', chapterKey: ch.key, index, storyNo: story.story, storyTitle: story.title } };
        index++;
    }));
    LEVEL_CONTENT[level].categories = { ...storyCategories, ...LEVEL_CONTENT[level].categories };
}

/**
 * URL to fetch a category's data/levels file, or with `library` its data/library twin.
 * Story categories carry a content `version` (build_stories.py), appended as ?v= so a
 * rebuilt file is never served from a stale browser cache.
 * @param {{file: string, version?: string}} catData
 * @param {{library?: boolean}} [opts]
 * @returns {string}
 */
export function categoryUrl(catData, { library = false } = {}) {
    const path = library ? catData.file.replace('data/levels/', 'data/library/') : catData.file;
    return catData.version ? `${path}?v=${catData.version}` : path;
}

/**
 * Chapter keys of a level in unlock order.
 * @param {string} level
 * @returns {string[]}
 */
export function chapterOrder(level) {
    return (STORY_CONTENT[level] || []).flatMap(story => story.chapters.map(ch => ch.key));
}
