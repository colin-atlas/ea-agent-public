"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers";

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      await refreshSession();
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-dashboard orb-bg">
      <div className="text-center space-y-6 p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm max-w-sm w-full">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0EEFF]">
            {process.env.NEXT_PUBLIC_APP_NAME || "Executive Dashboard"}
          </h1>
          <p className="text-sm text-[#F0EEFF]/60 mt-1">
            {process.env.NEXT_PUBLIC_ORG_NAME || "My Organization"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label htmlFor="email" className="block text-[11px] uppercase tracking-wider text-[rgba(240,238,255,0.4)] mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[#F0EEFF] text-sm placeholder:text-[rgba(240,238,255,0.2)] focus:outline-none focus:border-[rgba(7,190,184,0.4)] transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[11px] uppercase tracking-wider text-[rgba(240,238,255,0.4)] mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[#F0EEFF] text-sm placeholder:text-[rgba(240,238,255,0.2)] focus:outline-none focus:border-[rgba(7,190,184,0.4)] transition-colors"
              placeholder="Password"
            />
          </div>

          {error && (
            <p className="text-[13px] text-[#ff6680] text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-[#F0EEFF] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
