import logger from '../logger.js';
import utils from './utils.js';

async function scrollWithDirectModification(page, selector, config) {
  logger.info(`Scrolling ${selector} with direct modification strategy`);

  const { scrollCount, scrollDistance, scrollDelay } = config;

  for (let i = 0; i < scrollCount; i++) {
    try {
      const initialScroll = await utils.getScrollableInfo(page, selector);
      logger.debug(`Scroll iteration ${i + 1}/${scrollCount}`, {
        currentScrollLeft: initialScroll.scrollLeft,
      });

      // Scroll horizontally
      await page.evaluate(
        ({ sel, dist }) => {
          const el = document.querySelector(sel);
          if (el) {
            el.scrollLeft += dist;
          }
        },
        { sel: selector, dist: scrollDistance }
      );

      // Wait before next scroll
      if (i < scrollCount - 1) {
        await utils.wait(scrollDelay);
      }

      const finalScroll = await utils.getScrollableInfo(page, selector);
      logger.debug(`After scroll ${i + 1}`, {
        newScrollLeft: finalScroll.scrollLeft,
        maxScroll: finalScroll.scrollWidth - finalScroll.clientWidth,
      });

      if (finalScroll.scrollLeft === initialScroll.scrollLeft) {
        throw new Error(`Scroll position did not change for ${selector}`);
      }
    } catch (err) {
      logger.error(`Scroll iteration ${i + 1} failed`, { error: err.message });
      throw err;
    }
  }

  logger.info(`Scrolling completed (${scrollCount} iterations)`);
}

async function scrollWithMouseWheel(page, selector, config) {
  logger.info(`Scrolling ${selector} with mouse wheel strategy`);

  const { scrollCount, scrollDistance, scrollDelay } = config;

  try {
    // Get element bounds
    const bounds = await utils.getElementBounds(page, selector);
    if (!bounds) {
      throw new Error('Could not get element bounds for scroll');
    }

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    for (let i = 0; i < scrollCount; i++) {
      logger.debug(`Mouse wheel scroll ${i + 1}/${scrollCount}`);

      // Move mouse to center of element
      await page.mouse.move(centerX, centerY);

      await page.mouse.wheel(scrollDistance, 0);

      if (i < scrollCount - 1) {
        await utils.wait(scrollDelay || 1000);
      }
    }

    logger.info(`Mouse wheel scrolling completed (${scrollCount} iterations)`);
  } catch (err) {
    logger.error('Mouse wheel scrolling failed', { error: err.message });
    throw err;
  }
}

async function performScrolling(page, config) {
  const { scrollSelector } = config;

  // Some apps render the scroll container a few seconds after the route is loaded.
  const selectorReady = await utils.waitForElement(page, scrollSelector, {
    timeout: 15000,
    visible: true,
  });

  if (!selectorReady) {
    throw new Error(`Element not found: ${scrollSelector}`);
  }

  const resolvedTarget = await utils.resolveHorizontalScrollTarget(page, scrollSelector);

  if (!resolvedTarget.exists) {
    throw new Error(`Element not found: ${scrollSelector}`);
  }

  if (!resolvedTarget.isHorizontallyScrollable || !resolvedTarget.selector) {
    logger.warn('Element is not horizontally scrollable', resolvedTarget);
    throw new Error(`Element ${scrollSelector} is not horizontally scrollable`);
  }

  const effectiveSelector = resolvedTarget.selector;

  if (resolvedTarget.relation !== 'self') {
    logger.info('Resolved alternate horizontal scroll target', {
      requestedSelector: scrollSelector,
      effectiveSelector,
      relation: resolvedTarget.relation,
      depth: resolvedTarget.depth,
      overflowX: resolvedTarget.overflowX,
      canScrollProgrammatically: resolvedTarget.canScrollProgrammatically,
    });
  }

  logger.info('Element is scrollable, starting scroll sequence', {
    requestedSelector: scrollSelector,
    effectiveSelector,
  });

  // Use direct modification by default (most reliable for automation)
  try {
    await scrollWithDirectModification(page, effectiveSelector, config);
  } catch (err) {
    logger.error('Direct modification scroll failed, attempting mouse wheel fallback', {
      error: err.message,
    });
    try {
      await scrollWithMouseWheel(page, effectiveSelector, config);
    } catch (fallbackErr) {
      logger.error('Mouse wheel fallback also failed', { error: fallbackErr.message });
      throw fallbackErr;
    }
  }

  // Get final scroll position
  const finalInfo = await utils.getScrollableInfo(page, effectiveSelector);
  logger.info('Scroll sequence completed', {
    requestedSelector: scrollSelector,
    effectiveSelector,
    finalScrollLeft: finalInfo.scrollLeft,
    maxScrollLeft: finalInfo.scrollWidth - finalInfo.clientWidth,
  });

  return finalInfo;
}

export default {
  scrollWithDirectModification,
  scrollWithMouseWheel,
  performScrolling,
};
