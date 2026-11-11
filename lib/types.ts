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

export interface Profile {
  id: string;
  name: string;
  lightning_address: string | null;
  skills: string | null;
  trezor_address: string | null;
  trezor_message: string | null;
  trezor_signature: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: Category;
  budget_sats: number;
  deadline: string; // YYYY-MM-DD
  contact: string;
  status: TaskStatus;
  poster_id: string;
  poster_name: string;
  assignee_id: string | null;
  assignee_name: string | null;
  invoice: string | null;
  delivery_note: string | null;
  preimage: string | null;
  created_at: string;
  accepted_at: string | null;
  invoiced_at: string | null;
  completed_at: string | null;
  // commitment bond (see lib/escrow.ts); null on tasks made before escrow existed
  bond_sats: number | null;
  bond_status: BondStatus | null;
  bond_invoice: string | null;
}

export type NewTask = Pick<
  Task,
  "title" | "description" | "category" | "budget_sats" | "deadline" | "contact"
>;
