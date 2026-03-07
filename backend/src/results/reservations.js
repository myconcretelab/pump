import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import logger from '../logger.js';

function parseJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function formatGuestName(guestInfo = {}) {
  return [guestInfo.firstName, guestInfo.lastName]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join(' ');
}

function parseCurrencyAmount(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(value, daysToAdd) {
  if (!isIsoDate(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map((part) => Number(part));
  const utcDate = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  return utcDate.toISOString().slice(0, 10);
}

function getReservationKey(listingId, confirmationCode, checkIn, checkOut) {
  return [listingId || 'unknown', confirmationCode || 'unknown', checkIn || 'unknown', checkOut || 'unknown'].join(
    '|'
  );
}

function getBlockedReservationKey(listingId, checkIn, checkOut, note) {
  return [listingId || 'unknown', 'blocked', checkIn || 'unknown', checkOut || 'unknown', note || 'no-note'].join(
    '|'
  );
}

function isListingsAndCalendarsResponse(url, body) {
  return (
    String(url || '').includes('multicalListingsAndCalendars') ||
    Boolean(body?.data?.patek?.getMultiCalendarListingsAndCalendars)
  );
}

function isAdditionalReservationDataResponse(url, body) {
  return (
    String(url || '').includes('multicalAdditionalReservationData') ||
    Boolean(body?.data?.patek?.getAdditionalReservationData)
  );
}

function mergeReservation(existing, next) {
  if (!existing) {
    return next;
  }

  return {
    ...existing,
    ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== null && value !== undefined && value !== '')),
    payout: next.payout ?? existing.payout ?? null,
    payoutFormatted: next.payoutFormatted || existing.payoutFormatted || null,
    listingNickname: next.listingNickname || existing.listingNickname || null,
    listingName: next.listingName || existing.listingName || null,
    guestName: next.guestName || existing.guestName || null,
    guestFirstName: next.guestFirstName || existing.guestFirstName || null,
    guestLastName: next.guestLastName || existing.guestLastName || null,
    note: next.note || existing.note || null,
  };
}

function collectListingDetails(body, listingById) {
  const listings =
    body?.data?.patek?.getMultiCalendarListingsAndCalendars?.multiCalendarListingsAttributes?.multiCalendarListings || [];

  for (const listing of listings) {
    const listingId = String(listing?.listingId || '').trim();
    if (!listingId) {
      continue;
    }

    listingById.set(listingId, {
      listingId,
      listingName: listing.listingNameOrPlaceholderName || null,
      listingNickname: listing.nickname || null,
      listingThumbnailUrl: listing.listingThumbnailUrl || null,
    });
  }
}

function getDayReservation(day) {
  const reservation = day?.unavailabilityReasons?.reservation;
  if (!reservation?.confirmationCode || !reservation?.startDate || !reservation?.endDate) {
    return null;
  }

  return reservation;
}

function getDayNote(day) {
  const candidates = [
    day?.notes,
    day?.note,
    day?.unavailabilityReasons?.notes,
    day?.unavailabilityReasons?.note,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function collectReservations(body, listingById, reservationsByKey) {
  const calendars = body?.data?.patek?.getMultiCalendarListingsAndCalendars?.hostCalendarsResponse?.calendars || [];

  for (const calendar of calendars) {
    for (const day of calendar?.days || []) {
      const reservation = getDayReservation(day);
      if (!reservation) {
        continue;
      }

      const listingId = String(day?.listingId || reservation?.hostingId || '').trim();
      const listing = listingById.get(listingId) || {};
      const guestName = formatGuestName(reservation.guestInfo);
      const nextReservation = {
        id: getReservationKey(listingId, reservation.confirmationCode, reservation.startDate, reservation.endDate),
        type: 'airbnb',
        source: 'airbnb',
        confirmationCode: reservation.confirmationCode,
        listingId: listingId || null,
        listingName: listing.listingName || null,
        listingNickname: listing.listingNickname || null,
        listingThumbnailUrl: listing.listingThumbnailUrl || null,
        guestName: guestName || null,
        guestFirstName: reservation?.guestInfo?.firstName || null,
        guestLastName: reservation?.guestInfo?.lastName || null,
        guestUserId: reservation?.guestInfo?.userId || null,
        checkIn: reservation.startDate,
        checkOut: reservation.endDate,
        nights: reservation.nights ?? null,
        guestCount: reservation.numberOfGuests ?? null,
        adults: reservation.numberOfAdults ?? null,
        children: reservation.numberOfChildren ?? null,
        infants: reservation.numberOfInfants ?? null,
        basePrice: reservation.basePrice ?? null,
        currency: reservation.hostCurrency || null,
        status: reservation.statusString || null,
        payout: null,
        payoutFormatted: null,
        note: getDayNote(day) || normalizeString(reservation?.notes),
      };

      const key = nextReservation.id;
      reservationsByKey.set(key, mergeReservation(reservationsByKey.get(key), nextReservation));
    }
  }
}

function collectBlockedDateNotes(body, blockedDaysByKey) {
  const calendars = body?.data?.patek?.getMultiCalendarListingsAndCalendars?.hostCalendarsResponse?.calendars || [];

  for (const calendar of calendars) {
    for (const day of calendar?.days || []) {
      if (!isIsoDate(day?.day)) {
        continue;
      }

      const reservation = getDayReservation(day);
      const note = getDayNote(day);
      const reasons = day?.unavailabilityReasons || {};

      if (reservation || !note) {
        continue;
      }

      const isBlockedByHost =
        day?.available === false &&
        day?.bookable === false &&
        reasons?.reservation == null &&
        (reasons?.hostBusy === true || reasons?.busySubtype === 'HOST_BUSY');

      if (!isBlockedByHost) {
        continue;
      }

      const listingId = String(day?.listingId || calendar?.listingId || '').trim();
      const key = `${listingId || 'unknown'}|${day.day}`;
      const existing = blockedDaysByKey.get(key);

      blockedDaysByKey.set(key, {
        ...(existing || {}),
        listingId,
        note,
        day: day.day,
        busySubtype: existing?.busySubtype || reasons?.busySubtype || null,
        hostBusy: existing?.hostBusy ?? reasons?.hostBusy ?? null,
      });
    }
  }
}

function finalizeBlockedDateNotes(blockedDaysByKey, listingById, reservationsByKey) {
  const blockedDays = [...blockedDaysByKey.values()].sort((left, right) => {
    if (left.listingId !== right.listingId) {
      return String(left.listingId || '').localeCompare(String(right.listingId || ''));
    }

    if (left.note !== right.note) {
      return String(left.note || '').localeCompare(String(right.note || ''));
    }

    return String(left.day || '').localeCompare(String(right.day || ''));
  });

  let currentBlock = null;

  const flushCurrentBlock = () => {
    if (!currentBlock) {
      return;
    }

    const listing = listingById.get(currentBlock.listingId) || {};
    const checkOut = addDays(currentBlock.endDate, 1) || currentBlock.endDate;
    const nextReservation = {
      id: getBlockedReservationKey(
        currentBlock.listingId,
        currentBlock.startDate,
        checkOut,
        currentBlock.note
      ),
      type: 'blocked',
      source: 'calendar-note',
      confirmationCode: null,
      listingId: currentBlock.listingId || null,
      listingName: listing.listingName || null,
      listingNickname: listing.listingNickname || null,
      listingThumbnailUrl: listing.listingThumbnailUrl || null,
      guestName: null,
      guestFirstName: null,
      guestLastName: null,
      guestUserId: null,
      checkIn: currentBlock.startDate,
      checkOut,
      nights: currentBlock.dayCount,
      guestCount: null,
      adults: null,
      children: null,
      infants: null,
      basePrice: null,
      currency: null,
      status: 'blocked',
      payout: null,
      payoutFormatted: null,
      note: currentBlock.note,
      busySubtype: currentBlock.busySubtype || null,
      hostBusy: currentBlock.hostBusy ?? null,
    };

    reservationsByKey.set(
      nextReservation.id,
      mergeReservation(reservationsByKey.get(nextReservation.id), nextReservation)
    );
    currentBlock = null;
  };

  for (const blockedDay of blockedDays) {
    const expectedNextDay =
      currentBlock &&
      currentBlock.listingId === blockedDay.listingId &&
      currentBlock.note === blockedDay.note
        ? addDays(currentBlock.endDate, 1)
        : null;

    if (
      currentBlock &&
      currentBlock.listingId === blockedDay.listingId &&
      currentBlock.note === blockedDay.note &&
      expectedNextDay === blockedDay.day
    ) {
      currentBlock.endDate = blockedDay.day;
      currentBlock.dayCount += 1;
      currentBlock.busySubtype = currentBlock.busySubtype || blockedDay.busySubtype || null;
      currentBlock.hostBusy = currentBlock.hostBusy ?? blockedDay.hostBusy ?? null;
      continue;
    }

    flushCurrentBlock();
    currentBlock = {
      listingId: blockedDay.listingId,
      note: blockedDay.note,
      startDate: blockedDay.day,
      endDate: blockedDay.day,
      dayCount: 1,
      busySubtype: blockedDay.busySubtype || null,
      hostBusy: blockedDay.hostBusy ?? null,
    };
  }

  flushCurrentBlock();
}

function collectAdditionalReservationData(body, payoutByConfirmationCode) {
  const resources = body?.data?.patek?.getAdditionalReservationData?.reservationResources || [];

  for (const resource of resources) {
    const confirmationCode = String(resource?.confirmationCode || '').trim();
    if (!confirmationCode) {
      continue;
    }

    const payoutFormatted = resource.hostPayoutFormatted || null;
    const payout = parseCurrencyAmount(payoutFormatted);

    payoutByConfirmationCode.set(confirmationCode, {
      payout,
      payoutFormatted,
      status: resource.hostFacingStatus || null,
    });
  }
}

export function extractReservationsFromSession(storageDir) {
  const metadataPath = join(storageDir, 'metadata.json');
  if (!existsSync(metadataPath)) {
    return {
      reservations: [],
      stats: {
        inspectedResponses: 0,
        matchedResponses: 0,
      },
    };
  }

  const metadata = parseJsonFile(metadataPath);
  const listingById = new Map();
  const reservationsByKey = new Map();
  const payoutByConfirmationCode = new Map();
  const blockedDaysByKey = new Map();
  let inspectedResponses = 0;
  let matchedResponses = 0;

  for (const response of metadata.responses || []) {
    if (!response?.filename) {
      continue;
    }

    const responsePath = join(storageDir, 'responses', response.filename);
    if (!existsSync(responsePath)) {
      continue;
    }

    let fullResponse;
    try {
      fullResponse = parseJsonFile(responsePath);
    } catch (err) {
      logger.warn('Failed to parse saved response while extracting reservations', {
        error: err.message,
        filename: response.filename,
      });
      continue;
    }

    const body = fullResponse?.body;
    if (!body || typeof body !== 'object') {
      continue;
    }

    inspectedResponses += 1;

    if (isListingsAndCalendarsResponse(response.url, body)) {
      matchedResponses += 1;
      collectListingDetails(body, listingById);
      collectReservations(body, listingById, reservationsByKey);
      collectBlockedDateNotes(body, blockedDaysByKey);
      continue;
    }

    if (isAdditionalReservationDataResponse(response.url, body)) {
      matchedResponses += 1;
      collectAdditionalReservationData(body, payoutByConfirmationCode);
    }
  }

  for (const [key, reservation] of reservationsByKey.entries()) {
    const payoutData = payoutByConfirmationCode.get(reservation.confirmationCode);
    if (!payoutData) {
      continue;
    }

    reservationsByKey.set(key, mergeReservation(reservation, payoutData));
  }

  finalizeBlockedDateNotes(blockedDaysByKey, listingById, reservationsByKey);

  const reservations = [...reservationsByKey.values()].sort((left, right) => {
    if (left.checkIn !== right.checkIn) {
      return String(left.checkIn).localeCompare(String(right.checkIn));
    }

    if (left.listingName !== right.listingName) {
      return String(left.listingName || '').localeCompare(String(right.listingName || ''));
    }

    return String(left.guestName || left.note || '').localeCompare(String(right.guestName || right.note || ''));
  });

  return {
    reservations,
    stats: {
      inspectedResponses,
      matchedResponses,
    },
  };
}

export default {
  extractReservationsFromSession,
};
