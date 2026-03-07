import React, { useEffect, useMemo, useState } from 'react';
import { configAPI, resultsAPI } from '../api/client';
import useStore from '../store/store';

export default function ResultsPanel({ sessionId, sessionData, status }) {
  const config = useStore((state) => state.config);
  const setConfig = useStore((state) => state.setConfig);

  const [metadata, setMetadata] = useState(null);
  const [reservationsData, setReservationsData] = useState({ reservations: [], stats: null });
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [selectedResponseData, setSelectedResponseData] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [filterMode, setFilterMode] = useState('all');
  const [hideNoise, setHideNoise] = useState(true);
  const [search, setSearch] = useState('');
  const [searchMatches, setSearchMatches] = useState({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsError, setReservationsError] = useState('');
  const [saveState, setSaveState] = useState(null);

  useEffect(() => {
    if ((status === 'completed' || status === 'stopped' || status === 'failed') && sessionId) {
      loadMetadata();
      loadReservations();
    }
  }, [status, sessionId]);

  useEffect(() => {
    if (!metadata?.responses?.length) {
      setSelectedResponse(null);
      setSelectedResponseData(null);
      return;
    }

    const nextSelected =
      metadata.responses.find((response) => getResponseKey(response) === getResponseKey(selectedResponse)) ||
      metadata.responses[0];

    handleSelectResponse(nextSelected);
  }, [metadata]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const query = search.trim();
    if (!query) {
      setSearchMatches({});
      setSearchLoading(false);
      return;
    }

    setSearchMatches({});

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const response = await resultsAPI.searchResponses(sessionId, query, 200, hideNoise);

        if (cancelled) {
          return;
        }

        const matches = Object.fromEntries(
          (response.data?.matches || []).map((match) => [match.key, match.snippet])
        );
        setSearchMatches(matches);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to search responses:', err);
          setSearchMatches({});
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [hideNoise, search, sessionId]);

  const visibleResponses = useMemo(() => {
    if (!metadata?.responses) {
      return [];
    }

    const term = search.trim();

    return metadata.responses.filter((response) => {
      if (filterMode === 'kept' && !response.keptByFilters) {
        return false;
      }

      if (filterMode === 'filtered' && response.keptByFilters) {
        return false;
      }

      if (hideNoise && isLikelyNoiseResponse(response)) {
        return false;
      }

      if (!term) {
        return true;
      }

      return Boolean(searchMatches[getResponseKey(response)]);
    });
  }, [filterMode, hideNoise, metadata, search, searchMatches]);

  const selectedCount = selectedKeys.length;
  const keptCount = metadata?.responses?.filter((response) => response.keptByFilters).length || 0;
  const filteredCount = metadata?.responses?.filter((response) => !response.keptByFilters).length || 0;
  const reservationCount = reservationsData?.reservations?.length || 0;

  async function loadMetadata() {
    try {
      setLoading(true);
      setSaveState(null);
      const response = await resultsAPI.getMetadata(sessionId);
      setMetadata(response.data);
      setSelectedKeys([]);
      setSearchMatches({});
    } catch (err) {
      console.error('Failed to load metadata:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadReservations() {
    try {
      setReservationsLoading(true);
      setReservationsError('');
      const response = await resultsAPI.getReservations(sessionId);
      setReservationsData({
        reservations: response.data?.reservations || [],
        stats: response.data?.stats || null,
      });
    } catch (err) {
      console.error('Failed to load extracted reservations:', err);
      setReservationsData({ reservations: [], stats: null });
      setReservationsError('Failed to extract reservations from the saved responses.');
    } finally {
      setReservationsLoading(false);
    }
  }

  async function handleSelectResponse(response) {
    if (!response) {
      return;
    }

    setSelectedResponse(response);

    if (!response.filename) {
      setSelectedResponseData(null);
      return;
    }

    try {
      setLoadingDetails(true);
      const detailResponse = await resultsAPI.getResponse(sessionId, response.filename);
      setSelectedResponseData(detailResponse.data);
    } catch (err) {
      console.error('Failed to load response details:', err);
      setSelectedResponseData(null);
    } finally {
      setLoadingDetails(false);
    }
  }

  function toggleSelection(response) {
    const key = getResponseKey(response);
    setSelectedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function selectVisible() {
    setSelectedKeys(uniqueKeys(visibleResponses.map((response) => getResponseKey(response))));
  }

  function selectKept() {
    const keptResponses = metadata?.responses?.filter((response) => response.keptByFilters) || [];
    setSelectedKeys(uniqueKeys(keptResponses.map((response) => getResponseKey(response))));
  }

  function clearSelection() {
    setSelectedKeys([]);
  }

  async function saveSelectionToFilters() {
    const selectedResponses = (metadata?.responses || []).filter((response) =>
      selectedKeys.includes(getResponseKey(response))
    );

    if (selectedResponses.length === 0) {
      setSaveState({ type: 'error', text: 'Select at least one request/response pair first.' });
      return;
    }

    const nextRules = buildFilterRulesFromSelection(config.filterRules, selectedResponses);
    const nextConfig = {
      ...config,
      filterRules: nextRules,
    };

    try {
      setSaveState({ type: 'pending', text: 'Saving selection to filter rules...' });
      await configAPI.saveConfig({ ...nextConfig, password: '' });
      setConfig(nextConfig);
      setSaveState({
        type: 'success',
        text: `Saved ${selectedResponses.length} selected response(s) into the current keep rules.`,
      });
    } catch (err) {
      const detail = err.response?.data?.error || err.message;
      setSaveState({ type: 'error', text: `Failed to save rules: ${detail}` });
    }
  }

  if (status === 'starting' || status === 'running') {
    return (
      <div className="text-slate-300 text-sm">
        <p>Session in progress. Captured request/response pairs will appear here when the run ends.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-slate-300 text-sm">
        <p>Loading results...</p>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="text-slate-300 text-sm">
        <p>No results available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {status === 'failed' && (
        <div className="text-red-300 text-sm">
          <p>Session failed. Partial results are shown if they were persisted.</p>
        </div>
      )}

      {status === 'stopped' && (
        <div className="text-orange-300 text-sm">
          <p>Session stopped. Partial results are shown if they were persisted.</p>
        </div>
      )}

      {sessionData?.results?.persistenceErrors?.length > 0 && (
        <div className="text-yellow-300 text-sm">
          <p>Some files could not be persisted completely.</p>
        </div>
      )}

      {saveState && (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            saveState.type === 'success'
              ? 'border-green-500/40 bg-green-950/40 text-green-300'
              : saveState.type === 'error'
                ? 'border-red-500/40 bg-red-950/40 text-red-300'
                : 'border-blue-500/40 bg-blue-950/40 text-blue-300'
          }`}
        >
          {saveState.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Reservations" value={reservationCount} valueClassName="text-emerald-300" />
        <StatCard label="Found" value={metadata.totalCaptured} valueClassName="text-cyan-300" />
        <StatCard label="Kept Now" value={keptCount} valueClassName="text-green-300" />
        <StatCard label="Filtered Now" value={filteredCount} valueClassName="text-orange-300" />
        <StatCard label="Selected" value={selectedCount} valueClassName="text-purple-300" />
      </div>

      <div className="rounded border border-slate-700 bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Reservations Found</p>
            <p className="mt-1 text-sm text-slate-300">
              Airbnb reservations extracted from the saved calendar responses.
            </p>
          </div>
          {reservationsData?.stats && (
            <p className="text-xs text-slate-500">
              {reservationsData.stats.matchedResponses} matched response(s)
            </p>
          )}
        </div>

        {reservationsLoading ? (
          <div className="p-4 text-sm text-slate-400">Extracting reservations...</div>
        ) : reservationsError ? (
          <div className="p-4 text-sm text-red-300">{reservationsError}</div>
        ) : reservationCount > 0 ? (
          <div className="max-h-[22rem] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-950/95 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Guest</th>
                  <th className="px-3 py-2 font-medium">Stay</th>
                  <th className="px-3 py-2 font-medium">Listing</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Code</th>
                </tr>
              </thead>
              <tbody>
                {reservationsData.reservations.map((reservation) => (
                  <ReservationRow key={reservation.id} reservation={reservation} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-sm text-slate-400">No reservations found in the saved responses.</div>
        )}
      </div>

      <div className="rounded border border-slate-700 bg-slate-900/70 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <ModeButton active={filterMode === 'all'} onClick={() => setFilterMode('all')}>
              All
            </ModeButton>
            <ModeButton active={filterMode === 'kept'} onClick={() => setFilterMode('kept')}>
              Kept
            </ModeButton>
            <ModeButton active={filterMode === 'filtered'} onClick={() => setFilterMode('filtered')}>
              Filtered
            </ModeButton>
            <ModeButton active={hideNoise} onClick={() => setHideNoise((current) => !current)}>
              Hide assets / tracking
            </ModeButton>
          </div>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search full response text, names, prices..."
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 lg:max-w-xs"
          />
        </div>

        {search.trim() && (
          <p className="mt-2 text-xs text-slate-400">
            {searchLoading
              ? 'Searching full saved responses...'
              : `${visibleResponses.length} full-text match(es)${hideNoise ? ' without assets/tracking' : ''}`}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={selectVisible}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs text-white transition hover:bg-slate-600"
          >
            Select visible
          </button>
          <button
            onClick={selectKept}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs text-white transition hover:bg-slate-600"
          >
            Select kept
          </button>
          <button
            onClick={clearSelection}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs text-white transition hover:bg-slate-600"
          >
            Clear selection
          </button>
          <button
            onClick={saveSelectionToFilters}
            className="rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-purple-700"
          >
            Add selection to keep rules
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded border border-slate-700 bg-slate-900/70">
          <div className="border-b border-slate-700 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Request / Response Pairs
          </div>

          <div className="max-h-[32rem] space-y-2 overflow-y-auto p-3">
            {visibleResponses.length > 0 ? (
              visibleResponses.map((response) => {
                const responseKey = getResponseKey(response);
                const isSelected = responseKey === getResponseKey(selectedResponse);
                const isChecked = selectedKeys.includes(responseKey);

                return (
                  <button
                    key={responseKey}
                    onClick={() => handleSelectResponse(response)}
                    className={`w-full rounded border p-3 text-left transition ${
                      isSelected
                        ? 'border-purple-500 bg-purple-600/10'
                        : 'border-slate-700 bg-slate-800/70 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelection(response)}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1 h-4 w-4"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-bold text-white">
                            {response.method}
                          </span>
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${getStatusColor(response.status)}`}>
                            {response.status}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              response.keptByFilters
                                ? 'bg-green-950/80 text-green-300'
                                : 'bg-orange-950/80 text-orange-300'
                            }`}
                          >
                            {response.keptByFilters ? 'KEPT' : 'FILTERED'}
                          </span>
                          <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                            {response.context || 'unknown'}
                          </span>
                        </div>

                        <p className="mt-2 truncate font-mono text-xs text-slate-200">{response.url}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {response.contentType || 'unknown content type'}
                        </p>
                        {searchMatches[responseKey] && (
                          <p className="mt-2 rounded bg-slate-950/80 px-2 py-1 font-mono text-xs text-cyan-200">
                            {searchMatches[responseKey]}
                          </p>
                        )}
                        <p className="mt-2 max-h-10 overflow-hidden text-xs text-slate-400">
                          {response.filterExplanation || 'No filter explanation'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-xs italic text-slate-400">No responses match the current filter.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded border border-slate-700 bg-slate-900/70">
            <div className="border-b border-slate-700 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Selected Pair
            </div>

            {!selectedResponse ? (
              <div className="p-4 text-sm text-slate-400">Select a row to inspect the full request and response.</div>
            ) : (
              <div className="space-y-4 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailItem label="Method" value={selectedResponse.method} />
                  <DetailItem label="Status" value={selectedResponse.status} />
                  <DetailItem label="Decision" value={selectedResponse.keptByFilters ? 'KEPT' : 'FILTERED'} />
                  <DetailItem label="Context" value={selectedResponse.context} />
                </div>

                <DetailBlock label="Request URL" value={selectedResponse.url} mono />
                <DetailBlock label="Content Type" value={selectedResponse.contentType || 'unknown'} mono />
                <DetailBlock
                  label="Filter Explanation"
                  value={selectedResponse.filterExplanation || 'No filter explanation'}
                />

                {loadingDetails ? (
                  <div className="rounded bg-slate-800 p-3 text-sm text-slate-400">Loading full response...</div>
                ) : (
                  <>
                    <JsonBlock
                      label="Request Headers"
                      value={selectedResponseData?.requestHeaders || {}}
                    />
                    <JsonBlock label="Response Headers" value={selectedResponseData?.headers || {}} />
                    <JsonBlock label="Response Body" value={selectedResponseData?.body} />
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-slate-700 pt-2">
            <button
              onClick={() => {
                alert(`Results saved to: ${sessionData?.results?.sessionDir || 'unknown folder'}`);
              }}
              className="flex-1 rounded bg-slate-700 px-2 py-2 text-xs text-white transition hover:bg-slate-600"
            >
              Open Folder
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 rounded bg-purple-600 px-2 py-2 text-xs text-white transition hover:bg-purple-700"
            >
              New Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, valueClassName }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-900/70 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

function ModeButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-xs font-medium transition ${
        active ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
      }`}
    >
      {children}
    </button>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded bg-slate-800 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-white">{String(value ?? '-')}</p>
    </div>
  );
}

function DetailBlock({ label, value, mono = false }) {
  return (
    <div className="rounded bg-slate-800 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 break-all text-sm text-slate-200 ${mono ? 'font-mono' : ''}`}>
        {String(value ?? '-')}
      </p>
    </div>
  );
}

function ReservationRow({ reservation }) {
  const listingLabel = reservation.listingNickname || reservation.listingName || reservation.listingId || '-';
  const priceLabel = reservation.payoutFormatted || formatCurrencyAmount(reservation.payout, reservation.currency);
  const stayLabel = [reservation.checkIn, reservation.checkOut].filter(Boolean).join(' -> ');
  const isBlocked = reservation.type === 'blocked' || reservation.source === 'calendar-note';
  const primaryLabel = reservation.guestName || (isBlocked ? 'Blocked dates' : 'Unknown guest');
  const secondaryLabel = reservation.note
    ? reservation.note
    : reservation.guestCount != null
      ? `${reservation.guestCount} guest(s)`
      : isBlocked
        ? 'Manual/commented block'
        : 'Guest count unavailable';
  const durationLabel =
    reservation.nights != null
      ? isBlocked
        ? `${reservation.nights} blocked day(s)`
        : `${reservation.nights} night(s)`
      : isBlocked
        ? 'Blocked duration unavailable'
        : 'Night count unavailable';
  const statusLabel = reservation.status || (isBlocked ? 'blocked' : '-');

  return (
    <tr className="border-t border-slate-800 align-top text-slate-200">
      <td className="px-3 py-2">
        <p className="font-medium text-white">{primaryLabel}</p>
        <p className="text-xs text-slate-400">{secondaryLabel}</p>
      </td>
      <td className="px-3 py-2">
        <p>{stayLabel || '-'}</p>
        <p className="text-xs text-slate-400">{durationLabel}</p>
      </td>
      <td className="px-3 py-2">
        <p className="font-medium text-white">{listingLabel}</p>
        {reservation.listingNickname &&
        reservation.listingName &&
        reservation.listingNickname !== reservation.listingName ? (
          <p className="text-xs text-slate-400">{reservation.listingName}</p>
        ) : null}
      </td>
      <td className="px-3 py-2">{priceLabel || '-'}</td>
      <td className="px-3 py-2">
        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">{statusLabel}</span>
      </td>
      <td className="px-3 py-2 font-mono text-xs text-slate-400">{reservation.confirmationCode || '-'}</td>
    </tr>
  );
}

function JsonBlock({ label, value }) {
  return (
    <div className="rounded bg-slate-950/70 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-200">
        {formatValue(value)}
      </pre>
    </div>
  );
}

function formatValue(value) {
  if (value === undefined) {
    return 'Not available';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value === null) {
    return 'null';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

function formatCurrencyAmount(value, currency) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }

  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(value);
  } catch (err) {
    return `${value} ${currency || 'EUR'}`;
  }
}

function getStatusColor(status) {
  if (status >= 200 && status < 300) return 'bg-green-600 text-white';
  if (status >= 300 && status < 400) return 'bg-blue-600 text-white';
  if (status >= 400 && status < 500) return 'bg-yellow-600 text-white';
  return 'bg-red-600 text-white';
}

function getResponseKey(response) {
  if (!response) {
    return '';
  }

  return response.filename || `${response.method}:${response.status}:${response.timestamp}:${response.url}`;
}

function uniqueKeys(values) {
  return [...new Set(values)];
}

function buildFilterRulesFromSelection(currentRules, selectedResponses) {
  const generatedRules = [];
  const allJson = selectedResponses.every((response) =>
    (response.contentType || '').toLowerCase().includes('application/json')
  );

  if (allJson) {
    generatedRules.push({ type: 'json-only', pattern: '', negate: false });
  }

  selectedResponses.forEach((response) => {
    const pattern = deriveUrlPattern(response.url);
    if (pattern) {
      generatedRules.push({ type: 'url-contains', pattern, negate: false });
    }
  });

  return {
    inclusive: dedupeRules([...(currentRules?.inclusive || []), ...generatedRules]),
    exclusive: currentRules?.exclusive || [],
  };
}

function dedupeRules(rules) {
  const seen = new Set();

  return rules.filter((rule) => {
    const key = `${rule.type}:${rule.pattern || ''}:${rule.negate ? '1' : '0'}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function deriveUrlPattern(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const stableSegments = [];

    for (const segment of segments) {
      if (looksDynamicSegment(segment) && stableSegments.length > 0) {
        break;
      }
      stableSegments.push(segment);
    }

    if (stableSegments.length > 0) {
      return `/${stableSegments.join('/')}`;
    }

    if (parsed.pathname && parsed.pathname !== '/') {
      return parsed.pathname;
    }

    return parsed.hostname;
  } catch (err) {
    return urlValue;
  }
}

function looksDynamicSegment(segment) {
  return (
    /^\d+$/.test(segment) ||
    /^[0-9a-f]{8,}$/i.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) ||
    /^[A-Za-z0-9_-]{20,}$/.test(segment) ||
    (segment.length > 24 && /\d/.test(segment))
  );
}

function isLikelyNoiseResponse(response) {
  const url = String(response?.url || '').toLowerCase();
  const contentType = String(response?.contentType || '').toLowerCase();

  const assetExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.webp',
    '.css',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
    '.map',
    '.js',
  ];

  const trackingMarkers = [
    'google-analytics',
    'analytics',
    'doubleclick',
    'facebook.com/tr',
    'hotjar',
    'amplitude',
    '/collect',
    '/marketing_event_tracking',
    '/airdog',
    'sgtm',
  ];

  return (
    assetExtensions.some((extension) => url.includes(extension)) ||
    contentType.startsWith('image/') ||
    contentType.includes('font/') ||
    contentType.includes('text/css') ||
    contentType.includes('javascript') ||
    trackingMarkers.some((marker) => url.includes(marker))
  );
}
