import { useGlobal } from "@/context/Global";
import { FormatHash } from "@/utils/FormatHash";

export const ExistingBatches = () => {
  const { batchIds } = useGlobal();

  return (
    <section className="flex flex-col bg-white p-10 text-black rounded-xl w-11/12 m-auto font-bold justify-between">
      <h1 className="text-2xl mb-4">Existing Batches</h1>
      {batchIds.length === 0 ? (
        <p>No batches found</p>
      ) : (
        <ul className="space-y-2">
          {batchIds.map((batchId) => (
            <li
              key={batchId}
              className="p-2 border-black border-2 rounded-xl group"
            >
              <p className="truncate group-hover:hidden">
                Batch ID: {FormatHash(batchId)}
              </p>
              <p className="hidden group-hover:block">Batch ID: {batchId}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
