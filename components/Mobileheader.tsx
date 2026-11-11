import { Wordmark } from "@/components/Wordmark";
import { Mark }from "@/components/Mark";

const Mobileheader = () => {
  return (
    <div className="mb-6 py-6 border-b border-gray-400/20">
        <div className="w-[90%] mx-auto flex items-center gap-1">
        <Mark size={34} />
        <Wordmark className="text-2xl lg:text-3xl" />
        </div>
    </div>
  )
}

export default Mobileheader