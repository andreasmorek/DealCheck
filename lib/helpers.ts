export function rateDeal(detectedPrice: number, averagePrice: number) {
  const diff = (detectedPrice - averagePrice) / averagePrice;

  if (diff <= -0.03) return "good";
  if (diff <= 0.08) return "fair";
  return "expensive";
}

export function getRatingLabel(rating: "good" | "fair" | "expensive") {
  if (rating === "good") return "Guter Deal";
  if (rating === "fair") return "Fairer Preis";
  return "Zu teuer";
}

export function getSavingsPotential(
  detectedPrice: number,
  lowestPrice: number
) {
  return Math.max(0, detectedPrice - lowestPrice);
}