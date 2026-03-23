import React, { useState, CSSProperties } from "react";

interface SliderProps {
  images: string[];
  height?: number | string;
}

export default function Slider({ images, height = 256 }: SliderProps) {
  const [current, setCurrent] = useState(0);
  const last = images.length - 1;

  // Если изображений нет, ничего не рендерим (или можно вернуть null)
  if (!images || images.length === 0) return null;

  const containerStyle: CSSProperties = {
    position: "relative",
    width: "100%", // Responsive width
    height: typeof height === "number" ? `${height}px` : height,
    overflow: "hidden",
    borderRadius: 0, // Parent container handles border radius usually, or set to 10
  };

  const trackStyle: CSSProperties = {
    display: "flex",
    width: `${images.length * 100}%`, // Width relative to number of slides
    height: "100%",
    transform: `translateX(-${current * (100 / images.length)}%)`, // Shift by percentage
    transition: "transform 0.5s ease-in-out",
  };

  const slideStyle: CSSProperties = {
    width: `${100 / images.length}%`, // Each slide takes up equal portion
    height: "100%",
    flexShrink: 0,
    objectFit: "cover",
  };

  const arrowBase: CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 28,
    height: 28,
    cursor: "pointer",
    background: "rgba(0,0,0,0.3)", // Slight background for better visibility
    borderRadius: "50%",
    border: "none",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  };

  const prevStyle: CSSProperties = {
    ...arrowBase,
    left: 12,
  };
  const nextStyle: CSSProperties = {
    ...arrowBase,
    right: 12,
  };

  const paginationStyle: CSSProperties = {
    position: "absolute",
    bottom: 12,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 8,
    zIndex: 10,
  };

  // Only show controls if more than 1 image
  const showControls = images.length > 1;

  return (
    <div style={containerStyle} className="group">
      <div style={trackStyle}>
        {images.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt={`Slide ${idx}`}
            style={slideStyle}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/load-error-placeholder.png";
            }}
          />
        ))}
      </div>

      {showControls && (
        <>
          <button
            style={prevStyle}
            onClick={(e) => {
              e.stopPropagation();
              setCurrent(current === 0 ? last : current - 1);
            }}
            aria-label="Previous slide"
            className="hover:bg-black/50 transition-colors"
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0 8C0 3.58172 3.58172 0 8 0H20C24.4183 0 28 3.58172 28 8V20C28 24.4183 24.4183 28 20 28H8C3.58172 28 0 24.4183 0 20V8Z"
                fill="transparent"
              />
              <path
                d="M16 9L12 14L16 19"
                stroke="#ECF2F3"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            style={nextStyle}
            onClick={(e) => {
              e.stopPropagation();
              setCurrent(current === last ? 0 : current + 1);
            }}
            aria-label="Next slide"
            className="hover:bg-black/50 transition-colors"
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0 8C0 3.58172 3.58172 0 8 0H20C24.4183 0 28 3.58172 28 8V20C28 24.4183 24.4183 28 20 28H8C3.58172 28 0 24.4183 0 20V8Z"
                fill="transparent"
              />
              <path
                d="M12 9L16 14L12 19"
                stroke="#ECF2F3"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div style={paginationStyle}>
            {images.map((_, idx) =>
              idx === current ? (
                <svg
                  key={idx}
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="6" cy="6" r="5" fill="#ffffff" stroke="#42acc1" strokeWidth="2" />
                </svg>
              ) : (
                <svg
                  key={idx}
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="6" cy="6" r="5" fill="transparent" stroke="#42acc1" strokeWidth="2" />
                </svg>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
