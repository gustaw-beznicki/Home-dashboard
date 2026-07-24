import { TABS } from '../lib/constants'

export function TabBar({ activeTab, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800 sm:grid-cols-4">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-md px-2 py-2 text-center text-sm font-medium leading-tight transition-colors ${
            activeTab === tab.key
              ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
