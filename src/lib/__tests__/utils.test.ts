import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTimeAgo, debounce, throttle } from '../utils.js';

describe('utils', () => {
  describe('formatTimeAgo', () => {
    beforeEach(() => {
      // Mock Date.now() to return a fixed timestamp
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2023, 0, 1, 12, 0, 0).getTime());
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns "Unknown" for invalid timestamps', () => {
      expect(formatTimeAgo(undefined as any)).toBe('Unknown');
      expect(formatTimeAgo(null as any)).toBe('Unknown');
      expect(formatTimeAgo(-1)).toBe('Unknown');
      expect(formatTimeAgo(0)).toBe('Unknown');
    });

    it('returns "Just now" for times less than 60 seconds ago', () => {
      const now = Date.now();
      expect(formatTimeAgo(now)).toBe('Just now');
      expect(formatTimeAgo(now - 30 * 1000)).toBe('Just now');
      expect(formatTimeAgo(now - 59 * 1000)).toBe('Just now');
    });

    it('returns formatted minutes for times between 1 and 59 minutes ago', () => {
      const now = Date.now();
      expect(formatTimeAgo(now - 60 * 1000)).toBe('1m ago');
      expect(formatTimeAgo(now - 30 * 60 * 1000)).toBe('30m ago');
      expect(formatTimeAgo(now - 59 * 60 * 1000)).toBe('59m ago');
    });

    it('returns formatted hours for times between 1 and 23 hours ago', () => {
      const now = Date.now();
      expect(formatTimeAgo(now - 60 * 60 * 1000)).toBe('1h ago');
      expect(formatTimeAgo(now - 12 * 60 * 60 * 1000)).toBe('12h ago');
      expect(formatTimeAgo(now - 23 * 60 * 60 * 1000)).toBe('23h ago');
    });

    it('returns formatted days for times 24 hours or more ago', () => {
      const now = Date.now();
      expect(formatTimeAgo(now - 24 * 60 * 60 * 1000)).toBe('1d ago');
      expect(formatTimeAgo(now - 2 * 24 * 60 * 60 * 1000)).toBe('2d ago');
      expect(formatTimeAgo(now - 30 * 24 * 60 * 60 * 1000)).toBe('30d ago');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should delay function execution until after delay has passed since last invocation', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 1000);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(fn).not.toHaveBeenCalled();

      debouncedFn(); // This should reset the timer
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(fn).not.toHaveBeenCalled(); // Still not 1000ms since the LAST call

      vi.advanceTimersByTime(500); // Now it's 1000ms since the LAST call
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the original function', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 1000);

      debouncedFn('arg1', 42);
      vi.advanceTimersByTime(1000);

      expect(fn).toHaveBeenCalledWith('arg1', 42);
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should invoke function immediately, then drop subsequent calls within the limit', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 1000);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);

      throttledFn();
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1); // Dropped

      vi.advanceTimersByTime(500);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1); // Dropped because limit hasn't passed

      vi.advanceTimersByTime(500); // 1000ms has passed
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2); // Accepted
    });

    it('should pass arguments to the original function', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 1000);

      throttledFn('arg1', 42);

      expect(fn).toHaveBeenCalledWith('arg1', 42);
    });
  });
});
