import { memo } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CheckboxProps {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Passed to the underlying <input> so a <label htmlFor={id}> can drive it */
  id?: string;
  disabled?: boolean;
  /** Extra classes for the outer wrapper span */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Fully custom checkbox.
 *
 * The native <input type="checkbox"> is hidden but remains in the DOM so that
 * keyboard focus, htmlFor association, and form semantics all work correctly.
 * The visible box and checkmark are rendered as sibling <span> elements and
 * respond to the input's :checked / :focus-visible / :disabled state through
 * Tailwind's `peer-*` variants.
 */
const Checkbox = memo(function Checkbox({
  checked,
  onChange,
  id,
  disabled = false,
  className = '',
}: CheckboxProps) {
  return (
    <span
      className={`relative inline-flex flex-shrink-0 w-[18px] h-[18px] ${className}`}
    >
      {/* Hidden native input — covers the full area so clicks register */}
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />

      {/* Custom visual box */}
      <span
        className={[
          // Size and shape
          'w-[18px] h-[18px] rounded-[4px] border-2',
          // Layout for centring the checkmark
          'flex items-center justify-center',
          // Non-interactive so clicks fall through to the hidden input
          'pointer-events-none',
          // Smooth transitions for all visual states
          'transition-all duration-150',
          // Colour: filled when checked, outlined when not
          checked
            ? 'bg-primary border-primary'
            : 'border-gray-300 bg-white peer-hover:border-primary/60',
          // Focus ring (shows only on keyboard navigation)
          'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-1',
          // Disabled appearance
          disabled ? 'opacity-40' : '',
        ].join(' ')}
      >
        {/* Checkmark SVG — fades and scales in when checked */}
        <svg
          viewBox="0 0 11 9"
          width="11"
          height="9"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-all duration-150 ${
            checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}
          aria-hidden="true"
        >
          {/* Clean two-segment tick: short left stroke, longer right stroke */}
          <polyline points="1,4.5 4,7.5 10,1" />
        </svg>
      </span>
    </span>
  );
});

export default Checkbox;
