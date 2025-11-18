const { getProxyForUrl } = require('proxy-from-env');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const http = require('http');
const https = require('https');

/**
 * Sanitizes a URL by removing credentials (username/password) for safe logging
 * @param {string} urlString - The URL to sanitize
 * @returns {string} - Sanitized URL with credentials replaced by [REDACTED]
 */
function sanitizeUrlForLogging(urlString) {
  try {
    const urlObj = new URL(urlString);
    if (urlObj.username || urlObj.password) {
      // Replace credentials with [REDACTED]
      urlObj.username = '[REDACTED]';
      urlObj.password = '';
      return urlObj.toString();
    }
    return urlString;
  } catch (error) {
    // If URL parsing fails, return as-is (likely not a URL)
    return urlString;
  }
}

/**
 * Checks if a URL should bypass proxy based on NO_PROXY patterns
 * @param {string} url - The URL to check
 * @param {string} noProxy - Comma-separated list of domains/patterns to bypass
 * @returns {boolean} - True if proxy should be bypassed
 */
function shouldBypassProxy(url, noProxy) {
  if (!noProxy) return false;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Split NO_PROXY entries and clean them
    const patterns = noProxy
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    return patterns.some((pattern) => {
      // Special case: * means bypass all
      if (pattern === '*') return true;

      // Pattern with leading dot (.example.com) - only matches subdomains
      if (pattern.startsWith('.')) {
        const cleanPattern = pattern.slice(1);
        // Should match sub.example.com but NOT example.com
        return hostname.endsWith(`.${cleanPattern}`);
      }

      // Pattern without leading dot (example.com) - matches domain and subdomains
      // Exact match
      if (hostname === pattern) return true;

      // Suffix match (example.com matches sub.example.com)
      if (hostname.endsWith(`.${pattern}`)) return true;

      return false;
    });
  } catch (error) {
    // If URL parsing fails, don't bypass proxy
    return false;
  }
}

/**
 * Gets proxy configuration for a given URL
 * Checks both environment variables and explicit config
 * @param {string} url - The target URL
 * @param {object} proxyConfig - Explicit proxy configuration from restClientConfig
 * @returns {object|null} - Proxy URL and bypass info, or null if no proxy
 */
function getProxyConfig(url, proxyConfig = {}) {
  const urlObj = new URL(url);

  // Check NO_PROXY from config or environment
  const noProxyFromConfig = proxyConfig.noProxy;
  const noProxyFromEnv = process.env.NO_PROXY || process.env.no_proxy || '';
  const noProxy = noProxyFromConfig || noProxyFromEnv;

  if (proxyConfig.debug) {
    console.log('[ProxyHelper] getProxyConfig called:');
    console.log('  URL:', url);
    console.log('  Hostname:', urlObj.hostname);
    console.log('  noProxy from config:', noProxyFromConfig);
    console.log('  noProxy from env:', noProxyFromEnv);
    console.log('  Final noProxy:', noProxy);
  }

  // Check if URL should bypass proxy
  const shouldBypass = shouldBypassProxy(url, noProxy);
  if (proxyConfig.debug) {
    console.log('  Should bypass proxy:', shouldBypass);
  }

  if (shouldBypass) {
    return null;
  }

  // If proxy is explicitly disabled
  if (proxyConfig.proxy === false) {
    return null;
  }

  // Priority 1: Explicit proxy configuration object
  if (proxyConfig.proxy && typeof proxyConfig.proxy === 'object') {
    const { protocol: proxyProtocol, host, port, auth } = proxyConfig.proxy;
    if (host && port) {
      let proxyUrl = `${proxyProtocol || 'http'}://${host}:${port}`;
      if (auth) {
        const { username, password } = auth;
        proxyUrl = `${proxyProtocol || 'http'}://${username}:${password}@${host}:${port}`;
      }
      return { proxyUrl };
    }
  }

  // Priority 2: Explicit proxy URL string
  if (typeof proxyConfig.proxy === 'string') {
    return { proxyUrl: proxyConfig.proxy };
  }

  // Priority 3: Environment variables (with NO_PROXY support via proxy-from-env)
  const proxyUrlFromEnv = getProxyForUrl(url);
  if (proxyUrlFromEnv) {
    return { proxyUrl: proxyUrlFromEnv };
  }

  return null;
}

// Cache for proxy agents to enable connection reuse
const agentCache = new Map();

/**
 * Creates a cache key for proxy agents based on proxy URL and protocol
 * @param {string} proxyUrl - The proxy URL
 * @param {boolean} isHttps - Whether target is HTTPS
 * @returns {string} - Cache key
 */
function getAgentCacheKey(proxyUrl, isHttps) {
  return `${isHttps ? 'https' : 'http'}:${proxyUrl}`;
}

/**
 * Creates an HTTP/HTTPS agent with proxy configuration for a specific URL
 * Agents are cached and reused to enable connection pooling and keepAlive
 * @param {string} url - The target URL for the request
 * @param {object} restClientConfig - The rest client configuration
 * @returns {object} - Object with httpAgent and/or httpsAgent
 */
function createProxyAgents(url, restClientConfig = {}) {
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const proxyConfig = getProxyConfig(url, restClientConfig);

  // Agent options for connection reuse and keepAlive
  const agentOptions = {
    keepAlive: true,
    keepAliveMsecs: 3000,
    maxSockets: 50,
    maxFreeSockets: 10,
  };

  if (!proxyConfig) {
    if (restClientConfig.debug) {
      console.log('[ProxyHelper] No proxy for URL (bypassed or not configured):', url);
      console.log('  Using default agent to prevent axios from using env proxy');
    }

    const cacheKey = getAgentCacheKey('no-proxy', isHttps);
    if (agentCache.has(cacheKey)) {
      return agentCache.get(cacheKey);
    }

    // Return a default agent to prevent axios from using HTTP_PROXY/HTTPS_PROXY env vars
    // This ensures that URLs in noProxy truly bypass the proxy
    const agents = isHttps
      ? { httpsAgent: new https.Agent(agentOptions) }
      : { httpAgent: new http.Agent(agentOptions) };
    agentCache.set(cacheKey, agents);
    return agents;
  }

  const { proxyUrl } = proxyConfig;

  const cacheKey = getAgentCacheKey(proxyUrl, isHttps);
  if (agentCache.has(cacheKey)) {
    if (restClientConfig.debug) {
      console.log('[ProxyHelper] Reusing cached proxy agent:', sanitizeUrlForLogging(proxyUrl));
    }
    return agentCache.get(cacheKey);
  }

  if (restClientConfig.debug) {
    console.log('[ProxyHelper] Creating proxy agent:');
    console.log('  URL:', url);
    console.log('  Proxy URL:', sanitizeUrlForLogging(proxyUrl));
  }

  const agents = isHttps
    ? { httpsAgent: new HttpsProxyAgent(proxyUrl, agentOptions) }
    : { httpAgent: new HttpProxyAgent(proxyUrl, agentOptions) };

  agentCache.set(cacheKey, agents);
  return agents;
}

/**
 * Gets proxy agent for a specific request URL
 * This is the main function to be used in axios requests
 * @param {string} url - The target URL for the request
 * @param {object} restClientConfig - The rest client configuration
 * @returns {object} - Object with agent configuration for axios
 */
function getProxyAgentForUrl(url, restClientConfig = {}) {
  return createProxyAgents(url, restClientConfig);
}

module.exports = {
  shouldBypassProxy,
  getProxyConfig,
  createProxyAgents,
  getProxyAgentForUrl,
};
