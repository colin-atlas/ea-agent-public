"use client";

import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Task {
  id: number;
  title: string;
  description: string | null;
  project_id: number | null;
  priority: string;
  status: string;
  owner: string;
  due_date: string | null;
  blocked_by: number | null;
  blocked_reason: string | null;
  notes: string | null;
  checklist: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  project_name: string;
  tags: string | null;
}

interface Comment {
  id: number;
  task_id: number;
  author: string;
  content: string;
  created_at: string;
}

interface ChecklistItem {
  text: string;
  done: boolean;
}

interface Project {
  id: number;
  name: string;
}

interface Props {
  task: Task | null;
  onClose: () => void;
  onUpdated: () => void;
  projects?: Project[];
  allTasks?: Task[];
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  backlog: { label: "Backlog", color: "text-[rgba(240,238,255,0.5)]", bg: "bg-[rgba(251,254,247,0.05)] border-[rgba(251,254,247,0.1)]" },
  today: { label: "Today", color: "text-[#F5C542]", bg: "bg-[rgba(245,197,66,0.1)] border-[rgba(245,197,66,0.25)]" },
  in_progress: { label: "In Progress", color: "text-[#5C70FF]", bg: "bg-[rgba(92,112,255,0.1)] border-[rgba(92,112,255,0.25)]" },
  blocked: { label: "Blocked", color: "text-[#ff4466]", bg: "bg-[rgba(255,68,102,0.1)] border-[rgba(255,68,102,0.25)]" },
  needs_review: { label: "Needs Review", color: "text-[#07BEB8]", bg: "bg-[rgba(7,190,184,0.1)] border-[rgba(7,190,184,0.2)]" },
  done: { label: "Done", color: "text-[#B675F5]", bg: "bg-[rgba(182,117,245,0.1)] border-[rgba(182,117,245,0.25)]" },
  archive: { label: "Archive", color: "text-[rgba(240,238,255,0.2)]", bg: "bg-[rgba(251,254,247,0.03)] border-[rgba(251,254,247,0.05)]" },
};

