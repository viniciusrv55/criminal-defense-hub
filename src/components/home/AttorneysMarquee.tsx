import { useFeaturedAttorneys } from '@/hooks/useFeaturedAttorneys';
import { AttorneyCard } from '@/components/AttorneyCard';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const AttorneysMarquee = () => {
  const { attorneys } = useFeaturedAttorneys(true);
  const { settings } = useSiteSettings();

  if (attorneys.length === 0) return null;

  // Duplicate list for seamless loop
  const list = [...attorneys, ...attorneys];

  return (
    <section className="section-padding bg-black border-y border-neutral-900 overflow-hidden">
      <div className="container-custom mb-10 text-center">
        <span className="text-gold text-sm font-semibold tracking-wider uppercase mb-3 block">
          {settings.attorneys_section_eyebrow || 'Nossa Equipe'}
        </span>
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-white">
          {settings.attorneys_section_title || 'Advogados que defendem você'}
        </h2>
      </div>

      <div className="group relative">
        <div
          className="flex gap-6 w-max animate-marquee group-hover:[animation-play-state:paused]"
          style={{ animationDuration: `${Math.max(20, attorneys.length * 8)}s` }}
        >
          {list.map((a, i) => (
            <AttorneyCard key={`${a.id}-${i}`} attorney={a} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default AttorneysMarquee;
