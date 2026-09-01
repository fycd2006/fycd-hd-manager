import * as React from 'react';
import { useInView, type UseInViewOptions } from 'motion/react';

interface UseIsInViewOptions {
  inView?: boolean;
  inViewOnce?: boolean;
  inViewMargin?: UseInViewOptions['margin'];
}

function useIsInView<T extends HTMLElement = HTMLElement>(
  ref: React.Ref<T>,
  options: UseIsInViewOptions = {},
) {
  const { inView = false, inViewOnce = false, inViewMargin = '0px' } = options;
  const localRef = React.useRef<T>(null);
  React.useImperativeHandle(ref, () => localRef.current as T);

  const hasIntersectionObserver =
    typeof window !== 'undefined' && typeof window.IntersectionObserver !== 'undefined';

  const inViewResult = useInView(hasIntersectionObserver && inView ? localRef : { current: null }, {
    once: inViewOnce,
    margin: inViewMargin,
  });

  const isInView = !inView || !hasIntersectionObserver || inViewResult;
  return { ref: localRef, isInView };
}

export { useIsInView, type UseIsInViewOptions };
