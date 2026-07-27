# RhythmEditor — co robi każde kliknięcie

Źródła: [`src/components/RhythmEditor.jsx`](../src/components/RhythmEditor.jsx),
[`src/lib/recurrence.js`](../src/lib/recurrence.js),
[`src/lib/constants.js`](../src/lib/constants.js). Decyzje modelowe: ADR 0010 (kotwica) i
ADR 0015 (krotność i snapowanie).

Edytor nie trzyma własnego stanu. Dostaje jeden obiekt `interval` z
[`TaskSheet`](../src/components/TaskSheet.jsx) i po każdym kliknięciu oddaje **nowy**
obiekt przez `onChange`. Wszystko poniżej to opis tego, jak ten jeden obiekt się zmienia.

---

## 1. Chipy rytmu — przebudowa obiektu od zera

`setRhythm()` nie robi merge'a. Buduje nowy obiekt i dokłada **tylko** pola pasujące do
rytmu. Dlatego przełączenie „co tydzień” → „co miesiąc” gubi `weekdays`, a powrót nie
przywraca ich — dostajesz wartość domyślną.

Jedyne pole, które przeżywa przełączanie, to `startsOn`.

```mermaid
flowchart TD
    P["dotychczasowy interval<br/>(dowolny rytm)"]

    P --> CD["chip: codziennie"]
    P --> CN["chip: co kilka dni"]
    P --> CW["chip: co tydzień"]
    P --> CM["chip: co miesiąc"]
    P --> CY["chip: co rok"]
    P --> CX["chip: bez rytmu"]

    CD --> OD["{ type: 'daily',<br/>startsOn: stara || dziś }"]
    CN --> ON["{ type: 'everyNDays',<br/>startsOn: stara || dziś,<br/>n: 3 }"]
    CW --> OW["{ type: 'weekly',<br/>startsOn: stara || dziś,<br/>weekdays: [dzień tyg. kotwicy] }"]
    CM --> OM["{ type: 'monthly',<br/>unit: 'month', every: 1,<br/>startsOn: stara || dziś,<br/>day: 'first' }"]
    CY --> OY["{ type: 'monthly',<br/>unit: 'year', every: 1,<br/>startsOn: stara || dziś }<br/>BEZ reguły dnia"]
    CX --> OX["{ type: 'manual' }<br/>startsOn USUNIĘTY"]
```

> **Miesiące i lata to jeden typ.** Oba zapisują `type: 'monthly'`; rozróżnia je `unit`.
> Powód jest kosztowy, nie estetyczny: `interval_type` ma constraint `CHECK`, którego D1 nie
> potrafi `ALTER`, więc osobny typ `yearly` oznaczałby przebudowę tabeli (ADR 0015). Chipy
> są mimo to osobne, bo „co 2 lata” schowane w panelu miesięcznym byłoby nieodnajdywalne.
>
> **Krotność nie przechodzi między jednostkami.** Przejście „co 3 miesiące” → „co rok”
> resetuje `every` do 1. „Co 3 lata” po jednym kliknięciu byłoby nieprzyjemną niespodzianką.
>
> **Pułapka:** `n = interval.n || 3` czyta z obiektu, w którym `n` już nie istnieje
> (bo poprzedni typ go nie miał). Czyli wyjście z „co kilka dni” i powrót zawsze
> resetuje do 3 — nie do tego, co było ustawione wcześniej. Tak samo `weekdays` i `day`.
>
> **Druga pułapka:** wyjście na „bez rytmu” kasuje `startsOn`. Powrót na dowolny
> rytm ustawia kotwicę na **dziś**, nawet jeśli przed chwilą była inna data.

---

## 2. Który panel się pokazuje

Panele są rozłączne. To jest ta „część widoku schowana za logiką”: dni tygodnia nie
pojawiają się przy rytmach miesięcznych, reguły dnia nie pojawiają się przy rocznym, a
ostrzeżenie o lutym tylko przy „ostatniego dnia”.

