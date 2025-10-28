const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const {
  shouldBypassProxy,
  getProxyConfig,
  createProxyAgents,
  getProxyAgentForUrl,
} = require('../lib/proxyHelper');

describe('proxyHelper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.NO_PROXY;
    delete process.env.http_proxy;
    delete process.env.https_proxy;
    delete process.env.no_proxy;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('shouldBypassProxy', () => {
    it('returns false when noProxy is not provided', () => {
      expect(shouldBypassProxy('http://example.com', '')).toBe(false);
      expect(shouldBypassProxy('http://example.com', null)).toBe(false);
      expect(shouldBypassProxy('http://example.com', undefined)).toBe(false);
    });

    it('returns true for exact hostname match', () => {
      expect(shouldBypassProxy('http://example.com', 'example.com')).toBe(true);
      expect(shouldBypassProxy('https://example.com:8080', 'example.com')).toBe(true);
    });

    it('returns true for wildcard *', () => {
      expect(shouldBypassProxy('http://example.com', '*')).toBe(true);
      expect(shouldBypassProxy('https://any.domain.com', '*')).toBe(true);
    });

    it('returns true for subdomain match with leading dot', () => {
      expect(shouldBypassProxy('http://sub.example.com', '.example.com')).toBe(true);
      expect(shouldBypassProxy('http://deep.sub.example.com', '.example.com')).toBe(true);
      expect(shouldBypassProxy('http://example.com', '.example.com')).toBe(false);
    });

    it('returns true for subdomain suffix match', () => {
      expect(shouldBypassProxy('http://sub.example.com', 'example.com')).toBe(true);
      expect(shouldBypassProxy('http://deep.sub.example.com', 'example.com')).toBe(true);
    });

    it('handles multiple entries separated by commas', () => {
      const noProxy = 'localhost,example.com,.test.com';
      expect(shouldBypassProxy('http://localhost', noProxy)).toBe(true);
      expect(shouldBypassProxy('http://example.com', noProxy)).toBe(true);
      expect(shouldBypassProxy('http://sub.test.com', noProxy)).toBe(true);
      expect(shouldBypassProxy('http://other.com', noProxy)).toBe(false);
    });

    it('is case insensitive', () => {
      expect(shouldBypassProxy('http://EXAMPLE.COM', 'example.com')).toBe(true);
      expect(shouldBypassProxy('http://example.com', 'EXAMPLE.COM')).toBe(true);
    });

    it('handles spaces in noProxy list', () => {
      const noProxy = ' localhost , example.com , .test.com ';
      expect(shouldBypassProxy('http://localhost', noProxy)).toBe(true);
      expect(shouldBypassProxy('http://example.com', noProxy)).toBe(true);
    });

    it('returns false for invalid URLs', () => {
      expect(shouldBypassProxy('not-a-url', 'example.com')).toBe(false);
    });
  });

  describe('getProxyConfig', () => {
    it('returns null when no proxy is configured', () => {
      expect(getProxyConfig('http://example.com', {})).toBeNull();
    });

    it('returns null when proxy is explicitly disabled', () => {
      const config = { proxy: false };
      expect(getProxyConfig('http://example.com', config)).toBeNull();
    });

    it('returns null when URL matches noProxy from config', () => {
      const config = { noProxy: 'example.com,localhost' };
      expect(getProxyConfig('http://example.com', config)).toBeNull();
      expect(getProxyConfig('http://localhost', config)).toBeNull();
    });

    it('returns null when URL matches NO_PROXY from environment', () => {
      process.env.NO_PROXY = 'example.com,localhost';
      expect(getProxyConfig('http://example.com', {})).toBeNull();
    });

    it('prefers noProxy from config over environment', () => {
      process.env.NO_PROXY = 'other.com';
      const config = { noProxy: 'example.com' };
      expect(getProxyConfig('http://example.com', config)).toBeNull();
    });

    it('returns proxy URL from string config', () => {
      const config = { proxy: 'http://proxy.example.com:8080' };
      const result = getProxyConfig('http://target.com', config);
      expect(result).toEqual({
        proxyUrl: 'http://proxy.example.com:8080',
      });
    });

    it('returns proxy URL from object config', () => {
      const config = {
        proxy: {
          protocol: 'https',
          host: 'proxy.example.com',
          port: 8080,
        },
      };
      const result = getProxyConfig('http://target.com', config);
      expect(result).toEqual({
        proxyUrl: 'https://proxy.example.com:8080',
      });
    });

    it('returns proxy URL with authentication', () => {
      const config = {
        proxy: {
          protocol: 'http',
          host: 'proxy.example.com',
          port: 8080,
          auth: {
            username: 'user',
            password: 'pass',
          },
        },
      };
      const result = getProxyConfig('http://target.com', config);
      expect(result).toEqual({
        proxyUrl: 'http://user:pass@proxy.example.com:8080',
      });
    });

    it('uses http as default protocol for object config', () => {
      const config = {
        proxy: {
          host: 'proxy.example.com',
          port: 8080,
        },
      };
      const result = getProxyConfig('http://target.com', config);
      expect(result).toEqual({
        proxyUrl: 'http://proxy.example.com:8080',
      });
    });

    it('returns proxy from HTTPS_PROXY environment variable for https URLs', () => {
      process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
      const result = getProxyConfig('https://target.com', {});
      expect(result).toEqual({
        proxyUrl: 'http://proxy.example.com:8080',
      });
    });

    it('returns proxy from HTTP_PROXY environment variable for http URLs', () => {
      process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
      const result = getProxyConfig('http://target.com', {});
      expect(result).toEqual({
        proxyUrl: 'http://proxy.example.com:8080',
      });
    });

    it('respects NO_PROXY when using environment proxy', () => {
      process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
      process.env.NO_PROXY = 'target.com';
      const result = getProxyConfig('http://target.com', {});
      expect(result).toBeNull();
    });

    it('prioritizes explicit config over environment variables', () => {
      process.env.HTTPS_PROXY = 'http://env-proxy.com:8080';
      const config = { proxy: 'http://config-proxy.com:9090' };
      const result = getProxyConfig('https://target.com', config);
      expect(result).toEqual({
        proxyUrl: 'http://config-proxy.com:9090',
      });
    });
  });

  describe('createProxyAgents', () => {
    it('returns default agent when no proxy is configured', () => {
      const agents = createProxyAgents('http://example.com', {});
      expect(agents.httpAgent).toBeDefined();
      expect(agents.httpAgent.constructor.name).toBe('Agent');
    });

    it('creates HttpProxyAgent for HTTP URLs', () => {
      const config = { proxy: 'http://proxy.example.com:8080' };
      const agents = createProxyAgents('http://target.com', config);
      expect(agents.httpAgent).toBeInstanceOf(HttpProxyAgent);
      expect(agents.httpsAgent).toBeUndefined();
    });

    it('creates HttpsProxyAgent for HTTPS URLs', () => {
      const config = { proxy: 'http://proxy.example.com:8080' };
      const agents = createProxyAgents('https://target.com', config);
      expect(agents.httpsAgent).toBeInstanceOf(HttpsProxyAgent);
      expect(agents.httpAgent).toBeUndefined();
    });

    it('returns default agent when URL is in noProxy list', () => {
      const config = {
        proxy: 'http://proxy.example.com:8080',
        noProxy: 'target.com',
      };
      const agents = createProxyAgents('http://target.com', config);
      expect(agents.httpAgent).toBeDefined();
      expect(agents.httpAgent.constructor.name).toBe('Agent');
    });

    it('returns default HTTPS agent for HTTPS URLs in noProxy list', () => {
      const config = {
        proxy: 'http://proxy.example.com:8080',
        noProxy: 'target.com',
      };
      const agents = createProxyAgents('https://target.com', config);
      expect(agents.httpsAgent).toBeDefined();
      expect(agents.httpsAgent.constructor.name).toBe('Agent');
    });
  });

  describe('getProxyAgentForUrl', () => {
    it('returns appropriate agent based on URL protocol', () => {
      const config = { proxy: 'http://proxy.example.com:8080' };

      const httpAgents = getProxyAgentForUrl('http://target.com', config);
      expect(httpAgents.httpAgent).toBeInstanceOf(HttpProxyAgent);

      const httpsAgents = getProxyAgentForUrl('https://target.com', config);
      expect(httpsAgents.httpsAgent).toBeInstanceOf(HttpsProxyAgent);
    });

    it('respects noProxy configuration', () => {
      const config = {
        proxy: 'http://proxy.example.com:8080',
        noProxy: 'localhost,target.com',
      };
      const agents = getProxyAgentForUrl('http://target.com', config);
      expect(agents.httpAgent).toBeDefined();
      expect(agents.httpAgent.constructor.name).toBe('Agent');
    });

    it('works with environment variables', () => {
      process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
      const agents = getProxyAgentForUrl('http://target.com', {});
      expect(agents.httpAgent).toBeInstanceOf(HttpProxyAgent);
    });

    it('respects NO_PROXY environment variable', () => {
      process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
      process.env.NO_PROXY = 'target.com';
      const agents = getProxyAgentForUrl('http://target.com', {});
      expect(agents.httpAgent).toBeDefined();
      expect(agents.httpAgent.constructor.name).toBe('Agent');
    });
  });
});
