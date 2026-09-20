import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type ResilientImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallbackClassName?: string;
  fallbackLabel?: string;
};

export function ResilientImage({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackLabel = "Image unavailable",
  onError,
  ...props
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={fallbackLabel}
        className={cn("w-full h-full bg-muted text-muted-foreground flex flex-col items-center justify-center gap-1.5", fallbackClassName)}
      >
        <ImageOff size={20} aria-hidden="true" />
        <span className="text-[10px] font-medium">Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}

export default ResilientImage;
