// Every Tailwind class here is a LITERAL string — the JIT scanner can't see
// template interpolation, so a `bg-${color}-100` would silently produce no CSS.

export const STORAGE_KEY = 'home-dashboard:tasks:v1'
export const THEME_STORAGE_KEY = 'home-dashboard:theme'

export const CATEGORIES = [
  { key: 'plants', label: 'Rośliny' },
  { key: 'equipment', label: 'Sprzęt' },
  { key: 'home', label: 'Dom' },
  { key: 'health', label: 'Zdrowie' },
]

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]))

// Category tile behind the icon. Recognition, not status — statuses never use
// category colour and vice versa.
export const CATEGORY_TILE_CLASS = {
  plants: 'bg-plant-100 text-plant-500 dark:bg-[#202a14] dark:text-[#aec399]',
  equipment: 'bg-clay-100 text-clay-700 dark:bg-[#301717] dark:text-[#e4a9a8]',
  home: 'bg-moss-300 text-moss-800 dark:bg-bark-600 dark:text-moss-300',
  health: 'bg-health-100 text-health-500 dark:bg-bark-700 dark:text-moss-400',
}

// Still four derived statuses; only the wording changed. `later` is the status
// formerly called `inactive`.
export const STATUS_LABELS = {
  overdue: 'Zaległe',
  due: 'Na dziś',
  later: 'Na spokojnie',
  done: 'Zrobione',
}

// Colour never carries status on its own: the marker's *shape* differs too
// (square / filled circle / hollow circle), and the card always says the word.
export const STATUS_MARK_CLASS = {
  overdue: 'h-[9px] w-[9px] rounded-[3px] bg-clay-500 dark:bg-[#c98281]',
  due: 'h-[9px] w-[9px] rounded-full bg-forest-600',
  later: 'h-[9px] w-[9px] rounded-full bg-moss-400 dark:bg-moss-500',
  done: 'h-[9px] w-[9px] rounded-full border-2 border-moss-400 dark:border-moss-500',
}

export const STATUS_TEXT_CLASS = {
  overdue: 'text-clay-700 dark:text-[#e4a9a8]',
  due: 'text-moss-600 dark:text-moss-500',
  later: 'text-moss-500 dark:text-moss-600',
  done: 'text-moss-500 dark:text-moss-600',
}

// The card's own border encodes status as well.
export const CARD_CLASS = {
  overdue: 'bg-moss-50 ring-[1.5px] ring-clay-300 dark:bg-bark-800 dark:ring-[#492828]',
  due: 'bg-moss-50 shadow-card dark:bg-bark-800',
  later: 'bg-moss-200 dark:bg-bark-700',
  done: 'bg-moss-50 opacity-60 shadow-card dark:bg-bark-800',
}

// The dashboard's three stops. These replace the old four tabs on mobile:
// urgency is the page structure now, and category is a side filter.
export const GROUPS = [
  { key: 'overdue', label: 'Zaległe' },
  { key: 'due', label: 'Na dziś' },
  { key: 'later', label: 'Na spokojnie' },
]

// Desktop-only left rail. Same four rules the old tabs applied, presented
// differently — see filterForView in recurrence.js.
export const VIEWS = [
  { key: 'today', label: 'Dziś' },
  { key: 'upcoming', label: 'Najbliższy tydzień' },
  { key: 'all', label: 'Wszystko' },
  { key: 'archive', label: 'Schowek' },
]

export const RHYTHMS = [
  { type: 'daily', label: 'codziennie' },
  { type: 'everyNDays', label: 'co kilka dni' },
  { type: 'weekly', label: 'co tydzień' },
  { type: 'monthly', label: 'co miesiąc' },
  { type: 'manual', label: 'bez rytmu' },
]

export const MONTHLY_MODES = [
  { key: 'first', label: 'pierwszego dnia', hint: '1.' },
  { key: 'last', label: 'ostatniego dnia', hint: '28./30./31.' },
  { key: 'day', label: 'konkretnego dnia', hint: null },
  { key: 'nth', label: 'w pierwszą sobotę', hint: 'sob' },
]

