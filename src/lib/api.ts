import { PropertyListing, Inquiry } from "./types";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://midlex-reality.onrender.com"
).replace(/\/$/, "");

export function formatPrice(price: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(price);
}
