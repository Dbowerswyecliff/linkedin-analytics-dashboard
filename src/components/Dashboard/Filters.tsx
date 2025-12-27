import { format } from 'date-fns'
import './filters.css'

interface Employee {
  id: string;
  name: string;
  profilePicture?: string;
}

interface FiltersProps {
  employees: Employee[]
  selectedEmployees: string[]
  onEmployeesChange: (ids: string[]) => void
  dateRange: { start: Date; end: Date }
  onDateRangeChange: (range: { start: Date; end: Date }) => void
  viewMode: 'weekly' | 'employees'
  onViewModeChange: (mode: 'weekly' | 'employees') => void
}

export default function Filters({
  employees,
  selectedEmployees,
  onEmployeesChange,
  dateRange,
  onDateRangeChange,
  viewMode,
  onViewModeChange,
}: FiltersProps) {
  const handleEmployeeToggle = (id: string) => {
    if (selectedEmployees.includes(id)) {
      onEmployeesChange(selectedEmployees.filter((e) => e !== id))
    } else {
      onEmployeesChange([...selectedEmployees, id])
    }
  }

  const handleClearEmployees = () => {
    onEmployeesChange([])
  }

  return (
    <div className="filters animate-slide-up stagger-1">
      {/* Employee filter */}
      <div className="filter-group">
        <label className="filter-label">Employees</label>
        <div className="employee-chips">
          {employees.length === 0 ? (
            <span className="no-employees">No employees connected yet</span>
          ) : (
            <>
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => handleEmployeeToggle(emp.id)}
                  className={`employee-chip ${selectedEmployees.includes(emp.id) ? 'selected' : ''}`}
                >
                  {emp.profilePicture && (
                    <img 
                      src={emp.profilePicture} 
                      alt="" 
                      className="chip-avatar"
                    />
                  )}
                  {emp.name}
                </button>
              ))}
              {selectedEmployees.length > 0 && (
                <button onClick={handleClearEmployees} className="clear-btn">
                  Clear all
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Date range filter */}
      <div className="filter-group">
        <label className="filter-label">Date Range</label>
        <div className="date-inputs">
          <input
            type="date"
            value={format(dateRange.start, 'yyyy-MM-dd')}
            onChange={(e) =>
              onDateRangeChange({
                ...dateRange,
                start: new Date(e.target.value),
              })
            }
            className="date-input"
          />
          <span className="date-separator">to</span>
          <input
            type="date"
            value={format(dateRange.end, 'yyyy-MM-dd')}
            onChange={(e) =>
              onDateRangeChange({
                ...dateRange,
                end: new Date(e.target.value),
              })
            }
            className="date-input"
          />
        </div>
      </div>

      {/* View mode toggle */}
      <div className="filter-group">
        <label className="filter-label">View</label>
        <div className="toggle-group">
          <button
            onClick={() => onViewModeChange('weekly')}
            className={`toggle-btn ${viewMode === 'weekly' ? 'active' : ''}`}
          >
            Weekly
          </button>
          <button
            onClick={() => onViewModeChange('employees')}
            className={`toggle-btn ${viewMode === 'employees' ? 'active' : ''}`}
          >
            Employees
          </button>
        </div>
      </div>
    </div>
  )
}

