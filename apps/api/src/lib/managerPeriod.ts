const dhakaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dhakaDate(value: Date): string {
  const parts = dhakaDateFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Could not resolve manager assignment date');
  return `${year}-${month}-${day}`;
}

export function isManagerAssignmentInPeriod(
  startDate: Date,
  endDate: Date,
  at: Date = new Date(),
): boolean {
  const today = dhakaDate(at);
  return dhakaDate(startDate) <= today && dhakaDate(endDate) >= today;
}