const priorityConfig: Record<string, { color: string; bg: string }> = {
  high: { color: "text-[#ff6680]", bg: "bg-[rgba(255,68,102,0.1)] border-[rgba(255,68,102,0.25)]" },
  med: { color: "text-[#B675F5]", bg: "bg-[rgba(182,117,245,0.1)] border-[rgba(182,117,245,0.25)]" },
  low: { color: "text-[#5C70FF]", bg: "bg-[rgba(92,112,255,0.1)] border-[rgba(92,112,255,0.25)]" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00Z"));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr + "Z");
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function TaskDetailSheet({ task, onClose, onUpdated, projects = [], allTasks = [] }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [sacredSix, setSacredSix] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blockedBy, setBlockedBy] = useState<string>("none");
  const [blockedReason, setBlockedReason] = useState("");

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Checklist state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const fetchComments = useCallback(() => {
    if (!task) return;
    fetch(`/api/tasks/${task.id}/comments`).then(r => r.json()).then(setComments);
  }, [task]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setNotes(task.notes || "");
      setStatus(task.status);
      setPriority(task.priority);
      setOwner(task.owner);
      setDueDate(task.due_date || "");
      setProjectId(task.project_id ? String(task.project_id) : "none");
      setSacredSix(task.tags?.split(",").includes("sacred-six") || false);
      setBlockedBy(task.blocked_by ? String(task.blocked_by) : "none");
      setBlockedReason(task.blocked_reason || "");
      setEditing(false);
      setConfirmDelete(false);
      setNewComment("");

      // Parse checklist
      try {
        setChecklistItems(task.checklist ? JSON.parse(task.checklist) : []);
      } catch {
        setChecklistItems([]);
      }

      fetchComments();
    }
  }, [task, fetchComments]);

  const handleDelete = async () => {
    if (!task) return;
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    onClose();
    onUpdated();
  };

  const handleSave = async () => {
    if (!task) return;
    const wasSacredSix = task.tags?.split(",").includes("sacred-six") || false;
    const currentTags = task.tags ? task.tags.split(",").filter(t => t !== "sacred-six") : [];
    if (sacredSix) currentTags.push("sacred-six");

    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, description: description || null, notes: notes || null,
        status, priority, owner, due_date: dueDate || null,
        project_id: projectId && projectId !== "none" ? parseInt(projectId) : null,
        blocked_by: blockedBy && blockedBy !== "none" ? parseInt(blockedBy) : null,
        blocked_reason: blockedReason || null,
        checklist: checklistItems.length > 0 ? JSON.stringify(checklistItems) : null,
        ...(sacredSix !== wasSacredSix ? { tags: currentTags } : {}),
      }),
    });
    onUpdated();
  };

  const addComment = async () => {
    if (!task || !newComment.trim()) return;
    setSubmittingComment(true);
    await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newComment.trim() }),
    });
    setNewComment("");
    setSubmittingComment(false);
    fetchComments();
  };

  const toggleChecklistItem = async (index: number) => {
    if (!task) return;
    const res = await fetch(`/api/tasks/${task.id}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });
    const data = await res.json();
    if (data.checklist) setChecklistItems(data.checklist);
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklistItems([...checklistItems, { text: newChecklistItem.trim(), done: false }]);
    setNewChecklistItem("");
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  if (!task) return null;

  const sc = statusConfig[task.status] || statusConfig.backlog;
  const pc = priorityConfig[task.priority] || priorityConfig.med;
  const clDone = checklistItems.filter(i => i.done).length;
  const blockerTasks = allTasks.filter(t => t.id !== task.id && !["done", "archive"].includes(t.status));

  return (
    <Sheet open={!!task} onOpenChange={() => onClose()}>
      <SheetContent className="w-[480px] overflow-auto p-0" style={{background: "rgba(13,13,20,0.97)", backdropFilter: "blur(20px)", borderLeft: "1px solid rgba(182,117,245,0.12)"}}>
        {/* Header */}
        <div className="p-6 pb-4">
          <SheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-[11px] text-zinc-600 font-mono mb-1">TASK-{task.id}</p>
                {editing ? (
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-zinc-900 border-zinc-700 text-lg font-semibold" />
                ) : (
                  <SheetTitle className="text-zinc-100 text-xl font-semibold leading-tight">{task.title}</SheetTitle>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Status & Priority Row */}
          <div className="flex items-center gap-2 mt-4">
            {editing ? (
              <>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="needs_review">Needs Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="archive">Archive</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-20 bg-zinc-900 border-zinc-700 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="med">Med</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <Badge variant="outline" className={`text-[11px] ${sc.color} ${sc.bg}`}>{sc.label}</Badge>
                <Badge variant="outline" className={`text-[11px] ${pc.color} ${pc.bg}`}>{task.priority}</Badge>
              </>
            )}
          </div>
        </div>

        <Separator className="bg-[rgba(92,112,255,0.1)]" />

        {/* Properties */}
        <div className="p-6 py-4">
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div>
              <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-1">Project</p>
              {editing ? (
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-zinc-300">{task.project_name || "—"}</p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-1">Owner</p>
              {editing ? (
                <Select value={owner} onValueChange={setOwner}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="[EXECUTIVE_NAME]">[EXECUTIVE_NAME]</SelectItem>
                    <SelectItem value="[EA_NAME]">[EA_NAME]</SelectItem>
                    <SelectItem value="[AGENT_NAME]">[AGENT_NAME]</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-zinc-300">{task.owner}</p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-1">Due Date</p>
              {editing ? (
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-zinc-900 border-zinc-700 h-8 text-sm" />
              ) : (
                <p className="text-zinc-300">{task.due_date ? formatDate(task.due_date) : "—"}</p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-1">Created</p>
              <p className="text-zinc-500">{timeAgo(task.created_at)}</p>
            </div>
          </div>

          {/* Sacred Six Toggle */}
          {editing ? (
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => setSacredSix(!sacredSix)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  sacredSix
                    ? "bg-[rgba(7,190,184,0.12)] text-[#07BEB8] border-[rgba(7,190,184,0.3)]"
                    : "bg-zinc-900 text-zinc-500 border-zinc-700 hover:border-[rgba(7,190,184,0.2)]"
                }`}
              >
                <span className="text-[10px] font-bold tracking-wide">S6</span>
                {sacredSix ? "Sacred Six" : "Add to Sacred Six"}
              </button>
            </div>
          ) : task.tags ? (
            <div className="mt-3">
              <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-1.5">Tags</p>
              <div className="flex gap-1.5 flex-wrap">
                {task.tags.split(",").map((tag) => (
                  <Badge key={tag} variant="outline" className={`text-[10px] ${tag === "sacred-six" ? "text-[#07BEB8] border-[rgba(7,190,184,0.3)] bg-[rgba(7,190,184,0.08)]" : "text-zinc-500 border-zinc-700/50 bg-zinc-800/30"}`}>{tag === "sacred-six" ? "S6 Sacred Six" : tag}</Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <Separator className="bg-[rgba(92,112,255,0.1)]" />

        {/* Blocked-By Picker (when editing + status is blocked) */}
        {editing && status === "blocked" && (
          <>
            <div className="p-6 py-4">
              <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-2">Blocked By</p>
              <Select value={blockedBy} onValueChange={setBlockedBy}>
                <SelectTrigger className="bg-zinc-900 border-zinc-700 h-8 text-sm mb-2"><SelectValue placeholder="Select blocking task" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {blockerTasks.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>#{t.id} — {t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                placeholder="Blocked reason..."
                className="bg-zinc-900 border-zinc-700 h-8 text-sm"
              />
            </div>
            <Separator className="bg-[rgba(92,112,255,0.1)]" />
          </>
        )}

        {/* Blocked Info (view mode) */}
        {!editing && (task.blocked_by || task.blocked_reason) && (
          <>
            <div className="p-6 py-4">
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                <p className="text-[11px] text-red-400 uppercase tracking-wider mb-1">Blocked By</p>
                {task.blocked_by && <p className="text-sm text-red-300">Task #{task.blocked_by}</p>}
                {task.blocked_reason && <p className="text-xs text-zinc-500 mt-1">{task.blocked_reason}</p>}
              </div>
            </div>
            <Separator className="bg-[rgba(92,112,255,0.1)]" />
          </>
        )}

        {/* Checklist */}
        <div className="p-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-zinc-600 uppercase tracking-wider">Checklist</p>
            {checklistItems.length > 0 && (
              <span className="text-[10px] text-zinc-500">{clDone}/{checklistItems.length} complete</span>
            )}
          </div>
          {checklistItems.length > 0 && (
            <div className="space-y-1 mb-2">
              {/* Progress bar */}
              <div className="w-full bg-zinc-800 rounded-full h-1 mb-2">
                <div
                  className="h-1 rounded-full bg-[#07BEB8] transition-all"
                  style={{ width: `${checklistItems.length > 0 ? (clDone / checklistItems.length) * 100 : 0}%` }}
                />
              </div>
              {checklistItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <button
                    onClick={() => toggleChecklistItem(i)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      item.done
                        ? "bg-[rgba(7,190,184,0.2)] border-[rgba(7,190,184,0.4)] text-[#07BEB8]"
                        : "border-zinc-600 hover:border-[rgba(7,190,184,0.3)]"
                    }`}
                  >
                    {item.done && <span className="text-[9px]">&#10003;</span>}
                  </button>
                  <span className={`text-sm flex-1 ${item.done ? "text-zinc-500 line-through" : "text-zinc-300"}`}>{item.text}</span>
                  {editing && (
                    <button
                      onClick={() => removeChecklistItem(i)}
                      className="text-zinc-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &#10005;
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {editing && (
            <div className="flex gap-2">
              <Input
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                placeholder="Add checklist item..."
                className="bg-zinc-900 border-zinc-700 h-7 text-xs flex-1"
                onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
              />
              <Button onClick={addChecklistItem} variant="outline" className="h-7 px-2 text-xs border-zinc-700">+</Button>
            </div>
          )}
          {!editing && checklistItems.length === 0 && (
            <p className="text-xs text-zinc-600 italic">No checklist</p>
          )}
        </div>

        <Separator className="bg-[rgba(92,112,255,0.1)]" />

        {/* Description */}
        <div className="p-6 py-4">
          <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-2">Description</p>
          {editing ? (
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description..." className="bg-zinc-900 border-zinc-700 text-sm min-h-[100px]" />
          ) : (
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
              {task.description || <span className="text-zinc-600 italic">No description</span>}
            </p>
          )}
        </div>

        <Separator className="bg-[rgba(92,112,255,0.1)]" />

        {/* Notes */}
        <div className="p-6 py-4">
          <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-2">Notes</p>
          {editing ? (
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." className="bg-zinc-900 border-zinc-700 text-sm min-h-[120px]" />
          ) : (
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
              {task.notes || <span className="text-zinc-600 italic">No notes</span>}
            </p>
          )}
        </div>

        <Separator className="bg-[rgba(92,112,255,0.1)]" />

        {/* Comments */}
        <div className="p-6 py-4">
          <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-2">
            Comments {comments.length > 0 && <span className="text-zinc-700">({comments.length})</span>}
          </p>
          {comments.length > 0 && (
            <div className="space-y-3 mb-3">
              {comments.map((c) => (
                <div key={c.id} className="bg-[rgba(240,238,255,0.02)] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-medium text-[#B675F5]">{c.author}</span>
                    <span className="text-[9px] text-zinc-600">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="bg-zinc-900 border-zinc-700 h-8 text-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addComment()}
            />
            <Button
              onClick={addComment}
              disabled={submittingComment || !newComment.trim()}
              variant="outline"
              className="h-8 px-3 text-xs border-zinc-700 hover:border-[#B675F5] hover:text-[#B675F5]"
            >
              {submittingComment ? "..." : "Post"}
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-2">
          {editing ? (
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 h-9 bg-[#B675F5] hover:bg-[#a060e0] text-[#0D0D14] font-semibold border-0 glow-lavender">Save Changes</Button>
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1 h-9 border-[rgba(182,117,245,0.15)] hover:bg-[rgba(182,117,245,0.06)]">Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)} className="w-full h-9 border-[rgba(182,117,245,0.15)] hover:bg-[rgba(182,117,245,0.06)] hover:border-[#B675F5] hover:text-[#B675F5] transition-all">
              Edit Task
            </Button>
          )}

          {/* Delete */}
          {!editing && (
            <div className="mt-3">
              {confirmDelete ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleDelete} className="flex-1 h-9 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300">
                    Confirm Delete
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1 h-9 border-zinc-700 hover:bg-zinc-800">
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors"
                >
                  Delete task
                </button>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="flex items-center justify-between mt-4 text-[10px] text-zinc-700">
            <span>Updated {timeAgo(task.updated_at)}</span>
            {task.completed_at && <span>Completed {timeAgo(task.completed_at)}</span>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
