/* eslint-disable global-require,no-underscore-dangle */
describe('ReportPortal javascript client', () => {
    const RPClient = require('../lib/report-portal-client.js');
    const helpers = require('../lib/helpers');

    describe('constructor', () => {
        it('executes without error', () => {
            const client = new RPClient({ token: 'test' });
            expect(client.config.token).toBe('test');
        });
    });
    describe('now', () => {
        let client;
        it('returns milliseconds from unix time', () => {
            client = new RPClient({ token: 'nowTest' });
            expect(new Date() - client.helpers.now()).toBeLessThan(100); // less than 100 miliseconds difference
        });
    });
    describe('startLaunch', () => {
        let client;
        it('calls getServerResult', () => {
            client = new RPClient({ token: 'startLaunchTest', endpoint: 'https://rp.us/api/v1', project: 'tst' });
            const myPromise = Promise.resolve({ id: 'testidlaunch' });
            spyOn(client.restClient, 'create').and.returnValue(myPromise);
            const time = 12345734;
            client.startLaunch({
                start_time: time,
            });
            expect(client.restClient.create).toHaveBeenCalledWith('launch', {
                name: 'Test launch name',
                start_time: time,
            }, { headers: client.headers });
        });
    });

    describe('mergeLaunches', () => {
        const fakeLaunchIds = ['12345', '123456', ''];
        const fakeEndTime = 12345734;
        const fakeMergeDataRQ = {
            description: 'Merged launch',
            end_time: fakeEndTime,
            extendSuitesDescription: true,
            launches: fakeLaunchIds,
            merge_type: 'BASIC',
            mode: 'DEFAULT',
            name: 'Test launch name',
        };
        let client;
        it('calls client', () => {
            client = new RPClient({
                token: 'startLaunchTest',
                endpoint: 'https://rp.us/api/v1',
                project: 'tst',
                isLaunchMergeRequired: true,
            });

            const myPromise = Promise.resolve({ id: 'testidlaunch' });
            spyOn(client.restClient, 'create').and.returnValue(myPromise);

            spyOn(helpers, 'readLaunchesFromFile').and.returnValue(fakeLaunchIds);
            spyOn(client, 'getMergeLaunchesData').and.returnValue(fakeMergeDataRQ);
            client.mergeLaunches();

            expect(client.restClient.create)
                .toHaveBeenCalledWith('launch/merge', fakeMergeDataRQ, { headers: client.headers });
        });
    });

    xdescribe('updateLaunch', () => {
        let client;
        let launchObj;

        beforeAll(() => {

        });

        it('sends put request to update description for launch', () => {
            client = new RPClient({ token: 'upLaunchDescTest', endpoint: 'https://rp.us/api/v1', project: 'tst' });
            const myPromise = Promise.resolve({ id: 'testidlaunch' });
            spyOn(client.helpers, 'getServerResult').and.returnValue(myPromise);
            launchObj = client.startLaunch({});
            client.finishLaunch(launchObj.tempId, {});
            client.updateLaunch(launchObj.tempId, {
                description: 'newone',
            });
            console.dir(client.helpers.getServerResult.calls.all());
            expect(client.helpers.getServerResult.calls.length).toHaveBeenCalledWith(
                'https://rp.us/api/v1/tst/launch/id5/update',
                { description: 'newone' },
                { headers: client.headers }, 'PUT',
            );
        });
    });

    xdescribe('getServerResult', () => {
        it('creates promise to send json via rest', (done) => {
            const rest = {};
            spyOn(rest, 'json');
            const conf = { token: 'upLaunchDescTest', endpoint: 'https://rp.us/api/v1', project: 'tst' };
            const client = new RPClient(conf);

            client.helpers.getServerResult('url', { param: 'value' }, 'options', 'method');

            expect(rest.json).toHaveBeenCalledWith('url', { param: 'value' }, 'options', 'method');
            done(); // need as async code is checked
        });
    });
    xdescribe('finishLaunch', () => {
        it('sends put request to finish launch', () => {
            const client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            spyOn(client, '_getResponsePromise');

            client.finishLaunch('id6', { some: 'data' });

            expect(client._getResponsePromise).toHaveBeenCalledWith(
                'https://rp.api/prj/launch/id6/finish',
                { some: 'data' }, { headers: client.headers }, 'PUT',
            );
        });
    });
    xdescribe('startTestItem', () => {
        it('sends post request to item', () => {
            const client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            spyOn(client, '_getResponsePromise');

            client.startTestItem({ some: 'data' }, 'parentID5');

            expect(client._getResponsePromise).toHaveBeenCalledWith(
                'https://rp.api/prj/item/parentID5',
                { some: 'data' }, { headers: client.headers }, 'POST',
            );
        });
    });
    xdescribe('finishTestItem', () => {
        it('sends put request to item', () => {
            const client = new RPClient({ token: 'any', endpoint: 'https://rp.api', project: 'prj' });
            spyOn(client, '_getResponsePromise');

            client.finishTestItem('finishedItemId', { finish: 'it' });

            expect(client._getResponsePromise).toHaveBeenCalledWith(
                'https://rp.api/prj/item/finishedItemId',
                { finish: 'it' }, { headers: client.headers }, 'PUT',
            );
        });
    });
});
