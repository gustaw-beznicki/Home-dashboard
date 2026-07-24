export function KpiBar({ kpi }) {
  const { doneCount, totalDue, percent } = kpi

  return (
    <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <div className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-200">
        <span>Dzisiaj: {doneCount}/{totalDue} zrobione</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
