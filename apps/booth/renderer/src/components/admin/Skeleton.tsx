import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`pb-shimmer rounded-lg ${className ?? ''}`} />
);

export const SkeletonText: React.FC<{ className?: string }> = ({ className }) => (
  <Skeleton className={`h-4 ${className ?? ''}`} />
);

export const SkeletonCard: React.FC = () => (
  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#241341] shadow-lg">
    <Skeleton className="aspect-[4/5] w-full rounded-none" />
    <div className="space-y-2 p-3">
      <SkeletonText className="w-3/4" />
      <SkeletonText className="w-1/2 h-3" />
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className="space-y-2.5">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="flex items-center gap-4 rounded-lg bg-[#241341] px-4 py-4">
        <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
        <SkeletonText className="w-1/4" />
        <SkeletonText className="w-24" />
        <SkeletonText className="w-16 ml-auto" />
      </div>
    ))}
  </div>
);