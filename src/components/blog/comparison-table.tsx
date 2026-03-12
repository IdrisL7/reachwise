import React from 'react';
import { CheckIcon, XMarkIcon } from '@heroicons/react/20/solid'; // Assuming Heroicons for icons

interface ComparisonTableProps {
  features: {
    feature: string;
    getSignalHooks: boolean;
    competitor: boolean;
  }[];
  competitorName: string;
}

export function ComparisonTable({ features, competitorName }: ComparisonTableProps) {
  return (
    <div className="not-prose my-8 overflow-x-auto">
      <table className="w-full text-left border-collapse border border-zinc-700 rounded-lg">
        <thead>
          <tr className="bg-zinc-800">
            <th className="p-4 text-zinc-300 text-sm font-semibold border-b border-zinc-700">Feature</th>
            <th className="p-4 text-zinc-300 text-sm font-semibold border-b border-zinc-700">GetSignalHooks</th>
            <th className="p-4 text-zinc-300 text-sm font-semibold border-b border-zinc-700">{competitorName}</th>
          </tr>
        </thead>
        <tbody>
          {features.map((item, index) => (
            <tr key={index} className="border-b border-zinc-700 last:border-b-0">
              <td className="p-4 text-zinc-300 text-sm font-medium pr-8">
                {item.feature}
              </td>
              <td className={`p-4 text-sm ${item.getSignalHooks ? 'text-violet-400 font-semibold' : 'text-zinc-500'}`}>
                {item.getSignalHooks ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <XMarkIcon className="h-5 w-5" />
                )}
              </td>
              <td className={`p-4 text-sm ${item.competitor ? 'text-zinc-300' : 'text-zinc-500'}`}>
                {item.competitor ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <XMarkIcon className="h-5 w-5" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
