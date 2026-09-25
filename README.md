# Gym PWA

Prywatny, offline-first tracker treningowy pod iPhone. Dane treningowe są przechowywane lokalnie w IndexedDB. Repozytorium nie otrzymuje historii treningów.

## Plan startowy

Plan został przepisany z dostarczonego PDF **UPPER-LOWER ŚREDNIOZAAWANSOWANY**:

- UPPER 1
- LOWER 1
- UPPER 2
- LOWER 2

W aplikacji zapisane są serie, zakresy powtórzeń, RIR, tempo, przerwy i superserie z tabel na stronach 25–27 PDF.

## Funkcje

- instalowalne PWA / standalone
- działanie offline po pierwszym załadowaniu
- IndexedDB (Dexie)
- odzyskiwanie aktywnego treningu
- automatyczny timer przerwy po zatwierdzeniu serii
- timer oparty o timestamp końca, więc nie rozjeżdża się po zablokowaniu telefonu
- poprzednia seria danego ćwiczenia
- e1RM metodą Epleya
- aktualny 1RM oddzielony od e1RM
- objętość, historia i podstawowe statystyki
- cel Bench Press 100 kg
- pomiary ciała
- eksport/import JSON i eksport CSV
- brak analytics, reklam i trackerów

## Lokalnie

```bash
npm install
npm run dev
```

Test/build:

```bash
npm test
npm run build
```

## GitHub Pages

Workflow `.github/workflows/pages.yml` publikuje aplikację po pushu do `main`.

W repozytorium ustaw:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

Docelowy adres:

`https://Dududunu.github.io/chatgpt/`

Repozytorium jest prywatne. Możliwość publikowania Pages z prywatnego repo zależy od planu GitHub. Jeśli Pages odrzuci prywatne repo, kod można upublicznić bez ujawniania historii treningów, ponieważ historia zostaje lokalnie na telefonie.

## iPhone 14

1. Otwórz URL w Safari.
2. Udostępnij → Dodaj do ekranu początkowego.
3. Włącz Open as Web App, jeśli opcja jest dostępna.
4. Dodaj.
5. Uruchamiaj z ikony.

## Backup

W zakładce **Więcej** regularnie wybieraj **Eksportuj backup JSON**. Wyczyszczenie danych Safari/PWA może usunąć lokalną bazę.