export const WEEKDAYS = [
  { key: 1, short: 'pn', label: 'poniedziałek' },
  { key: 2, short: 'wt', label: 'wtorek' },
  { key: 3, short: 'śr', label: 'środa' },
  { key: 4, short: 'cz', label: 'czwartek' },
  { key: 5, short: 'pt', label: 'piątek' },
  { key: 6, short: 'sb', label: 'sobota' },
  { key: 7, short: 'nd', label: 'niedziela' },
]

// Non-linear stops so the slider spends its travel where the useful values are.
export const SLIDER_STOPS = [1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30, 45, 60, 90]

// How long a completed task keeps its "cofnij" affordance before the next list
// render sweeps it out of the group it was ticked off in.
export const UNDO_WINDOW_MS = 8000

export const COPY = {
  appName: 'Ogarniamy',
  add: 'Nowa rzecz',
  quickAddPlaceholder: 'Co jeszcze trzeba ogarnąć?',
  loading: 'Zbieram listę…',
  loadError: 'Nie udało się pobrać listy.',
  retry: 'Spróbuj jeszcze raz',
  rollback: 'Nie zapisało się — zadanie wróciło na miejsce.',
  undo: 'cofnij',
  done: 'Zrobione',
  pin: 'Trzymaj na wierzchu',
  unpin: 'Zdejmij z wierzchu',
  archive: 'Schowaj',
  unarchive: 'Wyjmij ze schowka',
  remove: 'Usuń na zawsze',
  emptyToday: 'Na dziś nic. Dom się sam ogarnął.',
  emptyTodayHint: 'Najbliższa rzecz wypada',
  emptyAll: 'Pusto. Dodaj pierwszą rzecz — resztę policzymy.',
  emptyView: 'Tu nic nie ma.',
  formNew: 'Nowa rzecz do ogarnięcia',
  formEdit: 'Poprawka',
  namePlaceholder: 'Co trzeba ogarnąć?',
  fieldCategory: 'Kategoria',
  fieldRhythm: 'Jak często?',
  fieldWeekdays: 'W które dni?',
  fieldAnchor: 'Od kiedy liczymy?',
  fieldAnchorHint: 'To ta data wyznacza, kiedy zadanie wypadnie następnym razem.',
  fieldLastDone: 'Ostatnio zrobione',
  fieldNote: 'Notatka',
  notePlaceholder: 'np. filtr leży w szafce pod zlewem',
  cancel: 'Anuluj',
  save: 'Zapisz',
  create: 'Dodaj do domu',
  preview: 'Wypadnie',
  never: 'nigdy',
  signOut: 'wyjdź',
  categoriesLabel: 'Kategorie',
  allCategories: 'Wszystkie',
  weekTitle: 'Ten tydzień',
  weekDone: 'rzeczy ogarniętych',
  login: {
    tagline: 'Wasz dom, jedna lista.',
    lead: 'Rośliny, filtry, rachunki — wszystko w jednym miejscu, dla obojga.',
    button: 'Wejdź przez Google',
    redirecting: 'Przekierowuję…',
    denied:
      'Tego konta nie ma na liście domowników. Poproś o zaproszenie kogoś, kto już tu jest.',
    failed: 'Nie udało się wejść. Spróbuj jeszcze raz.',
    noSignup: 'Nie ma tu zapisów.',
    invited: 'Dostęp dostaje się od kogoś, kto już jest w domu.',
  },
  admin: {
    title: 'Domownicy',
    subtitle:
      'Dostęp jest z zaproszenia — nie ma tu rejestracji. Hasła i logowanie dwuskładnikowe siedzą po stronie konta Google.',
    back: 'Wróć do listy',
    emailPlaceholder: 'adres@gmail.com',
    invite: 'Zaproś',
    emailNote: 'Mail to uprzejmość — zaproszenie działa nawet wtedy, gdy wiadomość nie wyjdzie.',
    roleMember: 'Domownik',
    roleAdmin: 'Gospodarz',
    loading: 'Zbieram listę domowników…',
    error: 'Coś się posypało. Spróbuj jeszcze raz.',
    emailRequired: 'Wpisz adres, na który mamy wysłać zaproszenie.',
    pending: 'zaproszony, jeszcze nie wszedł',
    revoked: 'bez dostępu',
    active: 'ma dostęp',
    you: 'to Ty',
    block: 'Odetnij dostęp',
    unblock: 'Przywróć dostęp',
    makeMember: 'Zrób domownikiem',
    makeAdmin: 'Zrób gospodarzem',
    lastAdmin: 'Dom musi mieć przynajmniej jednego gospodarza.',
    invitedEmailed: (email) => `Zaproszenie poszło na ${email}.`,
    invitedNoEmail: (email) => `${email} dodany, ale mail nie wyszedł. Przekaż zaproszenie sam.`,
  },
  panel: {
    title: 'Panel domu',
    sections: {
      home: { label: 'Dom', hint: 'nazwa, tydzień, przypomnienia' },
      people: { label: 'Domownicy', hint: 'zaproszenia, role, dostęp' },
      cats: { label: 'Kategorie', hint: 'jak rzeczy są rozpoznawane' },
      data: { label: 'Dane domu', hint: 'import, eksport, kasowanie' },
    },
    homeIntro:
      'Nazwa pojawia się w mailach z zaproszeniem. Reszta to drobiazgi, które zmieniają sposób liczenia terminów.',
    homeName: 'Nazwa domu',
    weekStart: 'Tydzień zaczyna się od',
    weekStartHint: 'Wpływa na pasek dni i na rytmy tygodniowe.',
    weekMonday: 'poniedziałku',
    weekSunday: 'niedzieli',
    defaultRhythm: 'Domyślny rytm nowych rzeczy',
    defaultRhythmHint: 'Od czego zaczyna edytor, gdy dodajesz coś jednym zdaniem, a rytmu nie widać.',
    reminders: 'Przypomnienia',
    remindMorning: 'Poranne podsumowanie',
    remindMorningHint: 'Jedno powiadomienie o 8:00, jeśli coś wypada.',
    remindOverdue: 'Przypominaj o zaległych',
    remindOverdueHint: 'Drugie szturchnięcie wieczorem. Domyślnie wyłączone — dom to nie praca.',
    catsIntro:
      'Kategoria to tylko sposób na rozpoznanie rzeczy na liście — nie wpływa na terminy. Kilka wystarczy; przy dwudziestu kafelki przestają cokolwiek mówić.',
    catPlaceholder: 'np. Auto, Ogród, Piwnica',
    catAdd: 'Dodaj',
    catRemoveNote: 'Usunięcie kategorii nie kasuje rzeczy — wpadają do „Dom”.',
    dataIntro: 'Wszystko trzyma się w jednym miejscu. Tu można to wyjąć, posprzątać albo skasować.',
    exportLabel: 'Wyjmij kopię listy',
    exportHint: 'Plik JSON ze wszystkim: rzeczy, rytmy, historia odhaczeń.',
    exportAction: 'Pobierz',
    emptyArchiveLabel: 'Opróżnij schowek',
    emptyArchiveHint: 'Skasuje schowane rzeczy. Aktywnych nie rusza.',
    emptyArchiveAction: 'Opróżnij',
    trimLabel: 'Historia odhaczeń',
    trimHint: 'Trzymamy ją od zawsze. Możesz przyciąć do ostatniego roku.',
    trimAction: 'Przytnij',
    dangerTitle: 'Zamknąć dom?',
    dangerBody:
      'Znikną wszystkie rzeczy, historia i dostępy — także dla pozostałych domowników. Tego się nie da cofnąć, a my nie trzymamy kopii.',
    dangerAction: 'Usuń dom na zawsze',
    dangerConfirm:
      'Na pewno? Znikną wszystkie rzeczy, historia i dostępy. Tego się nie da cofnąć.',
  },
  importBanner: {
    text: (n) => `W tej przeglądarce leży jeszcze stara lista (${n}). Przenieść ją do wspólnej?`,
    confirm: 'Przenieś',
    working: 'Przenoszę…',
    dismiss: 'Zostaw',
  },
}
