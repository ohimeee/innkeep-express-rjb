export const GuestDetails: React.FC = () => {
  return (
    <div className="flex flex-col">
      <p className="mt-5 text-xl font-bold">Guest details</p>
      <p className="my-2 w-1/2 text-xs text-gray-500">
        The reservation is held under this name. Enter it exactly as it appears
        on the ID presented at check-in.
      </p>
      <label htmlFor="full-name" className="mt-2 text-xs text-gray-500">
        Full name on reservation
      </label>
      {/* `name` is what puts this in the FormData the checkout page reads.
          Without it the field is not submitted at all. */}
      <input
        className="w-3/4 border-2 border-gray-400 bg-gray-200 p-2"
        type="text"
        id="full-name"
        name="guestName"
        required
        maxLength={120}
        placeholder="e.g. Jordan Ellison"
      />
    </div>
  );
};
