import { useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { RootState } from '@/store';

/**
 * Typed version of `useSelector`.
 * Always use this hook to get state slices — it preserves full TypeScript
 * inference without manual generic annotations.
 */
const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export default useAppSelector;
