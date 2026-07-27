// Polish numeral agreement: 1 / 2–4 / 5+, with the teens exception (11–14 take
// the "many" form even though they end in 2–4).
export function pluralForm(n) {
  const abs = Math.abs(n)
  if (abs === 1) return 0
  const last = abs % 10
  const lastTwo = abs % 100
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 1
  return 2
}

// plural(3, ['dzień', 'dni', 'dni']) → 'dni'
export function plural(n, forms) {
  return forms[pluralForm(n)]
}

// countWith(3, FORMS.dzien) → '3 dni'
export function countWith(n, forms) {
  return `${n} ${plural(n, forms)}`
}

export const FORMS = {
  dzien: ['dzień', 'dni', 'dni'],
  tydzien: ['tydzień', 'tygodnie', 'tygodni'],
  miesiac: ['miesiąc', 'miesiące', 'miesięcy'],
  rok: ['rok', 'lata', 'lat'],
  rzecz: ['rzecz', 'rzeczy', 'rzeczy'],
  domownik: ['domownik', 'domowników', 'domowników'],
  zalegla: ['zaległość', 'zaległości', 'zaległości'],
  raz: ['raz', 'razy', 'razy'],
  zadanie: ['zadanie', 'zadania', 'zadań'],
}

const LICZEBNIK = [
  'zero',
  'jedna',
  'dwie',
  'trzy',
  'cztery',
  'pięć',
  'sześć',
  'siedem',
  'osiem',
  'dziewięć',
  'dziesięć',
]

// "dwie rzeczy" rather than "2 rzeczy" — for sentences, not tables.
export function slownie(n, forms) {
  const word = n >= 0 && n <= 10 ? LICZEBNIK[n] : String(n)
  return `${word} ${plural(n, forms)}`
}

// Days until due → a natural phrase. days > 0 is ahead of the deadline.
export function relativeDue(days) {
  if (days === 0) return 'na dziś'
  if (days === 1) return 'jutro'
  if (days === 2) return 'pojutrze'
  if (days === 7) return 'za tydzień'
  if (days === 14) return 'za dwa tygodnie'
  if (days > 0 && days % 7 === 0) return `za ${countWith(days / 7, FORMS.tydzien)}`
  if (days > 0) return `za ${countWith(days, FORMS.dzien)}`
  const late = Math.abs(days)
  if (late === 1) return 'dzień po terminie'
  return `${countWith(late, FORMS.dzien)} po terminie`
}

const MIESIACE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
]
const DNI = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota']

// `withYear` matters for anything that can span years: a yearly rhythm's preview
// read "27 lipca · 27 lipca · 27 lipca" without it, three correct dates two years
// apart rendered identically.
export function formatDate(date, { withWeekday = false, withYear = false } = {}) {
  const d = `${date.getDate()} ${MIESIACE[date.getMonth()]}${withYear ? ` ${date.getFullYear()}` : ''}`
  return withWeekday ? `${DNI[date.getDay()]}, ${d}` : d
}

export function weekdayName(date) {
  return DNI[date.getDay()]
}

// "Anna, 20 lipca" · "Anna, wczoraj" · "nigdy"
export function formatLastDone(date, today, who) {
  if (!date) return 'nigdy'
  const diff = Math.round((today - date) / 86400000)
  const when = diff === 0 ? 'dziś' : diff === 1 ? 'wczoraj' : formatDate(date)
  return who ? `${who}, ${when}` : when
}

// The KPI is a sentence, not a progress bar: for ten-to-forty tasks split
// between two people a percentage carried no information.
export function summarySentence({ overdue, due, doneToday }) {
  if (due === 0 && overdue === 0) {
    return doneToday > 0 ? 'Na dziś nic więcej. Dom ogarnięty.' : 'Na dziś nic. Dom się sam ogarnął.'
  }

  // The verb agrees with whichever noun phrase leads the sentence.
  const verb = (due > 0 ? due : overdue) === 1 ? 'Została' : 'Zostały'

  const parts = []
  if (due > 0) parts.push(slownie(due, FORMS.rzecz))
  if (overdue > 0) parts.push(slownie(overdue, FORMS.zalegla))
  return `${verb} ${parts.join(' i ')}.`
}
