"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  Camera,
  Check,
  Edit3,
  ExternalLink,
  HelpCircle,
  Info,
  Eye,
  EyeOff,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Link2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { API_URL, formatPrice } from "@/lib/api";
import { PropertyListing, Inquiry } from "@/lib/types";
import PropertyVideoPlayer from "@/components/PropertyVideoPlayer";

const MARKETPLACE_URL =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "https://midlex-reality.vercel.app";

const emptyForm = {
  title: "",
  slug: "",
  description: "",
  price: "",
  location: "",
  category: "RESIDENTIAL",
  offerTypes: ["SALE"] as string[],
  bedrooms: "0",
  bathrooms: "0",
  sizeSqm: "",
  images: [] as string[],
  videoUrl: "",
  features: "",
  status: "AVAILABLE",
  featured: false,
};

// Helper to clean and convert pasted image links to direct image URLs
function cleanImageUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if (!url) return "";

  // Imgur page link -> direct image (e.g., https://imgur.com/abc -> https://i.imgur.com/abc.jpg)
  const imgurMatch = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)$/);
  if (imgurMatch && imgurMatch[1]) {
    return `https://i.imgur.com/${imgurMatch[1]}.jpg`;
  }

  // Google Drive share link -> direct view
  const gdriveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gdriveMatch && gdriveMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${gdriveMatch[1]}`;
  }

  // Dropbox share link -> raw image link
  if (url.includes("dropbox.com")) {
    return url.replace("?dl=0", "?raw=1").replace("&dl=0", "&raw=1");
  }

  return url;
}

// Client-side canvas compression for uploaded device images
function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (file.type === "image/svg+xml" || file.size < 400 * 1024) {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.onload = () => {
        const MAX_DIMENSION = 1600;
        let { width, height } = img;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } else {
          resolve((e.target?.result as string) || "");
        }
      };
      img.onerror = () => resolve((e.target?.result as string) || "");
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

export default function RealtyAdminPortal() {
  const [token, setToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<any>(null);

  // Login state
  const [loginForm, setLoginForm] = useState({
    email: "midlexllp01@gmail.com",
    password: "",
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Portal State
  const [activeTab, setActiveTab] = useState<"properties" | "inquiries">(
    "properties",
  );
  const [properties, setProperties] = useState<PropertyListing[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Media Manager state
  const [mediaTab, setMediaTab] = useState<"link" | "upload">("link");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [guideTab, setGuideTab] = useState<"images" | "videos">("images");

  // Check auth on load
  useEffect(() => {
    const savedToken = localStorage.getItem("midlex_realty_admin_token");
    const savedUser = localStorage.getItem("midlex_realty_admin_user");
    if (savedToken) {
      // Must be a valid JWT (3 parts separated by dots)
      if (!savedToken.includes(".") || savedToken.split(".").length !== 3) {
        localStorage.removeItem("midlex_realty_admin_token");
        localStorage.removeItem("midlex_realty_admin_user");
        setToken(null);
        setAdminUser(null);
        setLoading(false);
        return;
      }
      setToken(savedToken);
      if (savedUser) {
        try {
          setAdminUser(JSON.parse(savedUser));
        } catch {}
      }
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch properties and inquiries
  const loadData = useCallback(async () => {
    const currentToken =
      token || localStorage.getItem("midlex_realty_admin_token");
    if (!currentToken) return;

    setLoading(true);
    try {
      const propRes = await fetch(`${API_URL}/realty/properties`, {
        cache: "no-store",
      });
      if (propRes.ok) {
        const propData = await propRes.json();
        setProperties(Array.isArray(propData) ? propData : []);
      }

      // Fetch inquiries (admin only)
      const inqRes = await fetch(`${API_URL}/realty/inquiries/all`, {
        headers: { Authorization: `Bearer ${currentToken}` },
        cache: "no-store",
      });
      if (inqRes.ok) {
        const inqData = await inqRes.json();
        setInquiries(Array.isArray(inqData) ? inqData : []);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, loadData]);

  // Handle Login
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginForm.email.trim(),
          password: loginForm.password.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Invalid administrator credentials");
      }

      if (!data || !data.access_token) {
        throw new Error("Login failed: missing access token from server");
      }

      if (data.user?.role !== "ADMIN") {
        throw new Error("This portal is restricted to Midlex administrators");
      }

      localStorage.setItem("midlex_realty_admin_token", data.access_token);
      localStorage.setItem("midlex_realty_admin_user", JSON.stringify(data.user));
      setToken(data.access_token);
      setAdminUser(data.user);
    } catch (err) {
      console.error("Login error:", err);
      setLoginError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("midlex_realty_admin_token");
    localStorage.removeItem("midlex_realty_admin_user");
    setToken(null);
    setAdminUser(null);
    setProperties([]);
    setInquiries([]);
  };

  // Filter properties
  const filtered = useMemo(() => {
    return properties.filter((item) =>
      `${item.title} ${item.location} ${item.category} ${(item.offerTypes || ["SALE"]).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  }, [properties, query]);

  // Modal actions
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setNewImageUrl("");
    setNewVideoUrl("");
    setBulkText("");
    setUploadNotice("");
    setFormError("");
    setModal(true);
  };

  const openEdit = (property: PropertyListing) => {
    setEditingId(property.id);
    setForm({
      title: property.title,
      slug: property.slug,
      description: property.description,
      price: String(property.price),
      location: property.location,
      category: property.category,
      offerTypes: property.offerTypes?.length ? property.offerTypes : ["SALE"],
      bedrooms: String(property.bedrooms),
      bathrooms: String(property.bathrooms),
      sizeSqm: String(property.sizeSqm || ""),
      images: Array.isArray(property.images) ? [...property.images] : [],
      videoUrl: property.videoUrl || "",
      features: property.features.join("\n"),
      status: property.status,
      featured: property.featured,
    });
    setNewImageUrl("");
    setNewVideoUrl(property.videoUrl || "");
    setBulkText("");
    setUploadNotice("");
    setFormError("");
    setModal(true);
  };

  const toggleOfferType = (type: string) => {
    setForm((curr) => ({
      ...curr,
      offerTypes: curr.offerTypes.includes(type)
        ? curr.offerTypes.filter((t) => t !== type)
        : [...curr.offerTypes, type],
    }));
  };

  // Media helper methods
  const handleAddImageUrl = () => {
    const cleaned = cleanImageUrl(newImageUrl);
    if (!cleaned) return;
    setForm((curr) => ({
      ...curr,
      images: [...curr.images, cleaned],
    }));
    setNewImageUrl("");
    setUploadNotice("Image link added");
    setTimeout(() => setUploadNotice(""), 3000);
  };

  const handleSetVideoUrl = () => {
    const trimmed = newVideoUrl.trim();
    setForm((curr) => ({
      ...curr,
      videoUrl: trimmed,
    }));
    setUploadNotice("Video tour link updated");
    setTimeout(() => setUploadNotice(""), 3000);
  };

  const handleBulkAddImages = () => {
    const urls = bulkText
      .split(/\r?\n|,/)
      .map((item) => cleanImageUrl(item))
      .filter(Boolean);
    if (!urls.length) return;
    setForm((curr) => ({
      ...curr,
      images: Array.from(new Set([...curr.images, ...urls])),
    }));
    setBulkText("");
    setBulkOpen(false);
    setUploadNotice(`${urls.length} images added`);
    setTimeout(() => setUploadNotice(""), 3000);
  };

  const handleDirectImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;

    setUploadNotice("Optimizing and processing images...");
    const compressedImages: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImageFile(file);
        if (compressed) {
          compressedImages.push(compressed);
        }
      } catch (err) {
        console.error("Image processing error:", err);
      }
    }

    if (compressedImages.length > 0) {
      setForm((curr) => ({
        ...curr,
        images: [...curr.images, ...compressedImages],
      }));
      setUploadNotice(`${compressedImages.length} image(s) uploaded successfully!`);
    } else {
      setUploadNotice("Could not process selected image files.");
    }
    e.target.value = "";
    setTimeout(() => setUploadNotice(""), 3500);
  };

  const handleDirectVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setForm((curr) => ({
          ...curr,
          videoUrl: result,
        }));
        setUploadNotice("Video uploaded directly");
        setTimeout(() => setUploadNotice(""), 3000);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setForm((curr) => ({
      ...curr,
      images: curr.images.filter((_, idx) => idx !== index),
    }));
  };

  const handleSetCoverImage = (index: number) => {
    setForm((curr) => {
      const selected = curr.images[index];
      const others = curr.images.filter((_, idx) => idx !== index);
      return {
        ...curr,
        images: [selected, ...others],
      };
    });
    setUploadNotice("Cover photo updated");
    setTimeout(() => setUploadNotice(""), 3000);
  };

  const handleRemoveVideo = () => {
    setForm((curr) => ({
      ...curr,
      videoUrl: "",
    }));
    setNewVideoUrl("");
    setUploadNotice("Video tour removed");
    setTimeout(() => setUploadNotice(""), 3000);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return handleLogout();

    // Auto-include any pending image link typed into the input
    let currentImages = [...form.images];
    const pendingUrl = cleanImageUrl(newImageUrl);
    if (pendingUrl && !currentImages.includes(pendingUrl)) {
      currentImages.push(pendingUrl);
      setNewImageUrl("");
    }

    if (!currentImages.length) {
      setFormError("Please add at least one property image (via link or upload).");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const response = await fetch(
        `${API_URL}/realty/properties${editingId ? `/${editingId}` : ""}`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...form,
            price: Number(form.price),
            bedrooms: Number(form.bedrooms),
            bathrooms: Number(form.bathrooms),
            sizeSqm: form.sizeSqm ? Number(form.sizeSqm) : null,
            images: currentImages.filter(Boolean),
            videoUrl: form.videoUrl?.trim() || null,
            features: form.features
              .split(/\r?\n|,/)
              .map((item) => item.trim())
              .filter(Boolean),
          }),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your session has expired or is invalid. Please sign out and sign back in.");
        }
        throw new Error(
          Array.isArray(data?.message)
            ? data.message.join(", ")
            : data?.message || `Server returned error (${response.status})`
        );
      }

      setModal(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save listing");
    } finally {
      setSaving(false);
    }
  };

  const removeProperty = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this listing?"))
      return;
    try {
      const res = await fetch(`${API_URL}/realty/properties/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProperties((curr) => curr.filter((item) => item.id !== id));
      } else {
        alert("Could not delete property listing.");
      }
    } catch {
      alert("Network error deleting property.");
    }
  };

  // ----------------------------------------------------
  // VIEW: LOGIN SCREEN (When unauthenticated)
  // ----------------------------------------------------
  if (!token) {
    return (
      <main className="grid min-h-screen bg-[#fffdf7] lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-[#073d22] lg:block">
          <img
            src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=88"
            alt="Midlex Realty Portal"
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#042d1a] via-[#073d22]/90 to-transparent" />
          <div className="relative flex h-full flex-col justify-between p-14 text-white">
            <div className="flex items-center gap-3">
              <Image
                src="/midlex-logo.png"
                alt="Midlex"
                width={190}
                height={70}
                className="h-16 w-auto rounded-xl bg-white object-contain p-2 shadow-md"
              />
              <span className="rounded-lg bg-[#ddb849] px-3 py-1 text-xs font-black text-[#073d22]">
                ADMIN
              </span>
            </div>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ddb849]/40 bg-[#ddb849]/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#ddb849]">
                <ShieldCheck size={16} /> Dedicated Administration Portal
              </span>
              <h1 className="mt-6 max-w-lg text-5xl font-black leading-tight">
                Manage the Midlex property marketplace.
              </h1>
              <p className="mt-5 max-w-lg leading-7 text-emerald-100/70">
                Publish listings, upload image galleries and video tours, update prices, and receive customer inspection enquiries.
              </p>
            </div>
            <p className="text-xs text-emerald-100/45">
              midlex-reality-admin.vercel.app · Midlex Security
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between">
              <Image
                src="/midlex-logo.png"
                alt="Midlex"
                width={170}
                height={60}
                className="h-14 w-auto object-contain"
              />
              <a
                href={MARKETPLACE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#073d22]"
              >
                Public Site <ExternalLink size={14} />
              </a>
            </div>

            <p className="text-xs font-black uppercase tracking-[.2em] text-[#a87835]">
              Realty Control Center
            </p>
            <h2 className="mt-2 text-3xl font-black text-[#073d22]">
              Administrator Sign In
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Access is strictly restricted to authorized Midlex administrative staff.
            </p>

            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-[#073d22]">
                <Mail size={18} className="text-[#a87835]" />
                <input
                  required
                  type="email"
                  placeholder="Admin email"
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, email: e.target.value })
                  }
                  className="w-full border-0 py-4 text-sm outline-none"
                />
              </label>
              <div className="relative flex items-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-[#073d22]">
                <LockKeyhole size={18} className="text-[#a87835] shrink-0" />
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  className="w-full border-0 py-4 pr-10 pl-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 p-1.5 text-slate-400 hover:text-[#073d22] transition rounded-lg hover:bg-slate-50"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {loginError && (
                <p className="rounded-xl bg-red-50 p-4 text-xs font-bold text-red-700">
                  {loginError}
                </p>
              )}

              <button
                disabled={loginLoading}
                className="w-full rounded-xl bg-[#073d22] p-4 text-sm font-black text-white shadow-lg hover:bg-[#094e2b] disabled:opacity-50 transition"
              >
                {loginLoading ? "Verifying..." : "Sign in to Realty Admin"}
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------
  // VIEW: DASHBOARD (When authenticated)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#fffdf7]">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <Image
              src="/midlex-logo.png"
              alt="Midlex Realty"
              width={140}
              height={50}
              className="h-10 w-auto object-contain"
            />
            <div className="border-l border-emerald-900/15 pl-3">
              <span className="rounded bg-[#ddb849] px-2 py-0.5 text-[10px] font-black uppercase text-[#073d22]">
                Admin Portal
              </span>
              <p className="text-xs font-black text-[#073d22]">
                midlex-reality-admin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={MARKETPLACE_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-emerald-950/15 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Live Marketplace <ExternalLink size={13} />
            </a>
            <button
              onClick={() => setGuideModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs font-black text-amber-900 hover:bg-amber-100 transition shadow-xs"
              title="Instructions for uploading photos and videos"
            >
              <BookOpen size={14} className="text-[#a87835]" /> Media Guide
            </button>
            <button
              onClick={loadData}
              className="rounded-xl border border-emerald-950/15 p-2.5 text-slate-700 hover:bg-slate-50 transition"
              title="Refresh Catalogue"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 hover:bg-red-100 transition"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* MAIN BODY */}
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {/* TOP STATS & TABS */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("properties")}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition ${
                activeTab === "properties"
                  ? "bg-[#073d22] text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Building2 size={16} /> Properties ({properties.length})
            </button>
            <button
              onClick={() => setActiveTab("inquiries")}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition ${
                activeTab === "inquiries"
                  ? "bg-[#073d22] text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <MessageSquare size={16} /> Customer Inquiries ({inquiries.length})
            </button>
          </div>

          {activeTab === "properties" && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-xl bg-[#a87835] px-6 py-3 text-sm font-black text-white shadow-md hover:bg-[#8f6429] transition"
            >
              <Plus size={18} /> Post New Property
            </button>
          )}
        </div>

        {/* TAB 1: PROPERTIES */}
        {activeTab === "properties" && (
          <div className="mt-6">
            {/* Search */}
            <div className="flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Search size={18} className="text-slate-400" />
              <input
                placeholder="Search properties by title, location, type..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full text-sm outline-none"
              />
            </div>

            {loading ? (
              <div className="mt-8 py-20 text-center text-slate-400">
                Loading properties catalogue...
              </div>
            ) : filtered.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center">
                <Building2 className="mx-auto text-slate-300 mb-3" size={48} />
                <h3 className="text-lg font-black text-[#073d22]">
                  No properties found
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {query
                    ? "Try a different search query"
                    : "Post your first property listing to get started."}
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left">
                    <thead className="bg-[#073d22] text-white">
                      <tr>
                        <th className="p-4 text-xs font-black uppercase">Property</th>
                        <th className="p-4 text-xs font-black uppercase">Price</th>
                        <th className="p-4 text-xs font-black uppercase">Type</th>
                        <th className="p-4 text-xs font-black uppercase">Media</th>
                        <th className="p-4 text-xs font-black uppercase">Status</th>
                        <th className="p-4 text-xs font-black uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  item.images?.[0] ||
                                  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80"
                                }
                                alt={item.title}
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (!target.dataset.fallback) {
                                    target.dataset.fallback = "true";
                                    target.src =
                                      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80";
                                  }
                                }}
                                className="h-14 w-20 rounded-xl object-cover border border-slate-200"
                              />
                              <div>
                                <p className="font-black text-[#073d22]">
                                  {item.title}
                                </p>
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                  <MapPin size={12} className="text-[#a87835]" />{" "}
                                  {item.location}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm font-black text-[#073d22]">
                            {formatPrice(item.price)}
                          </td>
                          <td className="p-4 text-xs font-bold text-slate-700">
                            {item.category}
                            <p className="mt-0.5 text-[10px] font-black text-[#a87835]">
                              {(item.offerTypes || ["SALE"]).join(" · ")}
                            </p>
                          </td>
                          <td className="p-4 text-xs font-bold text-slate-600">
                            <span>{item.images.length} Photos</span>
                            {item.videoUrl && (
                              <p className="mt-1 flex items-center gap-1 text-[10px] font-black text-[#073d22]">
                                <Video size={12} className="text-[#ddb849]" /> Video Tour
                              </p>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-800">
                              {item.status}
                            </span>
                            {item.featured && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-black text-[#a87835]">
                                <Star size={11} fill="currentColor" /> Featured
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-1.5">
                              <a
                                href={`${MARKETPLACE_URL}/properties/${item.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                                title="View on live marketplace"
                              >
                                <Eye size={16} />
                              </a>
                              <button
                                onClick={() => openEdit(item)}
                                className="rounded-lg bg-amber-50 p-2 text-[#a87835] hover:bg-amber-100"
                                title="Edit listing"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => removeProperty(item.id)}
                                className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"
                                title="Delete listing"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INQUIRIES */}
        {activeTab === "inquiries" && (
          <div className="mt-6">
            {inquiries.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center">
                <MessageSquare className="mx-auto text-slate-300 mb-3" size={48} />
                <h3 className="text-lg font-black text-[#073d22]">
                  No inquiries yet
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Client inspection requests submitted through the marketplace will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {inquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-800">
                          {inq.status}
                        </span>
                        <h4 className="mt-2 text-lg font-black text-[#073d22]">
                          {inq.name}
                        </h4>
                        <div className="mt-1 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
                          <span>📧 {inq.email}</span>
                          {inq.phone && <span>📞 {inq.phone}</span>}
                          <span>
                            🗓️ {new Date(inq.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-black uppercase text-[#a87835]">
                        {inq.serviceNeeded}
                      </span>
                    </div>
                    <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-700 whitespace-pre-wrap font-sans">
                      {inq.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ADD / EDIT PROPERTY MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 max-w-3xl rounded-[30px] bg-white p-7 sm:p-9 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#a87835]">
                  Realty Listing Editor
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#073d22]">
                  {editingId ? "Edit Property Listing" : "Add New Property"}
                </h2>
              </div>
              <button
                onClick={() => setModal(false)}
                className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={save} className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                required
                placeholder="Property title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-xl border border-slate-200 p-4 text-sm sm:col-span-2 focus:border-[#073d22] outline-none"
              />
              <input
                placeholder="URL slug (optional)"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="rounded-xl border border-slate-200 p-4 text-sm focus:border-[#073d22] outline-none"
              />
              <input
                required
                placeholder="Location (e.g. Lekki Phase 1, Lagos)"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="rounded-xl border border-slate-200 p-4 text-sm focus:border-[#073d22] outline-none"
              />
              <input
                required
                type="number"
                placeholder="Price in NGN"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="rounded-xl border border-slate-200 p-4 text-sm focus:border-[#073d22] outline-none"
              />

              {/* Purpose checkboxes */}
              <fieldset className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
                <legend className="px-2 text-xs font-black uppercase tracking-wider text-[#073d22]">
                  Listing Purpose (select all that apply)
                </legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {[
                    ["SALE", "For sale / buying"],
                    ["RENT", "For rent"],
                    ["LEASE", "For lease"],
                  ].map(([val, label]) => (
                    <label
                      key={val}
                      className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.offerTypes.includes(val)}
                        onChange={() => toggleOfferType(val)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="rounded-xl border border-slate-200 p-4 text-sm font-bold outline-none"
              >
                <option>RESIDENTIAL</option>
                <option>LUXURY</option>
                <option>LAND</option>
                <option>COMMERCIAL</option>
              </select>

              <input
                type="number"
                placeholder="Bedrooms"
                value={form.bedrooms}
                onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                className="rounded-xl border border-slate-200 p-4 text-sm outline-none"
              />
              <input
                type="number"
                placeholder="Bathrooms"
                value={form.bathrooms}
                onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
                className="rounded-xl border border-slate-200 p-4 text-sm outline-none"
              />
              <input
                type="number"
                placeholder="Size in sqm"
                value={form.sizeSqm}
                onChange={(e) => setForm({ ...form, sizeSqm: e.target.value })}
                className="rounded-xl border border-slate-200 p-4 text-sm outline-none"
              />

              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="rounded-xl border border-slate-200 p-4 text-sm font-bold outline-none"
              >
                <option>AVAILABLE</option>
                <option>RESERVED</option>
                <option>SOLD</option>
                <option>OFF_MARKET</option>
              </select>

              <textarea
                required
                rows={3}
                placeholder="Property description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="rounded-xl border border-slate-200 p-4 text-sm sm:col-span-2 outline-none"
              />

              {/* MEDIA STUDIO */}
              <div className="rounded-2xl border border-emerald-950/15 bg-emerald-950/[0.02] p-5 sm:col-span-2 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[#073d22] flex items-center gap-2">
                      <Camera size={18} className="text-[#a87835]" /> Property Media (Photos & Video)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Upload via web links or upload directly from your device.
                    </p>
                  </div>
                  <div className="flex rounded-xl bg-slate-200/70 p-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setMediaTab("link")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                        mediaTab === "link"
                          ? "bg-white text-[#073d22] shadow-sm font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Link2 size={13} /> Link / URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaTab("upload")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                        mediaTab === "upload"
                          ? "bg-white text-[#073d22] shadow-sm font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Upload size={13} /> Direct Upload
                    </button>
                  </div>
                </div>

                {uploadNotice && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
                    <Check size={14} /> {uploadNotice}
                  </div>
                )}

                {mediaTab === "link" ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50/90 border border-amber-200/80 p-2.5 text-xs text-amber-950">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Info size={14} className="text-[#a87835] shrink-0" />
                        <span>Where to get direct image & video links?</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGuideModalOpen(true)}
                        className="font-black text-[#073d22] underline hover:text-[#a87835] transition"
                      >
                        Open Media Guide & Sites ↗
                      </button>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Add Image Link
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="Paste image URL (e.g. Unsplash, CDN)"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          className="flex-1 rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddImageUrl}
                          className="rounded-xl bg-[#073d22] px-4 py-3 text-xs font-black text-white hover:bg-[#094e2b]"
                        >
                          <Plus size={15} /> Add
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Add Video Tour Link (YouTube, Vimeo, MP4)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="Paste YouTube or video URL"
                          value={newVideoUrl}
                          onChange={(e) => setNewVideoUrl(e.target.value)}
                          className="flex-1 rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSetVideoUrl}
                          className="rounded-xl bg-[#a87835] px-4 py-3 text-xs font-black text-white hover:bg-[#8f6429]"
                        >
                          <Video size={15} /> Set Video
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBulkOpen(!bulkOpen)}
                      className="text-xs font-bold text-[#073d22] hover:underline"
                    >
                      {bulkOpen ? "▲ Close bulk image importer" : "▼ Bulk import multiple image URLs"}
                    </button>
                    {bulkOpen && (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          placeholder="Paste multiple URLs (one per line)"
                          value={bulkText}
                          onChange={(e) => setBulkText(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleBulkAddImages}
                          className="rounded-xl bg-[#073d22] px-4 py-2 text-xs font-black text-white"
                        >
                          Import Links
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-900/20 bg-white p-6 text-center cursor-pointer hover:border-[#073d22] transition">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleDirectImageUpload}
                        className="hidden"
                      />
                      <ImageIcon size={22} className="text-[#073d22]" />
                      <p className="mt-2 text-xs font-black text-[#073d22]">
                        Choose Images from Device
                      </p>
                      <p className="text-[10px] text-slate-500">
                        PNG, JPG, WebP
                      </p>
                    </label>

                    <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#a87835]/30 bg-white p-6 text-center cursor-pointer hover:border-[#a87835] transition">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleDirectVideoUpload}
                        className="hidden"
                      />
                      <FileVideo size={22} className="text-[#a87835]" />
                      <p className="mt-2 text-xs font-black text-[#a87835]">
                        Choose Video from Device
                      </p>
                      <p className="text-[10px] text-slate-500">
                        MP4, WebM, MOV
                      </p>
                    </label>
                  </div>
                )}

                {/* Attached Images */}
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-[#073d22]">
                      Attached Images ({form.images.length})
                    </span>
                    {form.images.length > 0 && (
                      <span className="text-[11px] text-slate-500">
                        First image is cover photo
                      </span>
                    )}
                  </div>
                  {form.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
                      {form.images.map((url, idx) => (
                        <div
                          key={idx}
                          className={`group relative overflow-hidden rounded-xl border bg-white ${
                            idx === 0
                              ? "border-[#ddb849] ring-2 ring-[#ddb849]/30"
                              : "border-slate-200"
                          }`}
                        >
                          <img
                            src={url}
                            alt={`Photo ${idx + 1}`}
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (!target.dataset.fallback) {
                                target.dataset.fallback = "true";
                                target.src =
                                  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80";
                              }
                            }}
                            className="h-24 w-full object-cover"
                          />
                          {idx === 0 ? (
                            <span className="absolute left-1 top-1 rounded bg-[#ddb849] px-1.5 py-0.5 text-[9px] font-black text-[#073d22]">
                              ★ Cover
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetCoverImage(idx)}
                              className="absolute left-1 top-1 hidden group-hover:block rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white"
                            >
                              Set Cover
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute right-1 top-1 rounded-full bg-red-600/90 p-1 text-white hover:bg-red-700"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Attached Video */}
                {form.videoUrl && (
                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-[#a87835] flex items-center gap-1.5">
                        <Video size={14} /> Attached Video Tour
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveVideo}
                        className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                    <div className="h-44 w-full max-w-sm overflow-hidden rounded-xl bg-black">
                      <PropertyVideoPlayer url={form.videoUrl} className="h-full w-full" />
                    </div>
                  </div>
                )}
              </div>

              <textarea
                rows={3}
                placeholder="Features & documentation (one per line)"
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                className="rounded-xl border border-slate-200 p-4 text-sm sm:col-span-2 outline-none"
              />

              <label className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-sm font-bold text-[#073d22] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) =>
                    setForm({ ...form, featured: e.target.checked })
                  }
                />{" "}
                Feature on marketplace front page
              </label>

              {formError && (
                <p className="rounded-xl bg-red-50 p-4 text-xs font-bold text-red-700 sm:col-span-2">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 sm:col-span-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="rounded-xl px-5 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  disabled={saving || !form.offerTypes.length}
                  className="rounded-xl bg-[#073d22] px-7 py-3 text-sm font-black text-white hover:bg-[#094e2b] disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Property"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEDIA UPLOAD GUIDE MODAL */}
      {guideModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-6 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-[#a87835] border border-amber-200">
                  <BookOpen size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#073d22]">
                    Property Media Upload Guide
                  </h3>
                  <p className="text-xs text-slate-500">
                    Where to upload photos & video tours to get direct links for Midlex Realty
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Tabs */}
            <div className="p-6 space-y-6">
              {/* Tab Selector */}
              <div className="flex rounded-2xl bg-slate-100 p-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setGuideTab("images")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 transition ${
                    guideTab === "images"
                      ? "bg-white text-[#073d22] shadow-sm font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Camera size={16} /> 1. Uploading Images (Photos)
                </button>
                <button
                  type="button"
                  onClick={() => setGuideTab("videos")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 transition ${
                    guideTab === "videos"
                      ? "bg-white text-[#073d22] shadow-sm font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Video size={16} /> 2. Uploading Videos (Virtual Tours)
                </button>
              </div>

              {/* TAB 1: IMAGES */}
              {guideTab === "images" && (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/70 p-4 text-xs leading-relaxed text-emerald-950">
                    <span className="font-black text-emerald-900 block mb-1">
                      💡 Important Requirement:
                    </span>
                    Your link must be a <strong>Direct Image Link</strong> ending in <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-900">.jpg</code>, <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-900">.jpeg</code>, <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-900">.png</code>, or <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-900">.webp</code>.
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* Option A */}
                    <div className="rounded-2xl border-2 border-[#073d22]/20 bg-white p-4 shadow-xs hover:border-[#073d22] transition flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#a87835] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Recommended
                          </span>
                          <span className="text-xs font-bold text-emerald-700">100% Free</span>
                        </div>
                        <h4 className="text-base font-black text-[#073d22]">Postimages</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-3">
                          Fastest and easiest. No signup or account required.
                        </p>
                        <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside">
                          <li>Click &quot;Choose images&quot;</li>
                          <li>Upload your photos</li>
                          <li>Copy <strong>&quot;Direct link&quot;</strong></li>
                          <li>Paste into Midlex Admin</li>
                        </ol>
                      </div>
                      <a
                        href="https://postimages.org"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-xl bg-[#073d22] py-2.5 text-xs font-black text-white hover:bg-[#094e2b] transition"
                      >
                        Open Postimages <ExternalLink size={13} />
                      </a>
                    </div>

                    {/* Option B */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-[#073d22] transition flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Fast Host
                          </span>
                          <span className="text-xs font-bold text-emerald-700">Free</span>
                        </div>
                        <h4 className="text-base font-black text-slate-900">ImgBB</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-3">
                          Simple image hosting. No signup needed.
                        </p>
                        <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside">
                          <li>Click &quot;Start Uploading&quot;</li>
                          <li>Select &quot;Don&apos;t autodelete&quot;</li>
                          <li>Select &quot;Direct links&quot;</li>
                          <li>Copy URL &amp; paste</li>
                        </ol>
                      </div>
                      <a
                        href="https://imgbb.com"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition"
                      >
                        Open ImgBB <ExternalLink size={13} />
                      </a>
                    </div>

                    {/* Option C */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-[#073d22] transition flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            Professional
                          </span>
                          <span className="text-xs font-bold text-slate-600">25GB Free</span>
                        </div>
                        <h4 className="text-base font-black text-slate-900">Cloudinary</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-3">
                          Enterprise real estate CDN with fast worldwide delivery.
                        </p>
                        <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside">
                          <li>Create free account</li>
                          <li>Upload photos/videos</li>
                          <li>Copy secure delivery URL</li>
                          <li>Paste into Admin</li>
                        </ol>
                      </div>
                      <a
                        href="https://cloudinary.com"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition"
                      >
                        Open Cloudinary <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: VIDEOS */}
              {guideTab === "videos" && (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-amber-50/70 border border-amber-200/70 p-4 text-xs leading-relaxed text-amber-950">
                    <span className="font-black text-amber-900 block mb-1">
                      🎬 Supported Video Types:
                    </span>
                    The built-in Midlex video player natively embeds <strong>YouTube</strong>, <strong>Vimeo</strong>, and direct <strong>.mp4</strong> links directly into the property page.
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* Option A: YouTube */}
                    <div className="rounded-2xl border-2 border-[#073d22]/20 bg-white p-4 shadow-xs hover:border-[#073d22] transition flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#a87835] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Recommended
                          </span>
                          <span className="text-xs font-bold text-emerald-700">Free &amp; 4K</span>
                        </div>
                        <h4 className="text-base font-black text-[#073d22]">YouTube (Unlisted)</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-3">
                          Unlimited storage, lightning-fast 4K streaming.
                        </p>
                        <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside">
                          <li>Upload to your YouTube channel</li>
                          <li>Set visibility to <strong>Unlisted</strong></li>
                          <li>Copy the video share link</li>
                          <li>Paste into Video Tour URL</li>
                        </ol>
                      </div>
                      <a
                        href="https://youtube.com"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-xl bg-red-600 py-2.5 text-xs font-black text-white hover:bg-red-700 transition"
                      >
                        Open YouTube <ExternalLink size={13} />
                      </a>
                    </div>

                    {/* Option B: Vimeo */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-[#073d22] transition flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                            Ad-Free
                          </span>
                          <span className="text-xs font-bold text-slate-600">Free Tier</span>
                        </div>
                        <h4 className="text-base font-black text-slate-900">Vimeo</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-3">
                          Clean, professional player without external ads.
                        </p>
                        <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside">
                          <li>Upload to Vimeo</li>
                          <li>Copy the video URL</li>
                          <li>Paste into Video Tour URL</li>
                        </ol>
                      </div>
                      <a
                        href="https://vimeo.com"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-xl bg-sky-600 py-2.5 text-xs font-black text-white hover:bg-sky-700 transition"
                      >
                        Open Vimeo <ExternalLink size={13} />
                      </a>
                    </div>

                    {/* Option C: Streamable */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-[#073d22] transition flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Direct Link
                          </span>
                          <span className="text-xs font-bold text-emerald-700">Free</span>
                        </div>
                        <h4 className="text-base font-black text-slate-900">Streamable</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-3">
                          Quick drag-and-drop short tour videos.
                        </p>
                        <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside">
                          <li>Upload tour clip</li>
                          <li>Copy direct link</li>
                          <li>Paste into Video Tour URL</li>
                        </ol>
                      </div>
                      <a
                        href="https://streamable.com"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition"
                      >
                        Open Streamable <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Summary Card */}
              <div className="rounded-2xl bg-slate-900 text-white p-5">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#ddb849] mb-2 flex items-center gap-2">
                  <Check size={16} /> Quick Summary Checklist
                </h4>
                <div className="grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#ddb849]" />
                    <span><strong>Photos</strong>: Go to <strong>postimages.org</strong> → copy <strong>Direct Link</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#ddb849]" />
                    <span><strong>Videos</strong>: Upload to <strong>YouTube</strong> as <strong>Unlisted</strong> → copy share link</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 p-4 bg-slate-50 rounded-b-3xl flex justify-end">
              <button
                type="button"
                onClick={() => setGuideModalOpen(false)}
                className="rounded-xl bg-[#073d22] px-6 py-2.5 text-xs font-black text-white hover:bg-[#094e2b] transition"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
