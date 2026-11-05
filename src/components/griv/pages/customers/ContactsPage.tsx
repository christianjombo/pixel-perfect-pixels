import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, UserRound, Plus, Pencil, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DashboardPage } from "@/components/griv/DashboardPage";
import { DetailDrawer, FormDialog, Field, DetailList } from "@/components/griv/kit";
import { CUSTOMER_COUNTRIES, addCustomer, updateCustomer, useCustomers, type Customer } from "@/lib/demo/customers";
import { saveSupplier, suppliersStore, type Supplier } from "@/lib/demo/business-pages";
import { useInvoices, invoiceTotals, invoicePaid } from "@/lib/demo/invoices";
import { formatMoney, CURRENCIES } from "@/lib/money";
import { exportCsv } from "@/lib/csv";
import { Listing, ListFilters } from "../business-shared/Listing";

const blank = (): Omit<Supplier, "id"> => ({ name: "", email: "", phone: "", city: "", country: "Nigeria", kind: "user", category: "Stock", notes: "", address: "" });
export function ContactsPage({ suppliers = false }: { suppliers?: boolean }) {
  const customers = useCustomers(); const supplierRows = suppliersStore.use(); const invoices = useInvoices();
  const rows = suppliers ? supplierRows : customers;
  const noun = suppliers ? "suppliers" : "customers"; const singular = suppliers ? "supplier" : "customer";
  const [search, setSearch] = useState(""); const [kind, setKind] = useState("all"); const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [editingId, setEditingId] = useState<string | undefined>();
  const [open, setOpen] = useState(false); const [form, setForm] = useState(blank); const [error, setError] = useState("");
  const selected = rows.find(c => c.id === selectedId);
  const filtered = rows.filter(c => (kind === "all" || c.kind === kind) && `${c.name} ${c.email} ${c.phone} ${c.city}`.toLowerCase().includes(search.toLowerCase()));
  const related = selected ? invoices.filter(i => i.customerId === selected.id || i.customer === selected.name) : [];
  const start = (c?: Customer) => { setEditingId(c?.id); setForm(c ? { ...blank(), ...c } : blank()); setError(""); setOpen(true); };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError("Enter a name and valid email address."); return; }
    if (rows.some(c => c.id !== editingId && c.email.toLowerCase() === form.email.trim().toLowerCase())) { setError("This email address is already in the directory."); return; }
    const clean = { ...form, name: form.name.trim(), email: form.email.trim() };
    if (suppliers) saveSupplier(clean, editingId);
    else { const { category: _category, notes: _notes, ...input } = clean; if (editingId) updateCustomer(editingId, input); else addCustomer(input); }
    setOpen(false); toast.success(`${suppliers ? "Supplier" : "Customer"} saved`);
  };
  return <DashboardPage title={suppliers ? "Suppliers" : "Customers"} description={suppliers ? "Manage the people and businesses you buy from." : "Manage customer contacts and billing details."} actions={<Button onClick={() => start()}><Plus />Add {singular}</Button>}>
    <div className="mb-6 flex flex-wrap items-center gap-3 text-sm"><span className="text-muted-foreground">Show for:</span><select aria-label="Contact type" className="field w-auto min-w-44" value={kind} onChange={e => { setKind(e.target.value); setPage(1); }}><option value="all">All {noun}</option><option value="user">Individuals</option><option value="org">Organisations</option></select></div>
    <ListFilters label={`Search ${noun}`} search={search} onSearch={v => { setSearch(v); setPage(1); }}><Button variant="ghost" onClick={() => { setSearch(""); setKind("all"); setPage(1); }}>Clear filters</Button></ListFilters>
    <Listing count={filtered.length} noun={noun} headers={[suppliers ? "Supplier" : "Customer", "Phone", "Location", suppliers ? "Category" : "Type", ""]} page={page} onPage={setPage} onExport={() => exportCsv(noun, filtered.map(c => ({ Name: c.name, Email: c.email, Phone: c.phone, City: c.city, Country: c.country, Type: c.kind === "org" ? "Organisation" : "Individual" })))}>
      {filtered.slice((page - 1) * 25, page * 25).map(c => <tr key={c.id} className="group cursor-pointer hover:bg-muted/40" onClick={() => setSelectedId(c.id)}><td className="px-5 py-4"><Button variant="ghost" className="h-auto justify-start px-0 text-left hover:bg-transparent" onClick={e => { e.stopPropagation(); setSelectedId(c.id); }}>{c.kind === "org" ? <Building2 className="text-muted-foreground" /> : <UserRound className="text-muted-foreground" />}<span><span className="block font-medium">{c.name}</span><span className="block text-xs font-normal text-muted-foreground">{c.email}</span></span></Button></td><td className="px-5 py-4 text-muted-foreground">{c.phone || "—"}</td><td className="px-5 py-4">{c.city ? `${c.city}, ` : ""}{c.country}</td><td className="px-5 py-4">{suppliers && "category" in c ? String(c.category) : c.kind === "org" ? "Organisation" : "Individual"}</td><td className="px-5 py-4"><Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={e => { e.stopPropagation(); start(c); }}><MoreHorizontal /></Button></td></tr>)}
    </Listing>
    <DetailDrawer open={!!selected} onOpenChange={o => { if (!o) setSelectedId(null); }} title={selected?.name ?? "Contact"} subtitle={selected?.email} footer={<Button variant="outline" onClick={() => start(selected)}><Pencil />Edit {singular}</Button>}>
      {selected && <><DetailList items={[["ID", selected.id], ["Type", selected.kind === "org" ? "Organisation" : "Individual"], ["Email", selected.email], ["Phone", selected.phone || "—"], ["Location", `${selected.city} ${selected.country}`], ["Address", selected.address || "—"]]} />
      {suppliers ? <><h2 className="font-semibold">Notes</h2><p className="text-sm text-muted-foreground">{"notes" in selected ? String(selected.notes) || "No notes." : "No notes."}</p></> : <><h2 className="font-semibold">Invoices</h2>{CURRENCIES.map(currency => { const list = related.filter(i => i.currency === currency && i.status !== "Cancelled" && i.status !== "Draft" && i.status !== "Scheduled"); return list.length ? <div key={currency} className="flex justify-between text-sm"><span>Outstanding · {currency}</span><span className="font-semibold">{formatMoney(list.reduce((s, i) => s + Math.max(0, invoiceTotals(i).total - invoicePaid(i)), 0), currency)}</span></div> : null; })}{related.length ? related.map(i => <Link key={i.id} className="flex justify-between border-b py-3 text-sm text-primary" to="/invoices/$invoiceId" params={{ invoiceId: i.id }}>{i.id}<span>{formatMoney(invoiceTotals(i).total, i.currency)}</span></Link>) : <p className="text-sm text-muted-foreground">No invoices for this customer.</p>}</>}
      </>}
    </DetailDrawer>
    <FormDialog open={open} onOpenChange={setOpen} title={`${editingId ? "Edit" : "Add"} ${singular}`}>
      <form onSubmit={save} className="space-y-4"><Field label="Type"><select className="field" aria-label="Type" value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value as Customer["kind"] }))}><option value="user">Individual</option><option value="org">Organisation</option></select></Field>
      {([ ["name", "Name"], ["email", "Email"], ["phone", "Phone"], ["city", "City"], ["address", "Address"] ] as const).map(([key, label]) => <Field key={key} label={label} htmlFor={`contact-${key}`} optional={key !== "name" && key !== "email"}><input id={`contact-${key}`} className="field" type={key === "email" ? "email" : "text"} required={key === "name" || key === "email"} value={form[key] ?? ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} /></Field>)}
      <Field label="Country"><select className="field" aria-label="Country" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value as Customer["country"] }))}>{CUSTOMER_COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></Field>
      {suppliers && <><Field label="Category"><select aria-label="Category" className="field" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{["Stock", "Packaging", "Logistics", "Services", "Other"].map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Notes" optional><textarea aria-label="Notes" className="field" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field></>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save {singular}</Button></div></form>
    </FormDialog>
  </DashboardPage>;
}