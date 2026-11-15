import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { Mark } from "@/components/Mark";

export default function Mobileheader() {
  return (
    <div className="mb-6 border-b border-gray-400/20 py-5 md:hidden">
      <Link
        href="/"
        aria-label="Workbolt home"
        className="mx-auto flex w-[90%] items-center gap-1"
      >
        <Mark size={34} />
        <Wordmark className="text-2xl" />
      </Link>
    </div>
  );
}
