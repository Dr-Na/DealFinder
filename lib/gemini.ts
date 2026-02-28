import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

export const getGeminiClient = () => {
  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_GEMINI_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

export const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    productName: { type: Type.STRING },
    imageUrl: { type: Type.STRING },
    purchaseUrl: { type: Type.STRING },
    priceDetails: {
      type: Type.OBJECT,
      properties: {
        originalPrice: { type: Type.STRING },
        shopVoucher: { type: Type.STRING, description: "Applied or not" },
        platformVoucher: { type: Type.STRING },
        paymentVoucher: { type: Type.STRING },
        shippingFee: { type: Type.STRING },
        finalPrice: { type: Type.STRING },
      },
      required: ["originalPrice", "finalPrice"],
    },
    reputation: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER, description: "1-10" },
        status: { type: Type.STRING, description: "Mall / Regular" },
        reason: { type: Type.STRING },
      },
      required: ["score", "status"],
    },
    reviews: {
      type: Type.OBJECT,
      properties: {
        pros: { type: Type.ARRAY, items: { type: Type.STRING } },
        cons: { type: Type.ARRAY, items: { type: Type.STRING } },
        majorConcern: { type: Type.STRING, description: "If complaints > 15%" },
      },
      required: ["pros", "cons"],
    },
    riskLevel: { type: Type.STRING, description: "Thấp / Trung bình / Cao" },
    conclusion: { type: Type.STRING, description: "Nên mua / Bỏ qua + lý do" },
  },
  required: ["productName", "priceDetails", "reputation", "reviews", "riskLevel", "conclusion"],
};

export const SEARCH_RESULTS_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      title: { type: Type.STRING },
      price: { type: Type.STRING },
      platform: { type: Type.STRING },
      imageUrl: { type: Type.STRING },
      discount: { type: Type.STRING },
      url: { type: Type.STRING },
    },
    required: ["title", "price", "platform", "imageUrl", "url"],
  },
};
