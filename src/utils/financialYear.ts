/**
 * Utility functions for Indian Financial Year calculations (1 April to 31 March)
 */

export interface FinancialYearInfo {
  fyKey: string;         // e.g. "2026-27"
  fyLabel: string;       // e.g. "FY 2026-27"
  startYear: number;     // e.g. 2026
  endYear: number;       // e.g. 2027
  startDateStr: string;  // e.g. "2026-04-01"
  endDateStr: string;    // e.g. "2027-03-31"
}

/**
 * Returns Indian Financial Year info for a given date string (YYYY-MM-DD) or Date object.
 * Financial Year runs from 1 April to 31 March.
 */
export function getFinancialYear(dateInput: string | Date = new Date()): FinancialYearInfo {
  let dateObj: Date;

  if (typeof dateInput === "string") {
    const parts = dateInput.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10); // 1-12
      const day = parseInt(parts[2], 10);
      dateObj = new Date(year, month - 1, day);
    } else {
      dateObj = new Date(dateInput);
    }
  } else {
    dateObj = dateInput;
  }

  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // 1 to 12

  let startYear: number;
  let endYear: number;

  if (month >= 4) {
    // April (4) to December (12)
    startYear = year;
    endYear = year + 1;
  } else {
    // January (1) to March (3)
    startYear = year - 1;
    endYear = year;
  }

  const endYearShort = String(endYear).slice(-2);
  const fyKey = `${startYear}-${endYearShort}`;
  const fyLabel = `FY ${fyKey}`;
  const startDateStr = `${startYear}-04-01`;
  const endDateStr = `${endYear}-03-31`;

  return {
    fyKey,
    fyLabel,
    startYear,
    endYear,
    startDateStr,
    endDateStr
  };
}
