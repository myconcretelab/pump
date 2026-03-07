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

function getReservationKey(listingId, confirmationCode, checkIn, checkOut) {
  return [listingId || 'unknown', confirmationCode || 'unknown', checkIn || 'unknown', checkOut || 'unknown'].join(
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

function collectReservations(body, listingById, reservationsByKey) {
  const calendars = body?.data?.patek?.getMultiCalendarListingsAndCalendars?.hostCalendarsResponse?.calendars || [];

  for (const calendar of calendars) {
    for (const day of calendar?.days || []) {
      const reservation = day?.unavailabilityReasons?.reservation;
      if (!reservation?.confirmationCode || !reservation?.startDate || !reservation?.endDate) {
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
      };

      const key = nextReservation.id;
      reservationsByKey.set(key, mergeReservation(reservationsByKey.get(key), nextReservation));
    }
  }
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

  const reservations = [...reservationsByKey.values()].sort((left, right) => {
    if (left.checkIn !== right.checkIn) {
      return String(left.checkIn).localeCompare(String(right.checkIn));
    }

    if (left.listingName !== right.listingName) {
      return String(left.listingName || '').localeCompare(String(right.listingName || ''));
    }

    return String(left.guestName || '').localeCompare(String(right.guestName || ''));
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
