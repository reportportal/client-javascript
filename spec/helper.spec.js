const RPClient = require('../lib/report-portal-client.js');
const RestClient = require('../lib/rest');

describe('helpers', () => {
    const client = new RPClient({ token: 'token' });

    describe('#formatName', () => {
        it('slice last 256 symbols', () => {
            expect(client.helpers.formatName(`a${'b'.repeat(256)}`)).toBe('b'.repeat(256));
        });
        it('leave 256 symbol name as is', () => {
            expect(client.helpers.formatName('c'.repeat(256))).toBe('c'.repeat(256));
        });
        it('leave 3 symbol name as is', () => {
            expect(client.helpers.formatName('abc')).toBe('abc');
        });
        it('complete with dots 2 symbol name', () => {
            expect(client.helpers.formatName('ab')).toBe('ab.');
        });
    });

    describe('#now', () => {
        it('returns milliseconds from unix time', () => {
            expect(new Date() - client.helpers.now()).toBeLessThan(100); // less than 100 miliseconds difference
        });
    });

    describe('#getServerResults', () => {
        it('calls RestClient#request', () => {
            spyOn(RestClient, 'request');

            client.helpers.getServerResult(
                'http://localhost:80/api/v1',
                { userId: 1 },
                {
                    headers: {
                        'X-Custom-Header': 'WOW',
                    },
                },
                'POST',
            );

            expect(RestClient.request).toHaveBeenCalledWith(
                'POST',
                'http://localhost:80/api/v1',
                { userId: 1 },
                {
                    headers: {
                        'X-Custom-Header': 'WOW',
                    },
                },
            );
        });
    });
});
