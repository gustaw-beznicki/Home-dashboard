# RhythmEditor — co robi każde kliknięcie

Stan obecny (przed rozszerzeniem `monthly` o krotność). Źródła:
[`src/components/RhythmEditor.jsx`](../src/components/RhythmEditor.jsx),
[`src/lib/recurrence.js`](../src/lib/recurrence.js),
[`src/lib/constants.js`](../src/lib/constants.js).

Edytor nie trzyma własnego stanu. Dostaje jeden obiekt `interval` z
[`TaskSheet`](../src/components/TaskSheet.jsx) i po każdym kliknięciu oddaje **nowy**
obiekt przez `onChange`. Wszystko poniżej to opis tego, jak ten jeden obiekt się zmienia.

---

## 1. Chipy rytmu — przebudowa obiektu od zera

`setType()` nie robi merge'a. Buduje nowy obiekt i dokłada **tylko** pola pasujące do
typu. Dlatego przełączenie „co tydzień” → „co miesiąc” gubi `weekdays`, a powrót nie
przywraca ich — dostajesz wartość domyślną.

Jedyne pole, które przeżywa przełączanie, to `startsOn`.

```mermaid
flowchart TD
    P["dotychczasowy interval<br/>(dowolny typ)"]

    P --> CD["chip: codziennie"]
    P --> CN["chip: co kilka dni"]
    P --> CW["chip: co tydzień"]
    P --> CM["chip: co miesiąc"]
    P --> CX["chip: bez rytmu"]

    CD --> OD["{ type: 'daily',<br/>startsOn: stara || dziś }"]
    CN --> ON["{ type: 'everyNDays',<br/>startsOn: stara || dziś,<br/>n: 3 }"]
    CW --> OW["{ type: 'weekly',<br/>startsOn: stara || dziś,<br/>weekdays: [dzień tyg. kotwicy] }"]
    CM --> OM["{ type: 'monthly',<br/>startsOn: stara || dziś,<br/>day: 'first' }"]
    CX --> OX["{ type: 'manual' }<br/>startsOn USUNIĘTY"]
```

> **Pułapka:** `n = interval.n || 3` czyta z obiektu, w którym `n` już nie istnieje
> (bo poprzedni typ go nie miał). Czyli wyjście z „co kilka dni” i powrót zawsze
> resetuje do 3 — nie do tego, co było ustawione wcześniej. Tak samo `weekdays`
> i `day`.
>
> **Druga pułapka:** wyjście na „bez rytmu” kasuje `startsOn`. Powrót na dowolny
> rytm ustawia kotwicę na **dziś**, nawet jeśli przed chwilą była inna data.

---

## 2. Który panel się pokazuje

Panele są rozłączne. Dni tygodnia **nie** pojawiają się przy „co miesiąc” — to już
jest zagatowane.

```mermaid
flowchart TD
    T{interval.type}

    T -->|daily| D["brak panelu"]
    T -->|everyNDays| N["Slider SLIDER_STOPS<br/>1·2·3·4·5·6·7·10·14·21·30·45·60·90"]
    T -->|weekly| W["7 chipów dni tygodnia<br/>multi-select, kolejność wg weekStart"]
    T -->|monthly| M["4 radia:<br/>pierwszego / ostatniego /<br/>konkretnego (input 1–28) /<br/>w pierwszą sobotę"]
    T -->|manual| X["Tekst: „Nic samo nie wróci na listę”"]

    D --> A
    N --> A
    W --> A
    M --> A
    X --> NOA["kotwica ukryta"]

    A["Kotwica „Od kiedy liczymy?”<br/>od dziś / od jutra / inna data"]

    A --> R{"lastDone<br/>&& !isNew<br/>&& rytm zmieniony?"}
    R -->|tak| RB["Rebase:<br/>licz od ostatniego zrobienia /<br/>licz od dziś"]
    R -->|nie| P
    RB --> P
    NOA --> KONIEC["brak podglądu —<br/>manual nie ma terminów"]

    P["Podgląd „Wypadnie”:<br/>3 kolejne terminy + describeInterval()"]
```

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

    subgraph monthly
      R1["radio „pierwszego”"] --> R1a["set({ day: 'first' })"]
      R2["radio „ostatniego”"] --> R2a["set({ day: 'last' })"]
      R3["radio „konkretnego”"] --> R3a["set({ day: 15 })"]
      R3a --> R3b["input 1–28 → set({ day: n })"]
      R4["radio „w pierwszą sobotę”"] --> R4a["set({ day: { nth: 1, weekday: 6 } })<br/>na sztywno — nie da się zmienić"]
    end

    subgraph kotwica
      K1["od dziś"] --> K1a["set({ startsOn: dziś })"]
      K2["od jutra"] --> K2a["set({ startsOn: dziś + 1 })"]
      K3["inna data"] --> K3a["set({ startsOn: wybrana })"]
    end
```

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

    E0 -->|tak| SNAP["zwróć startsOn<br/>BEZ SPRAWDZENIA SIATKI"]
    E0 -->|nie| SW{"type"}

    SW -->|daily| DD["after + 1 dzień"]
    SW -->|everyNDays| DN["startsOn + ceil((after−startsOn+1)/n) × n"]
    SW -->|weekly| DW["pierwszy z kolejnych 7 dni,<br/>którego dzień tygodnia jest w weekdays"]
    SW -->|monthly| DM["sonduj 15 kolejnych miesięcy,<br/>pierwsza data wg reguły day,<br/>która jest > after i ≥ startsOn"]
```

> **To jest ten „wybór dni bez sensu”.** Gałąź `SNAP` zwraca kotwicę dosłownie.
> Więc „co miesiąc → pierwszego dnia”, kotwica `od dziś` = 27 lipca, daje podgląd
> `27.07 → 01.09 → 01.10`. Wybrany dzień miesiąca jest respektowany dopiero od
> drugiego terminu. Analogicznie „co tydzień: pn” z kotwicą we wtorek — pierwszy
> termin wypada we wtorek.
>
> Propozycja naprawy (opcja A z rozmowy): zamiast `return start` zwracać pierwszy
> punkt siatki **≥** `start`. Kotwica przestaje znaczyć „pierwszy termin”, zaczyna
> znaczyć „nie wcześniej niż”.

---

## 5. Zapis — co ląduje w D1

`intervalColumns()` w [`worker/db.js`](../worker/db.js) zeruje kolumny nienależące do
typu, więc w bazie nie zostaje sierota po poprzednim rytmie.

```mermaid
flowchart LR
    I["interval"] --> T["interval_type"]
    I --> N["interval_n<br/>tylko everyNDays, inaczej NULL"]
    I --> SO["interval_starts_on<br/>NULL dla manual"]
    I --> WD["interval_weekdays<br/>JSON, tylko weekly i niepuste"]
    I --> DY["interval_day<br/>tylko monthly:<br/>'1'..'28' | 'first' | 'last' | JSON {nth,weekday}"]
```

---

## 6. Rebase — dlaczego w ogóle pyta

Zmiana rytmu na zadaniu, które już było robione, przesuwa następny termin. Dlatego
`TaskSheet` porównuje `intervalKey(form.interval)` z kluczem sprzed edycji
(`intervalKey` normalizuje kolejność pól, bo API i edytor budują obiekt inaczej).

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
