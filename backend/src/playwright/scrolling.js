import logger from '../logger.js';
import utils from './utils.js';

const DISTANCE_JITTER_RATIO = 0.12;
const DELAY_JITTER_RATIO = 0.18;

function getTriangularOffset() {
  return Math.random() - Math.random();
}

function getHumanizedValue(baseValue, jitterRatio, minimumValue) {
  const safeBaseValue = Math.max(minimumValue, Math.round(baseValue));
  const jitterRange = Math.max(1, Math.round(safeBaseValue * jitterRatio));
  const randomizedValue = safeBaseValue + Math.round(getTriangularOffset() * jitterRange);

  return Math.max(minimumValue, randomizedValue);
}

function getHumanizedScrollStep(config) {
  return {
    distance: getHumanizedValue(config.scrollDistance, DISTANCE_JITTER_RATIO, 1),
    delay: getHumanizedValue(config.scrollDelay, DELAY_JITTER_RATIO, 0),
  };
}

async function scrollWithDirectModification(page, selector, config) {
  logger.info(`Scrolling ${selector} with direct modification strategy`);

  const { scrollCount } = config;

  for (let i = 0; i < scrollCount; i++) {
    try {
      const { distance, delay } = getHumanizedScrollStep(config);
      const initialScroll = await utils.getScrollableInfo(page, selector);
      logger.debug(`Scroll iteration ${i + 1}/${scrollCount}`, {
        currentScrollLeft: initialScroll.scrollLeft,
        distance,
        delay: i < scrollCount - 1 ? delay : 0,
      });

      // Scroll horizontally
      await page.evaluate(
        ({ sel, dist }) => {
          const el = document.querySelector(sel);
          if (el) {
            el.scrollLeft += dist;
          }
        },
        { sel: selector, dist: distance }
      );

      // Wait before next scroll
      if (i < scrollCount - 1) {
        await utils.wait(delay);
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

  const { scrollCount } = config;

  try {
    // Get element bounds
    const bounds = await utils.getElementBounds(page, selector);
    if (!bounds) {
      throw new Error('Could not get element bounds for scroll');
    }

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    for (let i = 0; i < scrollCount; i++) {
      const { distance, delay } = getHumanizedScrollStep(config);
      const pointerOffsetX = getTriangularOffset() * Math.min(18, Math.max(6, bounds.width * 0.08));
      const pointerOffsetY = getTriangularOffset() * Math.min(12, Math.max(4, bounds.height * 0.08));

      logger.debug(`Mouse wheel scroll ${i + 1}/${scrollCount}`, {
        distance,
        delay: i < scrollCount - 1 ? delay : 0,
      });

      // Move mouse to center of element
      await page.mouse.move(centerX + pointerOffsetX, centerY + pointerOffsetY, {
        steps: 6 + Math.floor(Math.random() * 7),
      });

      await page.mouse.wheel(distance, 0);

      if (i < scrollCount - 1) {
        await utils.wait(delay);
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
