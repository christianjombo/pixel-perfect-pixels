import { createSimStore } from "@/lib/sim/store";
import { getDataset, BASE_CUSTOMERS } from "@/lib/sim/dataset";
/** SAMPLE DATA — fictional customers. Not real people. */
export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  country: "Nigeria" | "Ghana" | "Kenya" | "South Africa" | "United States" | "United Kingdom";
  /** Individual person or registered organisation. */
  kind: "user" | "org";
  /** Street address for billing, when known. */
  address?: string | undefined;
  /** Optional business details for organisations. */
  registrationNumber?: string | undefined;
  taxId?: string | undefined;
};

export const CUSTOMER_COUNTRIES: Customer["country"][] = ["Nigeria", "Ghana", "Kenya", "South Africa", "United States", "United Kingdom"];

/** The original 24 directory entries; the full simulated directory lives in customersStore. */
export const CUSTOMERS: Customer[] = BASE_CUSTOMERS;

/** Shared customer store so customers created from the invoice editor show up everywhere. */
export const customersStore = createSimStore<Customer[]>(
  "customers",
  (env) => getDataset(env).customers,
  { overlay: true },
);
export const useCustomers = () => customersStore.use();
export const getCustomer = (id: string) => customersStore.get().find((c) => c.id === id);
export const customerByName = (name: string) => customersStore.get().find((c) => c.name === name);

export function addCustomer(input: Omit<Customer, "id">): Customer {
  const c: Customer = { ...input, id: `cus_${Date.now().toString(36)}` };
  customersStore.set((all) => [c, ...all]);
  return c;
}

export function updateCustomer(id: string, patch: Partial<Omit<Customer, "id">>) {
  customersStore.set((all) => all.map((c) => (c.id === id ? { ...c, ...patch } : c)));
}
