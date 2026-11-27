interface ProviderIconProps {
  /** URL of the logo image (e.g. an imported SVG from `src/assets/providers/`). */
  src: string;
  /** Accessible name for the logo, e.g. "OpenAI". Required; announced by screen readers. */
  alt: string;
  /** Outer diameter of the badge in pixels. Defaults to 40. */
  size?: number;
}

/**
 * Round, static badge showing a provider logo on a light background with a
 * subtle neutral border. Decorative container only: no text, hover state,
 * animation, or button semantics.
 *
 * The logo fills the badge box; official provider assets (e.g. OpenAI's
 * Blossom) already include generous built-in margins, which provides the
 * internal padding around the mark.
 */
export function ProviderIcon({ src, alt, size = 40 }: ProviderIconProps) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-white"
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        draggable={false}
        className="block select-none"
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </span>
  );
}

export default ProviderIcon;
