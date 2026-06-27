export function roundMoney(value: number): number {
  assertFiniteNumber(value);
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseMoneyInput(value: string | number): number {
  const amount =
    typeof value === "number" ? value : Number.parseFloat(value.trim());

  if (!Number.isFinite(amount)) {
    throw new Error("Enter a valid amount.");
  }

  return roundMoney(amount);
}

export function formatSgd(value: number): string {
  assertFiniteNumber(value);
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/\u00a0/g, " ");
}

function assertFiniteNumber(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error("Amount must be a finite number.");
  }
}
