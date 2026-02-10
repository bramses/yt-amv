import React from "react";

export default function ValidationBanner({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;

  return (
    <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100">
      <div className="font-semibold">Fix these issues before playing</div>
      <ul className="mt-2 list-disc pl-5 text-sm text-rose-200">
        {errors.map((error, index) => (
          <li key={`${error}-${index}`}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
