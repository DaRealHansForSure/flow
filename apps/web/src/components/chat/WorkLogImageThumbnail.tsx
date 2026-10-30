import type { EnvironmentId } from "@t3tools/contracts";
import type { ViewedImageAsset } from "@t3tools/client-runtime/work-log/presentation";
import { useState, type KeyboardEvent, type MouseEvent } from "react";

import { useAssetUrlState } from "~/assets/assetUrls";
import type { ExpandedImagePreview } from "./ExpandedImagePreview";

/**
 * Flow: a small preview of the image a Read step looked at, shown at the end of the collapsed
 * row like Claude's step list. Clicking it opens the image viewer instead of the row.
 */
export function WorkLogImageThumbnail(props: {
  readonly environmentId: EnvironmentId;
  readonly image: ViewedImageAsset;
  readonly onImageExpand?: ((preview: ExpandedImagePreview) => void) | undefined;
}) {
  const { environmentId, image, onImageExpand } = props;
  const assetUrl = useAssetUrlState(environmentId, image.resource);
  const [failed, setFailed] = useState(false);
  if (assetUrl._tag !== "Success" || failed) {
    return null;
  }
  const src = assetUrl.url + image.srcFragment;
  const expand = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onImageExpand?.({ images: [{ src, name: image.alt }], index: 0 });
  };
  return (
    <button
      type="button"
      aria-label={`Preview ${image.alt}`}
      className="h-5 w-7 shrink-0 cursor-zoom-in overflow-hidden rounded-sm border border-border/70 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={expand}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          expand(event);
        }
      }}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="size-full object-cover"
        onError={() => setFailed(true)}
      />
    </button>
  );
}

const STACK_LIMIT = 3;

/**
 * Flow: the images of a folded group of Read steps, overlapped like a small deck. The whole row
 * is the group's button, so these only preview; each step row has its own clickable thumbnail.
 */
export function WorkLogImageStack(props: {
  readonly environmentId: EnvironmentId;
  readonly images: ReadonlyArray<ViewedImageAsset>;
}) {
  const { environmentId } = props;
  const images = [
    ...new Map(props.images.map((image) => [JSON.stringify(image.resource), image])).values(),
  ];
  if (images.length === 0) {
    return null;
  }
  const shown = images.slice(0, STACK_LIMIT);
  const hiddenCount = images.length - shown.length;
  return (
    <span aria-hidden className="flex shrink-0 items-center">
      <span className="flex -space-x-3.5">
        {shown.map((image) => (
          <StackedImage
            key={JSON.stringify(image.resource)}
            environmentId={environmentId}
            image={image}
          />
        ))}
      </span>
      {hiddenCount > 0 ? (
        <span className="ml-1 text-xs text-muted-foreground tabular-nums">+{hiddenCount}</span>
      ) : null}
    </span>
  );
}

function StackedImage(props: {
  readonly environmentId: EnvironmentId;
  readonly image: ViewedImageAsset;
}) {
  const assetUrl = useAssetUrlState(props.environmentId, props.image.resource);
  const [failed, setFailed] = useState(false);
  if (assetUrl._tag !== "Success" || failed) {
    return null;
  }
  return (
    <img
      src={assetUrl.url + props.image.srcFragment}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className="h-5 w-7 rounded-sm border border-background object-cover shadow-xs"
      onError={() => setFailed(true)}
    />
  );
}
