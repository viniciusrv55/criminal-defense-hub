import { User } from 'lucide-react';
import type { FeaturedAttorney } from '@/hooks/useFeaturedAttorneys';

interface Props {
  attorney: FeaturedAttorney;
  variant?: 'default' | 'compact';
}

export const AttorneyCard = ({ attorney, variant = 'default' }: Props) => {
  const size = variant === 'compact' ? 'w-28 h-28' : 'w-36 h-36';
  return (
    <div className="flex items-center gap-5 p-6 rounded-2xl bg-black border border-gold/40 shadow-[0_4px_20px_-4px_hsla(37,52%,61%,0.15)] min-w-[320px]">
      <div className={`${size} flex-shrink-0 rounded-full overflow-hidden border-2 border-gold/60 bg-neutral-900 flex items-center justify-center`}>
        {attorney.photo_url ? (
          <img src={attorney.photo_url} alt={attorney.full_name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <User className="w-12 h-12 text-gold/50" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-serif text-xl font-bold text-white leading-tight">{attorney.full_name}</h3>
        {attorney.specialty && (
          <p className="text-gold text-sm font-light mt-1">{attorney.specialty}</p>
        )}
        {attorney.oab_number && (
          <p className="text-neutral-300 text-xs font-light mt-2 tracking-wide">OAB {attorney.oab_number}</p>
        )}
      </div>
    </div>
  );
};
