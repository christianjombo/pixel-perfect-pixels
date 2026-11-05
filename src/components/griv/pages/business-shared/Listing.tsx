import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ListFilters({ search, onSearch, label, children }: { search: string; onSearch: (v: string) => void; label: string; children?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
    <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input aria-label={label} placeholder={label} value={search} onChange={e => onSearch(e.target.value)} className="field h-10 pl-9" /></div>{children}
  </div>;
}
export function Listing({ count, noun, onExport, headers, children, page, onPage, pageSize = 25 }: { count: number; noun: string; onExport: () => void; headers: string[]; children: ReactNode; page: number; onPage: (v: number) => void; pageSize?: number }) {
  return <section className="overflow-hidden rounded-lg border bg-card">
    <div className="flex items-center justify-between border-b px-5 py-3"><p className="text-sm font-medium">{count} {noun}</p><Button variant="outline" onClick={onExport} disabled={!count}><Download />Export</Button></div>
    <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-muted/60 text-muted-foreground"><tr>{headers.map((h, i) => <th key={i} className="px-5 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y">{children}{count === 0 && <tr><td colSpan={headers.length} className="p-12 text-center text-muted-foreground">No {noun} found.</td></tr>}</tbody></table></div>
    <div className="flex items-center justify-between gap-2 border-t px-5 py-3 text-xs text-muted-foreground"><span>{count ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, count)} of {count}</span><div className="flex items-center gap-2"><span>Page {page}</span><Button variant="ghost" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft /></Button><Button variant="ghost" size="icon" aria-label="Next page" disabled={page * pageSize >= count} onClick={() => onPage(page + 1)}><ChevronRight /></Button></div></div>
  </section>;
}