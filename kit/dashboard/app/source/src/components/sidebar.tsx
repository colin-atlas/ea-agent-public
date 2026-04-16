"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers";
import { theme, hexToRgba } from "@/lib/theme";
import { ChangePasswordDialog } from "@/components/change-password-dialog";

const nav = [
  { href: "/home", label: "Home", icon: "🏠" },
  { href: "/tasks", label: "Tasks", icon: "📋" },
  { href: "/reports", label: "Reports", icon: "📰" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/meetings", label: "Meetings", icon: "🎯" },
  { href: "/brain", label: "Brain", icon: "🧠" },
  { href: "/skills", label: "Skills", icon: "⚡" },
  { href: "/memory", label: "Memory", icon: "💾" },
  { href: "/status", label: "Status", icon: "📊" },
];

const externalLinks = [
  { href: process.env.NEXT_PUBLIC_DOCS_URL || "#", label: "Knowledge Base", icon: "📚" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <aside className="w-56 glass-strong flex flex-col border-r border-[rgba(182,117,245,0.1)]">
      <div className="p-5 border-b border-[rgba(182,117,245,0.1)]">
        <h1 className="text-base font-bold tracking-tight gradient-text" style={{fontFamily: "var(--font-montserrat)"}}>
          {theme.appName}
        </h1>
        <p className="text-[11px] text-[rgba(240,238,255,0.3)] mt-1 tracking-widest uppercase font-medium">{theme.orgName}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-[rgba(182,117,245,0.12)] text-[#B675F5] glow-lavender border border-[rgba(182,117,245,0.2)]"
                  : "text-[rgba(240,238,255,0.45)] hover:text-[#F0EEFF] hover:bg-[rgba(182,117,245,0.06)]"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        {externalLinks.length > 0 && (
          <>
            <div className="border-t border-[rgba(182,117,245,0.08)] my-2" />
            {externalLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-[rgba(240,238,255,0.45)] hover:text-[#F0EEFF] hover:bg-[rgba(182,117,245,0.06)]"
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] text-[rgba(240,238,255,0.2)]">&#8599;</span>
              </a>
            ))}
          </>
        )}
      </nav>
      <div className="p-4 border-t border-[rgba(182,117,245,0.1)] space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#07BEB8] glow-teal"></div>
          <p className="text-[11px] text-[rgba(240,238,255,0.3)] tracking-wide font-medium">Online</p>
        </div>
        {user && (
          <div className="relative group">
            <button className="text-[11px] text-[rgba(240,238,255,0.45)] hover:text-[#F0EEFF] transition-colors truncate max-w-full text-left cursor-pointer">
              {user.name || user.email}
            </button>
            <div className="absolute bottom-full left-0 mb-1.5 w-36 py-1 rounded-lg glass-strong border border-[rgba(182,117,245,0.15)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 shadow-lg">
              <button
                onClick={() => setShowChangePassword(true)}
                className="w-full px-3 py-1.5 text-left text-[11px] text-[rgba(240,238,255,0.5)] hover:text-[#B675F5] hover:bg-[rgba(182,117,245,0.06)] transition-colors"
              >
                Change password
              </button>
              <button
                onClick={() => signOut()}
                className="w-full px-3 py-1.5 text-left text-[11px] text-[rgba(240,238,255,0.5)] hover:text-[#ff6680] hover:bg-[rgba(255,102,128,0.06)] transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
      <ChangePasswordDialog open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </aside>
  );
}
