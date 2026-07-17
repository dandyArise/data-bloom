import { useMemo, useState } from 'react';
import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { asNumber, EmptyWidgetState } from '../shared';

export function TableWidget({ data, config }: WidgetProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortState, setSortState] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = Math.max(1, Math.min(config.limit ?? 6, 50));
  const processedRows = useMemo(() => {
    const fieldTypes = new Map(data.fields.map((field) => [field.name, field.type]));
    const activeFilters = Object.entries(filters)
      .map(([field, value]) => [field, value.trim(), fieldTypes.get(field)] as const)
      .filter(([field, value]) => fieldTypes.has(field) && value.length > 0);
    const filteredRows = data.rows.filter((row) =>
      activeFilters.every(([field, value, type]) => matchesFilter(row[field], value, type)),
    );
    if (!sortState || !fieldTypes.has(sortState.field)) return filteredRows;
    return [...filteredRows].sort((left, right) => compareValues(left[sortState.field], right[sortState.field], sortState.direction));
  }, [data.fields, data.rows, filters, sortState]);
  if (data.fields.length === 0) return <EmptyWidgetState message="Aucune colonne n’est disponible pour ce tableau." />;
  const hasFilters = data.fields.some((field) => (filters[field.name] ?? '').trim().length > 0);
  const activeFilterCount = data.fields.filter((field) => (filters[field.name] ?? '').trim().length > 0).length;
  const pageCount = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const firstRowIndex = safePageIndex * pageSize;
  const occurrences = new Map<string, number>();
  const rows = processedRows.slice(firstRowIndex, firstRowIndex + pageSize).map((row) => {
    const fingerprint = JSON.stringify(data.fields.map((field) => [field.name, row[field.name] ?? null]));
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
    occurrences.set(fingerprint, occurrence);
    return { key: `${fingerprint}-${occurrence}`, row };
  });
  const toggleSort = (field: string) => {
    setPageIndex(0);
    setSortState((current) =>
      current?.field !== field
        ? { field, direction: 'asc' }
        : current.direction === 'asc'
          ? { field, direction: 'desc' }
          : null,
    );
  };
  return (
    <div className="mini-table-widget">
      <div className="mini-table-toolbar">
        <span>{hasFilters ? `${activeFilterCount} filtre${activeFilterCount > 1 ? 's' : ''} actif${activeFilterCount > 1 ? 's' : ''}` : `${data.fields.length} colonne${data.fields.length > 1 ? 's' : ''}`}</span>
        <button
          className={showFilters || hasFilters ? 'mini-table-options active' : 'mini-table-options'}
          type="button"
          aria-label={showFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
          aria-expanded={showFilters}
          onClick={() => setShowFilters((current) => !current)}
        >
          <span aria-hidden="true">…</span>
          {activeFilterCount > 0 && <small>{activeFilterCount}</small>}
        </button>
      </div>
      <div className="mini-table-scroll">
        <table className="mini-table">
          <thead>
            <tr>{data.fields.map((field) => (
              <th key={field.name} aria-sort={sortState?.field === field.name ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button className="mini-table-sort" type="button" aria-label={`Trier ${field.name}`} onClick={() => toggleSort(field.name)}>
                  <span>{field.name}</span><em>{sortState?.field === field.name ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕'}</em>
                </button>
              </th>
            ))}</tr>
            {showFilters && <tr className="mini-table-filter-row">{data.fields.map((field) => (
              <th key={field.name}>
                <input
                  aria-label={`Filtrer ${field.name}`}
                  value={filters[field.name] ?? ''}
                  placeholder={field.type === 'number' ? 'Ex. > 999' : 'Filtrer...'}
                  onChange={(event) => { setFilters((current) => ({ ...current, [field.name]: event.target.value })); setPageIndex(0); }}
                />
              </th>
            ))}</tr>}
          </thead>
          <tbody>{rows.length === 0
            ? <tr><td className="mini-table-empty" colSpan={data.fields.length}>Aucune ligne ne correspond aux filtres.</td></tr>
            : rows.map(({ key, row }) => <tr key={key}>{data.fields.map((field) => <td key={field.name}>{String(row[field.name] ?? '—')}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {(pageCount > 1 || hasFilters) && (
        <nav className="table-pagination" aria-label="Pagination du tableau">
          <span>{processedRows.length === 0 ? '0 sur 0' : `${firstRowIndex + 1}–${Math.min(firstRowIndex + pageSize, processedRows.length)} sur ${processedRows.length}`}</span>
          <div>
            <button type="button" aria-label="Page précédente" onClick={() => setPageIndex((current) => Math.max(0, current - 1))} disabled={safePageIndex === 0}>‹</button>
            <strong>{safePageIndex + 1} / {pageCount}</strong>
            <button type="button" aria-label="Page suivante" onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))} disabled={safePageIndex >= pageCount - 1}>›</button>
          </div>
        </nav>
      )}
    </div>
  );
}

function compareValues(left: unknown, right: unknown, direction: 'asc' | 'desc') {
  const multiplier = direction === 'asc' ? 1 : -1;
  const leftNumber = typeof left === 'number' ? left : Number(left);
  const rightNumber = typeof right === 'number' ? right : Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return (leftNumber - rightNumber) * multiplier;
  return String(left ?? '').localeCompare(String(right ?? ''), 'fr', { numeric: true, sensitivity: 'base' }) * multiplier;
}

function matchesFilter(value: unknown, query: string, type: 'string' | 'number' | 'date' | undefined) {
  const range = query.match(/^(.+?)\s*\.\.\s*(.+)$/);
  if (range) {
    const current = asNumber(value);
    const minimum = asNumber(range[1]);
    const maximum = asNumber(range[2]);
    return current !== null && minimum !== null && maximum !== null && current >= Math.min(minimum, maximum) && current <= Math.max(minimum, maximum);
  }

  const comparison = query.match(/^(>=|<=|!=|>|<|=)\s*(.+)$/);
  if (comparison) {
    const [, operator, operand] = comparison;
    const current = asNumber(value);
    const expected = asNumber(operand);
    if (current !== null && expected !== null) {
      if (operator === '>') return current > expected;
      if (operator === '>=') return current >= expected;
      if (operator === '<') return current < expected;
      if (operator === '<=') return current <= expected;
      if (operator === '=') return current === expected;
      return current !== expected;
    }
    if (operator === '=' || operator === '!=') {
      const equal = String(value ?? '').trim().localeCompare(operand.trim(), 'fr', { sensitivity: 'base' }) === 0;
      return operator === '=' ? equal : !equal;
    }
    return false;
  }

  const normalizedValue = String(value ?? '').toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  if (type === 'number') {
    const current = asNumber(value);
    const expected = asNumber(query);
    if (current !== null && expected !== null) return current === expected;
  }
  return normalizedValue.includes(normalizedQuery);
}

registerWidget('table', { render: (data, config) => <TableWidget data={data} config={config} />, defaultSize: 'lg' });
