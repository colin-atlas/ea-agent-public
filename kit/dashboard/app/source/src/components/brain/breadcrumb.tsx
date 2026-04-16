"use client";

import { ChevronRight } from "lucide-react";

interface BreadcrumbProps {
  path: string;
  onNavigate: (dir: string) => void;
}

export function BrainBreadcrumb({ path, onNavigate }: BreadcrumbProps) {
  const segments = path.split("/");

  return (
    <div className="flex items-center gap-1 text-sm">
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        const dirPath = segments.slice(0, i + 1).join("/");

        return (
          <span key={dirPath} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-600" />}
            {isLast ? (
              <span className="text-zinc-200 font-medium">{segment.replace(/\.md$/, "")}</span>
            ) : (
              <button
                onClick={() => onNavigate(dirPath)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {segment}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
