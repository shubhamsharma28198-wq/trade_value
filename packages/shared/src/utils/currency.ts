import Decimal from 'decimal.js'

export function formatCurrency(amount: number | string | { toString(): string } | null | undefined, currency: string = 'USD'): string {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) {
    return `${currency} 0.00`
  }
  const decimalAmount = new Decimal(amount.toString()).toFixed(2)
  const [intPart, decPart = '00'] = decimalAmount.split('.')
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${currency} ${formattedInt}.${decPart.padEnd(2, '0').slice(0, 2)}`
}

export function parseCurrency(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal('0')
  }
  if (typeof value === 'number') {
    return new Decimal(value)
  }
  // Remove currency symbols and formatting
  const cleaned = String(value).replace(/[^0-9.-]/g, '')
  const parsed = new Decimal(cleaned)
  return !parsed.isFinite() ? new Decimal('0') : parsed
}