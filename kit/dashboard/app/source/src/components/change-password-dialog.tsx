"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordDialog({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to change password");
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-sm glass-strong rounded-xl border border-[rgba(182,117,245,0.15)] p-6">
        <h2 className="text-sm font-semibold text-[#F0EEFF] mb-4">Change Password</h2>

        {success ? (
          <p className="text-sm text-[#07BEB8]">Password updated successfully</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] text-[rgba(240,238,255,0.4)] mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[rgba(182,117,245,0.06)] border border-[rgba(182,117,245,0.12)] text-sm text-[#F0EEFF] outline-none focus:border-[rgba(182,117,245,0.3)] transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-[rgba(240,238,255,0.4)] mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[rgba(182,117,245,0.06)] border border-[rgba(182,117,245,0.12)] text-sm text-[#F0EEFF] outline-none focus:border-[rgba(182,117,245,0.3)] transition-colors"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-[11px] text-[rgba(240,238,255,0.4)] mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[rgba(182,117,245,0.06)] border border-[rgba(182,117,245,0.12)] text-sm text-[#F0EEFF] outline-none focus:border-[rgba(182,117,245,0.3)] transition-colors"
                required
                minLength={8}
              />
            </div>

            {error && <p className="text-[11px] text-[#ff6680]">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-2 rounded-lg text-[11px] text-[rgba(240,238,255,0.4)] hover:text-[#F0EEFF] hover:bg-[rgba(182,117,245,0.06)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-3 py-2 rounded-lg text-[11px] font-medium bg-[rgba(182,117,245,0.15)] text-[#B675F5] hover:bg-[rgba(182,117,245,0.25)] border border-[rgba(182,117,245,0.2)] transition-colors disabled:opacity-50"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
