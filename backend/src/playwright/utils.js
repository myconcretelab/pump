import logger from '../logger.js';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForElement(page, selector, options = {}) {
  const { timeout = 10000, visible = true } = options;
  try {
    await page.waitForSelector(selector, { timeout, state: visible ? 'visible' : 'attached' });
    return true;
  } catch (err) {
    logger.warn(`Element not found: ${selector}`, { timeout });
    return false;
  }
}

async function waitForNavigation(page, options = {}) {
  const { timeout = 30000 } = options;
  try {
    await page.waitForLoadState('networkidle', { timeout });
    return true;
  } catch (err) {
    logger.warn('Network idle timeout', { timeout });
    return false;
  }
}

async function retry(fn, options = {}) {
  const { maxAttempts = 3, delayMs = 1000, name = 'operation' } = options;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug(`Attempt ${attempt}/${maxAttempts}: ${name}`);
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) {
        throw err;
      }
      logger.warn(`${name} failed, retrying...`, { attempt, error: err.message });
      await wait(delayMs);
    }
  }
}

async function getElementBounds(page, selector) {
  try {
    const element = await page.$(selector);
    if (!element) return null;
    
    const box = await element.boundingBox();
    return box;
  } catch (err) {
    logger.warn(`Could not get element bounds for ${selector}`, { error: err.message });
    return null;
  }
}

async function isElementScrollable(page, selector) {
  try {
    const result = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { exists: false };
      
      return {
        exists: true,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        isHorizontallyScrollable: el.scrollWidth > el.clientWidth,
        isVerticallyScrollable: el.scrollHeight > el.clientHeight,
      };
    }, selector);
    
    return result;
  } catch (err) {
    logger.error(`Error checking scrollability for ${selector}`, { error: err.message });
    return { exists: false };
  }
}

async function resolveHorizontalScrollTarget(page, selector) {
  try {
    return await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      if (!root) {
        return { exists: false, found: false };
      }

      function toCssSelector(el) {
        if (!el || !(el instanceof Element)) {
          return null;
        }

        if (el.id) {
          return `#${CSS.escape(el.id)}`;
        }

        const parts = [];
        let current = el;

        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
          let part = current.tagName.toLowerCase();

          if (current.classList.length > 0) {
            part += `.${Array.from(current.classList)
              .slice(0, 3)
              .map((name) => CSS.escape(name))
              .join('.')}`;
          }

          const parent = current.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(
              (child) => child.tagName === current.tagName
            );
            if (siblings.length > 1) {
              const index = siblings.indexOf(current) + 1;
              part += `:nth-of-type(${index})`;
            }
          }

          parts.unshift(part);
          current = parent;
        }

        return parts.join(' > ');
      }

      function getInfo(el, relation, depth) {
        const style = window.getComputedStyle(el);
        const overflowX = style.overflowX;
        const isHorizontallyScrollable = el.scrollWidth > el.clientWidth + 1;
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        const initialScrollLeft = el.scrollLeft;
        let canScrollProgrammatically = false;

        if (isHorizontallyScrollable) {
          const probeDistance = Math.min(32, Math.max(1, el.scrollWidth - el.clientWidth));
          try {
            el.scrollLeft = initialScrollLeft + probeDistance;
            canScrollProgrammatically = el.scrollLeft !== initialScrollLeft;
          } catch (err) {
            canScrollProgrammatically = false;
          } finally {
            el.scrollLeft = initialScrollLeft;
          }
        }

        const relationWeight =
          relation === 'self' ? 30 : relation === 'parent' ? Math.max(0, 24 - depth) : 12 - depth;
        const overflowWeight = ['auto', 'scroll', 'overlay', 'hidden'].includes(overflowX) ? 8 : 0;
        const score =
          (canScrollProgrammatically ? 1000 : 0) +
          (isHorizontallyScrollable ? 200 : 0) +
          (isVisible ? 50 : 0) +
          Math.max(relationWeight, 0) +
          overflowWeight;

        return {
          exists: true,
          found: true,
          relation,
          depth,
          selector: toCssSelector(el),
          tagName: el.tagName.toLowerCase(),
          className: el.className || '',
          overflowX,
          isVisible,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          isHorizontallyScrollable,
          isVerticallyScrollable: el.scrollHeight > el.clientHeight + 1,
          canScrollProgrammatically,
          score,
        };
      }

      const selfInfo = getInfo(root, 'self', 0);
      const candidates = [selfInfo];

      let current = root.parentElement;
      let depth = 1;
      while (current && depth <= 6) {
        candidates.push(getInfo(current, 'parent', depth));
        current = current.parentElement;
        depth += 1;
      }

      const queue = Array.from(root.children).map((child) => ({ el: child, depth: 1 }));
      while (queue.length > 0) {
        const { el, depth: childDepth } = queue.shift();
        candidates.push(getInfo(el, 'child', childDepth));

        if (childDepth < 6) {
          queue.push(...Array.from(el.children).map((child) => ({ el: child, depth: childDepth + 1 })));
        }
      }

      const bestCandidate = candidates
        .filter((candidate) => candidate.isHorizontallyScrollable)
        .sort((a, b) => b.score - a.score)[0];

      return bestCandidate || selfInfo;
    }, selector);
  } catch (err) {
    logger.error(`Error resolving scroll target for ${selector}`, { error: err.message });
    return { exists: false, found: false };
  }
}

async function getScrollableInfo(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    
    return {
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    };
  }, selector);
}

export default {
  wait,
  waitForElement,
  waitForNavigation,
  retry,
  getElementBounds,
  isElementScrollable,
  resolveHorizontalScrollTarget,
  getScrollableInfo,
};
