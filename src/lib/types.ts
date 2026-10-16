export type PropertyOfferType = "SALE" | "RENT" | "LEASE";

export type PropertyListing = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  location: string;
  category: string;
  offerTypes: PropertyOfferType[];
  bedrooms: number;
  bathrooms: number;
  sizeSqm?: number | null;
  images: string[];
  videoUrl?: string | null;
  videos?: string[];
  features: string[];
  status: string;
  featured: boolean;
  createdAt?: string;
};

export type PropertyForm = Omit<PropertyListing, "id" | "createdAt">;

export type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  serviceNeeded?: string;
  message: string;
  status: string;
  createdAt: string;
};

export type AdminAccount = {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: "SUPER_ADMIN" | "ADMIN";
  createdAt: string;
};

