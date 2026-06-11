const numberFormat = new Intl.NumberFormat("en-US");

export function formatNumber(value: number) {
  return numberFormat.format(Math.round(value));
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