```mermaid
flowchart TD
    T{interval.type}

    T -->|daily| D["brak panelu"]
    T -->|everyNDays| N["Slider SLIDER_STOPS<br/>1·2·3·4·5·6·7·10·14·21·30·45·60·90"]
    T -->|weekly| W["7 chipów dni tygodnia<br/>multi-select, kolejność wg weekStart"]
    T -->|manual| X["Tekst: „Nic samo nie wróci na listę”"]
    T -->|monthly| C["Chipy krotności „Co ile?”"]

    C --> U{interval.unit}
    U -->|month| M1["MONTH_STEPS<br/>miesiąc · 2 miesiące · kwartał · pół roku"]
    U -->|year| Y1["YEAR_STEPS<br/>rok · 2 lata · 3 lata · 5 lat"]

    Y1 --> Y2["Tekst: „Dzień i miesiąc bierzemy<br/>z daty poniżej”<br/>BRAK reguł dnia"]

    M1 --> M2["4 radia reguły dnia:<br/>pierwszego / ostatniego /<br/>konkretnego (input 1–28) /<br/>w dany dzień tygodnia"]
    M2 --> M3{"day jest obiektem?"}
    M3 -->|tak| M4["2 selecty:<br/>w [którą] [dzień tygodnia] miesiąca"]
    M3 -->|nie| M5{"day === 'last'?"}
    M5 -->|tak| M6["Ostrzeżenie o lutym"]

    D --> A
    N --> A
    W --> A
    Y2 --> A
    M2 --> A
    X --> NOA["kotwica ukryta"]

    A["Kotwica „Od kiedy liczymy?”<br/>od dziś / od jutra / inna data"]

    A --> R{"lastDone<br/>&& !isNew<br/>&& rytm zmieniony?"}
    R -->|tak| RB["Rebase:<br/>licz od ostatniego zrobienia /<br/>licz od dziś"]
    R -->|nie| P
    RB --> P
    NOA --> KONIEC["brak podglądu —<br/>manual nie ma terminów"]

    P["Podgląd „Wypadnie”:<br/>3 kolejne terminy + describeInterval()"]
```

> **Krotność poza listą chipów zostaje.** Jeśli `every` nie pasuje do żadnego chipa (import,
> ręczna edycja w D1), pod rzędem pojawia się opis słowny, zamiast cichego snapowania do
> najbliższej wartości.

---

## 3. Co robi każda kontrolka wewnątrz panelu

```mermaid
flowchart LR
    subgraph everyNDays
      S["przeciągnięcie slidera"] --> S1["set({ n: SLIDER_STOPS[idx] })"]
    end

    subgraph weekly
      C1["klik chipu, nieaktywny"] --> C2["set({ weekdays: [...weekdays, dzień].sort() })"]
      C3["klik chipu, aktywny"] --> C4["set({ weekdays: weekdays.filter(≠ dzień) })"]
      C4 --> C5{"pusta lista?"}
      C5 -->|tak| C6["hint „Zaznacz przynajmniej<br/>jeden dzień.” + zapis zablokowany"]
    end

    subgraph krotnosc
      K1["klik chipu krotności"] --> K1a["set({ every: N })<br/>reguła dnia nietknięta"]
    end

    subgraph monthly
      R1["radio „pierwszego”"] --> R1a["set({ day: 'first' })"]
      R2["radio „ostatniego”"] --> R2a["set({ day: 'last' })"]
      R3["radio „konkretnego”"] --> R3a["set({ day: 15 })"]
      R3a --> R3b["input 1–28 → set({ day: n })"]
      R4["radio „w dany dzień tygodnia”"] --> R4a["set({ day: { nth: 1, weekday: 6 } })"]
      R4a --> R4b["select „Która z kolei” 1–4<br/>set({ day: { ...day, nth } })"]
      R4a --> R4c["select „Dzień tygodnia” 1–7<br/>set({ day: { ...day, weekday } })"]
    end

    subgraph kotwica
      A1["od dziś"] --> A1a["set({ startsOn: dziś })"]
      A2["od jutra"] --> A2a["set({ startsOn: dziś + 1 })"]
      A3["inna data"] --> A3a["set({ startsOn: wybrana })"]
    end
```

> **Porządkowe kończą się na czwartej.** Piąty dzień tygodnia w większości miesięcy nie
> istnieje, więc jego oferowanie dawałoby regułę, która po cichu pomija miesiące.

---

## 4. Jak pola przekładają się na terminy

`nextOccurrenceAfter(interval, after)` — `after` to `lastDone`, albo `null` gdy
zadanie nigdy nie było zrobione.

```mermaid
flowchart TD
    START["nextOccurrenceAfter(interval, after)"] --> M0{"type === 'manual'?"}
    M0 -->|tak| NULL1["null — brak terminu"]
    M0 -->|nie| A0{"startsOn ustawione?"}
    A0 -->|nie| NULL2["null → computeStatus zwraca<br/>'overdue' celowo (ADR 0010)"]
    A0 -->|tak| E0{"after === null<br/>lub after < startsOn?"}

    E0 -->|tak| SNAP["firstOnGrid(interval, startsOn)<br/>pierwszy punkt siatki ≥ kotwicy"]
    E0 -->|nie| SW{"type"}

    SNAP --> SG{"type"}
    SG -->|"daily / everyNDays"| SG1["startsOn — to jest punkt zerowy siatki"]
    SG -->|weekly| SG2["pierwszy z 7 dni od kotwicy,<br/>którego dzień tyg. jest w weekdays"]
    SG -->|monthly| SG3["monthlyPointFrom, granica włącznie"]

    SW -->|daily| DD["after + 1 dzień"]
    SW -->|everyNDays| DN["startsOn + ceil((after−startsOn+1)/n) × n"]
    SW -->|weekly| DW["pierwszy z kolejnych 7 dni,<br/>którego dzień tyg. jest w weekdays"]
    SW -->|monthly| DM["monthlyPointFrom, granica wyłącznie"]
```

