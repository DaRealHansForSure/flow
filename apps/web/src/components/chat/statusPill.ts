/**
 * Flow: one look for the pills above the composer (scroll to end, background work, browsers),
 * modelled on the mobile app's status pill: tall, round, outlined, parts split by dividers.
 */
export const STATUS_PILL_CLASS =
  "mx-auto inline-flex h-10 max-w-full min-w-0 items-center gap-2 rounded-full border border-(--floating-pill-border) bg-card/95 px-4 text-foreground text-sm shadow-sm backdrop-blur-sm sm:h-9 [&_svg]:size-4 [&_svg]:shrink-0";

/** A later part of a status pill, after a divider. */
export const STATUS_PILL_PART_CLASS =
  "flex shrink-0 items-center gap-1.5 self-stretch border-l border-border ps-3";
