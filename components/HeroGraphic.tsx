import { cn } from '@/lib/utils'

const orb =
  'bg-[radial-gradient(circle_at_32%_28%,color-mix(in_oklab,var(--chart-3),white_50%),var(--chart-3)_55%,color-mix(in_oklab,var(--chart-3),black_22%))]'

// Decorative marketing panel for the auth split-screen — arches rising toward
// a guide circle, echoing the growth/organization theme. See
// assets/brand/fortuneer-hero.dc.html for the source design.
//
// Elements build up in a staggered sequence on mount (ring, then arches
// low-to-high, then orbs, then copy) before settling into the idle float
// loops — see (auth)/layout.tsx, which also uses this full-bleed as a splash.
export default function HeroGraphic({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden bg-background',
        className
      )}
    >
      <div className="absolute top-10 left-11 z-10 flex items-center gap-2.5 animate-[ft-fade-down_0.5s_ease-out_both]">
        <div className={cn('size-[11px] rounded-full', orb)} />
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Fortuneer
        </span>
      </div>

      <div className="relative mt-[-2%] w-[min(80%,410px)] -translate-x-[7%] aspect-[0.92]">
        {/* architectural guide circle */}
        <div className="absolute top-[1%] left-1/2 z-0 aspect-square w-[74%] -translate-x-1/2 rounded-full border border-foreground/12 animate-[ft-scale-in_0.6s_ease-out_0.1s_both]" />
        {/* orbiting node on the guide circle */}
        <div className="absolute top-[-1.2%] left-[47%] z-1 aspect-square w-[4.2%] animate-[ft-pop-in_0.5s_ease-out_0.5s_both,ft-float-sm_7s_ease-in-out_infinite_0.5s] rounded-full bg-primary shadow-[0_8px_14px_-6px_rgba(0,0,0,0.35)]" />
        {/* floating ring, upper left */}
        <div className="absolute top-[13%] left-[6%] z-1 box-border aspect-square w-[15%] animate-[ft-pop-in_0.6s_ease-out_0.25s_both,ft-float_9s_ease-in-out_infinite_0.25s] rounded-full border-[0.62em] border-foreground shadow-[0_18px_30px_-18px_rgba(0,0,0,0.35)]" />

        {/* baseline */}
        <div className="absolute right-[-4%] bottom-0 left-[-4%] z-2 h-0.5 bg-foreground/16 animate-[ft-draw_0.6s_ease-out_0.15s_both]" />

        {/* arch 1 — card */}
        <div className="absolute bottom-0.5 left-[2%] z-2 h-[34%] w-[22%] rounded-t-full border border-border bg-card shadow-[0_24px_44px_-24px_rgba(0,0,0,0.22)] animate-[ft-rise_0.55s_ease-out_0.3s_both]" />
        {/* arch 2 — primary */}
        <div className="absolute bottom-0.5 left-[28%] z-2 h-[52%] w-[22%] rounded-t-full bg-primary shadow-[0_26px_48px_-24px_rgba(0,0,0,0.3)] animate-[ft-rise_0.55s_ease-out_0.4s_both]" />
        {/* arch 3 — foreground */}
        <div className="absolute bottom-0.5 left-[54%] z-2 h-[68%] w-[22%] rounded-t-full bg-foreground shadow-[0_28px_52px_-24px_rgba(0,0,0,0.32)] animate-[ft-rise_0.55s_ease-out_0.5s_both]" />
        {/* pillar */}
        <div className="absolute bottom-0.5 left-[85%] z-2 h-[74%] w-[3%] rounded-full bg-foreground/34 animate-[ft-rise_0.55s_ease-out_0.55s_both]" />

        {/* dome on arch 2 */}
        <div className="absolute bottom-[52%] left-[34%] z-3 box-border h-[5%] w-[10%] rounded-t-full border border-b-0 border-border bg-card animate-[ft-fade_0.4s_ease-out_0.65s_both]" />

        {/* rising orbs */}
        <div
          className={cn(
            'absolute bottom-[34%] left-[8.5%] z-3 aspect-square w-[9%] animate-[ft-pop-in_0.5s_ease-out_0.6s_both,ft-float-sm_6s_ease-in-out_infinite_0.6s] rounded-full shadow-[0_16px_26px_-12px_rgba(0,0,0,0.38)]',
            orb
          )}
        />
        <div
          className={cn(
            'absolute bottom-[68%] left-[59.5%] z-3 aspect-square w-[11%] animate-[ft-pop-in_0.5s_ease-out_0.7s_both,ft-float-sm_6s_ease-in-out_infinite_0.8s] rounded-full shadow-[0_18px_30px_-12px_rgba(0,0,0,0.4)]',
            orb
          )}
        />
        <div
          className={cn(
            'absolute bottom-[72.5%] left-[79.75%] z-3 aspect-square w-[13.5%] animate-[ft-pop-in_0.5s_ease-out_0.8s_both,ft-float_7.5s_ease-in-out_infinite_0.4s] rounded-full shadow-[0_20px_34px_-12px_rgba(0,0,0,0.42)]',
            orb
          )}
        />
      </div>

      <div className="absolute right-0 bottom-10 left-0 z-10 flex flex-col items-center gap-1.5 px-8 text-center text-balance animate-[ft-fade-up_0.5s_ease-out_0.75s_both]">
        <div className="text-[17px] font-semibold tracking-tight text-foreground">
          Organized growth, by design.
        </div>
        <div className="text-[13px] text-muted-foreground">
          Your financial architecture, one balanced piece at a time.
        </div>
      </div>
    </div>
  )
}
