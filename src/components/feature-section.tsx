import Image from "next/image"
import { cn } from "@/lib/utils"

interface FeatureSectionProps {
  title: string
  description: string
  imageSrc: string
  imageAlt: string
  reversed?: boolean
}

export function FeatureSection({
  title,
  description,
  imageSrc,
  imageAlt,
  reversed = false,
}: FeatureSectionProps) {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div
          className={cn(
            "grid items-center gap-12 lg:grid-cols-2 lg:gap-20",
            reversed && "lg:grid-flow-col-dense"
          )}
        >
          {/* Image Side */}
          <div
            className={cn(
              "flex justify-center",
              reversed ? "lg:col-start-2" : "lg:col-start-1"
            )}
          >
            {/* Minimalist Laptop Mockup */}
            <div className="relative mx-auto w-full max-w-[650px]">
              <div className="relative rounded-xl border-[6px] border-zinc-900 bg-zinc-900 shadow-2xl shadow-black/20 dark:border-zinc-800 dark:bg-zinc-800 dark:shadow-black/40">
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-muted">
                  <Image
                    src={imageSrc}
                    alt={imageAlt}
                    fill
                    className="object-cover object-left-top"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
              </div>
              {/* Laptop Base */}
              <div className="relative mx-auto h-3 w-[112%] -translate-x-[5.35%] rounded-b-xl rounded-t-sm bg-zinc-400 dark:bg-zinc-700 shadow-md">
                <div className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-md bg-zinc-600 dark:bg-zinc-900" />
              </div>
            </div>
          </div>

          {/* Text Side */}
          <div
            className={cn(
              "flex flex-col space-y-6",
              reversed ? "lg:col-start-1" : "lg:col-start-2"
            )}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl text-foreground">
              {title}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-[550px]">
              {description}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
