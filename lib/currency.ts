export const APP_CURRENCY_CODE = "MAD";
export const APP_CURRENCY_LABEL = "DHs";

export function formatMoney(amount: number) {
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  return `${formatted} ${APP_CURRENCY_LABEL}`;
}
