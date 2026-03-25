export type AnalyzedProduct = {
  title: string;
  brand?: string;
  model?: string;
  category?: string;
  detectedPrice: number;
  currency: string;
};

export type PriceComparison = {
  lowestPrice: number;
  averagePrice: number;
  highestPrice: number;
  rating: "good" | "fair" | "expensive";
  savingsPotential: number;
  sourceCount: number;
};