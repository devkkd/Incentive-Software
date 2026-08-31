'use client';

/**
 * SortableTh — a table header cell you can click to sort by.
 *
 * Point 11. Cycles through: ascending → descending → default order.
 *
 * Sorting is done by the server across the whole dataset, not by the browser
 * on the current page — sorting 20 of 500 rows would be misleading.
 *
 * Usage:
 *
 *   const [sort, setSort] = useState({ by: '', order: '' });
 *
 *   <SortableTh field="companyName" sort={sort} setSort={setSort}>
 *     Party Name
 *   </SortableTh>
 *
 *   <SortableTh field="walletBalance" sort={sort} setSort={setSort} align="right">
 *     Current Balance
 *   </SortableTh>
 *
 * Then send sort.by and sort.order to the API, and include them in the
 * useEffect dependency array so changing them refetches.
 */
export default function SortableTh({
  field,
  sort,
  setSort,
  children,
  align = 'left',
  className = 'px-6 py-4',
}) {
  const active = sort?.by === field;
  const order = active ? sort.order : null;

  const cycle = () => {
    // asc → desc → off
    if (!active) setSort({ by: field, order: 'asc' });
    else if (order === 'asc') setSort({ by: field, order: 'desc' });
    else setSort({ by: '', order: '' });
  };

  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <th className={`${className} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>
      <button
        type="button"
        onClick={cycle}
        title={
          !active
            ? `Sort by ${typeof children === 'string' ? children : field}`
            : order === 'asc'
            ? 'Sorted low to high — click for high to low'
            : 'Sorted high to low — click to clear'
        }
        className={`group inline-flex items-center gap-1.5 w-full ${justify} cursor-pointer transition-colors ${
          active ? 'text-[#2B3B8A]' : 'hover:text-gray-700'
        }`}
      >
        <span>{children}</span>

        {/* Two arrows: the active direction is solid blue, the other faded grey */}
        <span className="flex flex-col leading-none shrink-0 -space-y-2.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`w-5 h-5 transition-colors ${
              active && order === 'asc'
                ? 'text-[#2B3B8A]'
                : 'text-gray-300 group-hover:text-gray-400'
            }`}
          >
            <path d="M12 7l5 6H7l5-6z" />
          </svg>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`w-5 h-5 transition-colors ${
              active && order === 'desc'
                ? 'text-[#2B3B8A]'
                : 'text-gray-300 group-hover:text-gray-400'
            }`}
          >
            <path d="M12 17l-5-6h10l-5 6z" />
          </svg>
        </span>
      </button>
    </th>
  );
}
