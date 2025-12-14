"use client";
import { ChevronDown, ChevronRight, FileText, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DocumentPage } from "../types";

// A minimal read-only tree for Docs navigation
export function DocsTree({
  pages,
  expanded,
  toggle,
  selectedId,
  onSelect,
  disabled,
}: {
  pages: DocumentPage[];
  expanded: Set<string>;
  toggle: (id: string) => void;
  selectedId?: string | null;
  onSelect: (page: DocumentPage) => void;
  disabled?: boolean;
}) {
  const render = (page: DocumentPage, level = 0) => {
    const hasChildren = !!(page.children && page.children.length);
    const isExpanded = expanded.has(page.id);
    const isSelected = selectedId === page.id;
    return (
      <div key={page.id} className={disabled ? "opacity-60" : ""}>
        <div
          className={`flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 ${isSelected ? 'bg-muted' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => !disabled && onSelect(page)}
        >
          <div className="flex items-center flex-1 cursor-pointer">
            {hasChildren ? (
              <button onClick={(e) => { e.stopPropagation(); if (!disabled) toggle(page.id); }} className="mr-1">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
            ) : (
              <div className="w-5" />
            )}
            <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-sm font-medium">{page.title}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled>
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>Actions disabled</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {page.children!.map((child) => render(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return <div>{pages.map((p) => render(p))}</div>;
}

