/**
 * Export an array of objects as a UTF-8 BOM CSV file.
 * @param {string} filename - The download filename (e.g. "report.csv")
 * @param {object[]} rows - Array of plain objects; all values are serialised to string
 * @param {string[]} headers - Column headers (Chinese labels), in the same order as the value-getter
 * @param {((row: object) => string[])} getRow - Function that maps a row object to an array of cell strings
 */
export function exportCsv(filename, rows, headers, getRow) {
  const BOM = '﻿'

  function escapeCell(value) {
    const str = value == null ? '' : String(value)
    // Wrap in quotes and escape inner quotes
    return '"' + str.replace(/"/g, '""') + '"'
  }

  const lines = []
  lines.push(headers.map(escapeCell).join(','))
  for (const row of rows) {
    lines.push(getRow(row).map(escapeCell).join(','))
  }

  const csv = BOM + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
