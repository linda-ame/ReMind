# ReMind — individuāli pārskatītas grūtības pakāpes, V2 (2026-10-25)

**Vienam uzdevumam — viens skaitlis no 1 līdz 5.** V2 aizstāj iepriekšējo P01 grūtības metadatu failu, bet **neaizstāj nevienu pašu uzdevumu**.

## Pārskatīšanas princips

Atšķirībā no V1, katram ID saturs pārskatīts pēc valodas nozīmes, vārda pazīstamības un specializācijas, gramatikas un atbildes iegūšanas nepieciešamajām kognitīvajām darbībām. Skaitlis ir kopējs profesionāli nevalidēts redakcionāls grūtības novērtējums — nevis garuma formula vai konkrēta cilvēka klīniskais rādītājs.

1. **Ļoti viegls:** ļoti pazīstams vārds, tieša atbilde, skaidra sakarība.
2. **Viegls:** neliela izvēle, nedaudz gramatikas vai parasts saliktenis.
3. **Vidējs:** vairākas jāsaista pazīmes, specifiskāks vārds vai sarežģītāka vārdu secība.
4. **Grūts:** mazpazīstama terminoloģija, abstrakta klasifikācija vai vairākas līdzīgas detaļas.
5. **Ļoti grūts:** ļoti specifiski termini vai sarežģīta abstrakta izpratne. Nav jāpiespiež katrai sadaļai saturēt 5. līmeņa uzdevumus.

**Uzdevumu tipiem slodze atšķiras:** attēlā redzama ikdienas priekšmeta nosaukšana var būt 1. līmenī, bet ļoti specializētas kategorijas atšķiršana — 5. līmenī. Teksta lasīšanā vērtēts arī tas, ka jautājumu laikā teksts ir paslēpts.

## Faili

- `remind_difficulty_by_id.json` — uzdevumu ID → līmeņi (V2 + P02; vecie ID nav dzēsti).
- `remind_reading_question_difficulty_by_id.json` — jautājumu ID → līmeņi (36×V2 + 12×P02 teksti).
- `remind_difficulty_review.csv` — V2 pārskats (vecie uzdevumi).
- `remind_reading_question_review.csv` — V2 jautājumu pārskats.
- `remind_difficulty_review_P02.csv` — P02 satura grūtības pārskats.

### P02 papildinājums (2026-10-25)

Pievienoti 209 jauni uzdevumi un 48 lasīšanas jautājumi (4.–5. līmenis). Esošie P01/V2 līmeņi nav mainīti.

## Aktīvo uzdevumu sadalījums (bez 45 arhīva vārdiem)

| Tips | Kopā | 1 | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|---:|
| antonym | 60 | 20 | 15 | 21 | 4 | 0 |
| definition_guess | 50 | 8 | 17 | 19 | 6 | 0 |
| image_word | 36 | 26 | 9 | 1 | 0 | 0 |
| odd_one_out | 50 | 14 | 13 | 15 | 7 | 1 |
| reading_comprehension | 36 | 0 | 8 | 20 | 8 | 0 |
| sentence_completion | 141 | 44 | 74 | 23 | 0 | 0 |
| sentence_order | 50 | 8 | 13 | 26 | 3 | 0 |
| word_choice | 72 | 23 | 40 | 9 | 0 | 0 |
| word_reading | 150 | 11 | 52 | 48 | 33 | 6 |

**Kopā: 645 aktīvie uzdevumi.** Sadalījums: 1. līmenis: 154, 2. līmenis: 241, 3. līmenis: 182, 4. līmenis: 61, 5. līmenis: 7.

Pārskatā vecais līmenis mainīts **259 no 690** uzdevumiem. Atsevišķi pārskatīti arī visi 120 jautājumi.

**Brīdinājums:** neviena automātiska grūtības skala nav pielīdzināma validētam afāzijas testam. Lietotāja pašvērtējumu un atbildēšanas vēsturi glabāt atsevišķi. Jauno grūtības skalu pirms automātiskas adaptācijas ieteicams pārbaudīt ar reāliem uzdevumu mēģinājumiem un logopēdu.
