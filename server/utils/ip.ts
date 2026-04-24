// server/utils/ip.ts
// Helper utilities for extracting client IP addresses from HTTP headers

import { H3Event, getHeader } from 'h3'

/**
 * Extract client IP address from H3 event headers.
 * Checks X-Forwarded-For (from reverse proxy) first, then X-Real-IP.
 * Returns null if no IP can be determined.
 */
export function getClientIp(event: H3Event): string | null {
  // X-Forwarded-For can contain multiple IPs; take the first (original client)
  const forwardedFor = getHeader(event, 'x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) {
      return first
    }
  }

  // X-Real-IP is used by some reverse proxies (nginx, Apache)
  const realIp = getHeader(event, 'x-real-ip')
  if (realIp?.trim()) {
    return realIp.trim()
  }

  // Note: H3 doesn't expose socket.remoteAddress directly in the event object
  // In production, rely on reverse proxy headers above
  return null
}
