"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onUpdated: () => void;
}

export function ManageProjectsDialog({ open, onOpenChange, projects, onUpdated }: Props) {
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
    });
    setNewName("");
    setNewDesc("");
    setCreating(false);
    onUpdated();
  };

  const handleStatusChange = async (id: number, status: string) => {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onUpdated();
  };

  const activeProjects = projects.filter((p) => p.status === "active");
  const completedProjects = projects.filter((p) => p.status === "completed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Manage Projects</DialogTitle>
        </DialogHeader>

        {/* Create New */}
        <div className="space-y-2 pb-4 border-b border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">New Project</p>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            className="bg-zinc-800 border-zinc-700"
          />
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="bg-zinc-800 border-zinc-700"
          />
          <Button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="w-full bg-[#B675F5] hover:bg-[#a060e0] text-[#0D0D14] font-semibold border-0"
          >
            {creating ? "Creating..." : "Create Project"}
          </Button>
        </div>

        {/* Active Projects */}
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Active Projects</p>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-zinc-600 italic">No active projects</p>
          ) : (
            activeProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
                <div>
                  <p className="text-sm text-zinc-200 font-medium">{p.name}</p>
                  {p.description && <p className="text-xs text-zinc-500 mt-0.5">{p.description}</p>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange(p.id, "completed")}
                  className="text-xs h-7 border-zinc-700 hover:border-[#07BEB8] hover:text-[#07BEB8]"
                >
                  Complete
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Completed Projects */}
        {completedProjects.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Completed</p>
            {completedProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-zinc-500">{p.name}</p>
                  <Badge variant="outline" className="text-[9px] text-[#07BEB8] border-[rgba(7,190,184,0.2)]">done</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange(p.id, "active")}
                  className="text-xs h-7 border-zinc-700 hover:border-zinc-500"
                >
                  Reopen
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