Miesięczna gałąź jest jedna dla obu jednostek:

```mermaid
flowchart TD
    G["monthlyGrid(interval, startsOn)"] --> G1{"unit === 'year'?"}
    G1 -->|tak| GY["stepMonths = every × 12<br/>rule = dzień z kotwicy"]
    G1 -->|nie| GM["stepMonths = every<br/>rule = interval.day ?? dzień z kotwicy"]

    GY --> W1["monthlyPointFrom: idź po k = 0, 1, 2…<br/>miesiąc = startsOn.month + k × stepMonths<br/>data = monthlyDateFor(rok, miesiąc, rule)"]
    GM --> W1
    W1 --> W2["pomiń k, dla których reguła nie daje daty<br/>(brak n-tego dnia tygodnia w tym miesiącu)<br/>oraz daty wcześniejsze niż startsOn"]
    W2 --> W3["zwróć pierwszą spełniającą granicę"]
```

> **Rok to dwanaście miesięcy, nie osobna gałąź.** Dzięki temu 29 lutego działa bez wyjątku:
> `monthlyDateFor` przycina regułę do długości miesiąca, więc kotwica z dnia przestępnego
> wypada 28. w latach zwykłych i wraca na 29. w przestępnych.
>
> **Kotwica znaczy „nie wcześniej niż”, nie „pierwszy termin”.** Wcześniej ta gałąź zwracała
> `startsOn` dosłownie, więc „co miesiąc → pierwszego dnia” z kotwicą 27 lipca dawało podgląd
> `27.07 → 01.09 → 01.10` — jeden termin poza siatką, dopiero potem reguła. Naprawione w
> ADR 0015. Zmiana dotyczy też **istniejących** zadań z kotwicą poza siatką i bez wykonania;
> zadania z `lastDone` były zawsze liczone z siatki.

---

## 5. Zapis — co ląduje w D1

`intervalColumns()` w [`worker/db.js`](../worker/db.js) zeruje kolumny nienależące do
rytmu, więc w bazie nie zostaje sierota po poprzednim.

```mermaid
flowchart LR
    I["interval"] --> T["interval_type"]
    I --> N["interval_n<br/>tylko everyNDays, inaczej NULL"]
    I --> SO["interval_starts_on<br/>NULL dla manual"]
    I --> WD["interval_weekdays<br/>JSON, tylko weekly i niepuste"]
    I --> DY["interval_day<br/>tylko monthly z unit='month':<br/>'1'..'28' | 'first' | 'last' | JSON {nth,weekday}"]
    I --> EV["interval_every<br/>tylko monthly, minimum 1"]
    I --> UN["interval_unit<br/>tylko monthly: 'month' | 'year'"]
```

> **Przy `unit: 'year'` kolumna `interval_day` jest zerowana.** Reguła dnia po poprzednim
> życiu jako rytm miesięczny mogłaby tylko kłócić się z kotwicą, która trzyma miesiąc i dzień.
>
> **Brak `every`/`unit` czyta się jako `every: 1, unit: 'month'`.** Tak wygląda każdy wiersz
> zapisany przed migracją 0008 i tak samo wyglądają wpisy w katalogu chore, które nie muszą
> tego powtarzać 85 razy.

---

## 6. Rebase — dlaczego w ogóle pyta

Zmiana rytmu na zadaniu, które już było robione, przesuwa następny termin. Dlatego
`TaskSheet` porównuje `intervalKey(form.interval)` z kluczem sprzed edycji.

```mermaid
flowchart TD
    E["użytkownik zmienia rytm"] --> Q{"isNew?"}
    Q -->|tak| NOASK["zapisz bez pytania"]
    Q -->|nie| Q2{"lastDone istnieje?"}
    Q2 -->|nie| NOASK
    Q2 -->|tak| Q3{"intervalKey się zmienił?"}
    Q3 -->|nie| NOASK
    Q3 -->|tak| ASK["pokaż wybór rebase"]
    ASK --> O1["licz od ostatniego zrobienia<br/>→ startsOn bez zmian"]
    ASK --> O2["licz od dziś, zacznij na nowo<br/>→ startsOn = dziś"]
```

> **`intervalKey` normalizuje `every` i `unit`, i to jest nośne.** Bez tego wiersz sprzed
> migracji 0008 nie byłby równy temu samemu rytmowi odbudowanemu przez edytor, i arkusz
> pytałby „od czego liczyć?” o rytm, którego nikt nie dotknął.

---

## 7. Podgląd — kiedy pokazuje rok

`formatDate(date, { withYear })`, ustawiane per data dla lat innych niż bieżący. Bez tego
„co 2 lata” czytało się jako `27 lipca · 27 lipca · 27 lipca` — trzy poprawne daty, 2026,
2028 i 2030, wyrenderowane identycznie.
