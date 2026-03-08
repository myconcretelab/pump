function sanitizeFilename(str) {
  // Remove or replace problematic characters
  return str
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .replace(/_+/g, '_') // Collapse consecutive underscores
    .substring(0, 200); // Limit length
}

function generateResponseFilename(response, index) {
  try {
    const url = new URL(response.url);
    const pathname = url.pathname.split('/').pop() || 'api-response';
    const sanitized = sanitizeFilename(pathname);

    // Generate: index_method_sanitizedPath.json
    return `${String(index).padStart(4, '0')}_${response.method.toLowerCase()}_${sanitized || 'response'}.json`;
  } catch {
    // Fallback if URL parsing fails
    return `${String(index).padStart(4, '0')}_${response.method.toLowerCase()}_response.json`;
  }
}

function generateSessionId() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  const random = Math.random().toString(36).substring(2, 8);
  return `session_${dateStr}_${timeStr}_${random}`;
}

function generateMetadataFilename() {
  return 'metadata.json';
}

function generateSummaryFilename() {
  return 'session_summary.json';
}

function generateHARFilename() {
  return 'session.har';
}

function generateResponsesLogFilename() {
  return 'responses.log';
}

export default {
  sanitizeFilename,
  generateResponseFilename,
  generateSessionId,
  generateMetadataFilename,
  generateSummaryFilename,
  generateHARFilename,
  generateResponsesLogFilename,
};
