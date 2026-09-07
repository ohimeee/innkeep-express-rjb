import { MoveRight } from "lucide-react";

/**
 * Submits the checkout form.
 *
 * Disabled while the request is in flight, which matters more than usual here: the click
 * holds a room and opens an invoice, so a double submit is two holds on two
 * rooms. The exclusion constraint would refuse the second, but the guest should
 * never get far enough to see that.
 */
interface ConfirmButtonProps {
  pending: boolean;
}

export const ConfirmButton: React.FC<ConfirmButtonProps> = ({ pending }) => {
  return (
    <button
      type="submit"
      disabled={pending}
      className="my-5 flex w-full items-center justify-between bg-orange-500 p-5 font-bold text-white disabled:cursor-not-allowed disabled:bg-orange-300"
    >
      <span>
        {pending ? "Taking you to payment..." : "Confirm reservation"}
      </span>
      <MoveRight className="size-5" />
    </button>
  );
};
