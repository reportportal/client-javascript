import { getProxyForUrl } from 'proxy-from-env';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import http from 'http';
import https from 'https';
import type { RestClientConfig } from './models/config';

export interface ProxyAgents {
  httpAgent?: http.Agent;
  httpsAgent?: https.Agent;
}

/**
 * Sanitizes a URL by removing credentials (username/password) for safe logging.
 */
function sanitizeUrlForLogging(urlString: string): string {
  try {
    const urlObj = new URL(urlString);
    if (urlObj.username || urlObj.password) {
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
 * Checks if a URL should bypass proxy based on NO_PROXY patterns.
 */
export function shouldBypassProxy(url: string, noProxy?: string): boolean {
  if (!noProxy) return false;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    const patterns = noProxy
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    return patterns.some((pattern) => {
      if (pattern === '*') return true;

      if (pattern.startsWith('.')) {
        const cleanPattern = pattern.slice(1);
        return hostname.endsWith(`.${cleanPattern}`);
      }

      if (hostname === pattern) return true;

      if (hostname.endsWith(`.${pattern}`)) return true;

      return false;
    });
  } catch (error) {
    // If URL parsing fails, don't bypass proxy
    return false;
  }
}

/**
 * Gets proxy configuration for a given URL, checking both environment variables and explicit config.
 */
export function getProxyConfig(
  url: string,
  proxyConfig: RestClientConfig = {},
): { proxyUrl: string } | null {
  const urlObj = new URL(url);

  const noProxyFromConfig = proxyConfig.noProxy;
  const noProxyFromEnv = process.env.NO_PROXY || process.env.no_proxy || '';
  const noProxy = noProxyFromConfig || noProxyFromEnv;

  if (proxyConfig.debug) {
    // eslint-disable-next-line no-console
    console.log('[ProxyHelper] getProxyConfig called:');
    // eslint-disable-next-line no-console
    console.log('  URL:', url);
    // eslint-disable-next-line no-console
    console.log('  Hostname:', urlObj.hostname);
    // eslint-disable-next-line no-console
    console.log('  noProxy from config:', noProxyFromConfig);
    // eslint-disable-next-line no-console
    console.log('  noProxy from env:', noProxyFromEnv);
    // eslint-disable-next-line no-console
    console.log('  Final noProxy:', noProxy);
  }

  const shouldBypass = shouldBypassProxy(url, noProxy);
  if (proxyConfig.debug) {
    // eslint-disable-next-line no-console
    console.log('  Should bypass proxy:', shouldBypass);
  }

  if (shouldBypass) {
    return null;
  }

  if (proxyConfig.proxy === false) {
    return null;
  }

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

  if (typeof proxyConfig.proxy === 'string') {
    return { proxyUrl: proxyConfig.proxy };
  }

  const proxyUrlFromEnv = getProxyForUrl(url);
  if (proxyUrlFromEnv) {
    return { proxyUrl: proxyUrlFromEnv };
  }

  return null;
}

// Cache for proxy agents to enable connection reuse
const agentCache = new Map<string, ProxyAgents>();

function getAgentCacheKey(proxyUrl: string, isHttps: boolean): string {
  return `${isHttps ? 'https' : 'http'}:${proxyUrl}`;
}

/**
 * Creates an HTTP/HTTPS agent with proxy configuration for a specific URL.
 * Agents are cached and reused to enable connection pooling and keepAlive.
 */
export function createProxyAgents(
  url: string,
  restClientConfig: RestClientConfig = {},
): ProxyAgents {
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const proxyConfig = getProxyConfig(url, restClientConfig);

  const agentOptions = {
    keepAlive: true,
    keepAliveMsecs: 3000,
    maxSockets: 50,
    maxFreeSockets: 10,
  };

  if (!proxyConfig) {
    if (restClientConfig.debug) {
      // eslint-disable-next-line no-console
      console.log('[ProxyHelper] No proxy for URL (bypassed or not configured):', url);
      // eslint-disable-next-line no-console
      console.log('  Using default agent to prevent axios from using env proxy');
    }

    const cacheKey = getAgentCacheKey('no-proxy', isHttps);
    const cached = agentCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const agents: ProxyAgents = isHttps
      ? { httpsAgent: new https.Agent(agentOptions) }
      : { httpAgent: new http.Agent(agentOptions) };
    agentCache.set(cacheKey, agents);
    return agents;
  }

  const { proxyUrl } = proxyConfig;

  const cacheKey = getAgentCacheKey(proxyUrl, isHttps);
  const cached = agentCache.get(cacheKey);
  if (cached) {
    if (restClientConfig.debug) {
      // eslint-disable-next-line no-console
      console.log('[ProxyHelper] Reusing cached proxy agent:', sanitizeUrlForLogging(proxyUrl));
    }
    return cached;
  }

  if (restClientConfig.debug) {
    // eslint-disable-next-line no-console
    console.log('[ProxyHelper] Creating proxy agent:');
    // eslint-disable-next-line no-console
    console.log('  URL:', url);
    // eslint-disable-next-line no-console
    console.log('  Proxy URL:', sanitizeUrlForLogging(proxyUrl));
  }

  const agents: ProxyAgents = isHttps
    ? { httpsAgent: new HttpsProxyAgent(proxyUrl, agentOptions) }
    : { httpAgent: new HttpProxyAgent(proxyUrl, agentOptions) };

  agentCache.set(cacheKey, agents);
  return agents;
}

/**
 * Gets proxy agent for a specific request URL. This is the main function used in axios requests.
 */
export function getProxyAgentForUrl(
  url: string,
  restClientConfig: RestClientConfig = {},
): ProxyAgents {
  return createProxyAgents(url, restClientConfig);
}
