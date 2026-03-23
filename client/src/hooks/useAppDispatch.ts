import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';

/**
 * Typed version of `useDispatch`.
 * Always use this instead of the plain `useDispatch` hook so that
 * dispatch is aware of thunk action types.
 */
const useAppDispatch = () => useDispatch<AppDispatch>();
export default useAppDispatch;
