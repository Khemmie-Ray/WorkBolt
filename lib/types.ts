import type { BondStatus } from "./escrow";

export type TaskStatus = "open" | "in_progress" | "completed";

export type Category =
  | "design"
  | "translation"
  | "tutoring"
  | "writing"
  | "other";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "design", label: "Graphic design" },
  { value: "translation", label: "Translation" },
  { value: "tutoring", label: "Tutoring" },
  { value: "writing", label: "Writing" },
  { value: "other", label: "Something else" },
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
};

/** One per signed-in person; the id is their Supabase auth user id. */
export interface Profile {
  id: string;
  name: string;
  lightning_address: string | null;
  flash_account: string | null; // Flash username or wallet ID
  skills: string | null;
  onboarded: boolean;
  trezor_address: string | null; // written by the server after it checks the signature
  trezor_message: string | null;
  trezor_signature: string | null;
  created_at: string;
}

/** The fields a person can change on their own profile. */
export type ProfilePatch = Partial<
  Pick<
    Profile,
    "name" | "lightning_address" | "flash_account" | "skills" | "onboarded"
  >
>;

export interface Task {
  id: string;
  title: string;
  description: string;
  category: Category;
  budget_sats: number;
  deadline: string; 
  contact: string;
  status: TaskStatus;
  poster_id: string;
  poster_name: string;
  assignee_id: string | null;
  assignee_name: string | null;
  invoice: string | null;
  invoice_source: "flash" | null; // flash: the invoice is made when the poster pays
  flash_wallet: string | null;
  delivery_note: string | null;
  preimage: string | null;
  paid_via: "flash" | null;
  bond_sats: number | null;
  bond_status: BondStatus;
  bond_invoice: string | null;
  created_at: string;
  accepted_at: string | null;
  invoiced_at: string | null;
  completed_at: string | null;
}

export type NewTask = Pick<
  Task,
  "title" | "description" | "category" | "budget_sats" | "deadline" | "contact"
>;

/** The freelancer has asked to be paid: a Lightning invoice, or a Flash request. */
export const paymentRequested = (t: Pick<Task, "invoice" | "invoice_source">) =>
  !!t.invoice || t.invoice_source === "flash";
