const PublicReportingAPI = require('../lib/publicReportingAPI');
const { EVENTS } = require('../lib/constants/events');

describe('PublicReportingAPI', () => {
    it('setDescription should trigger process.emit with correct parameters', () => {
        spyOn(process, 'emit');

        PublicReportingAPI.setDescription('text', 'suite');

        expect(process.emit).toHaveBeenCalledWith(EVENTS.SET_DESCRIPTION, {
            text: 'text',
            suite: 'suite',
        });
    });

    it('addAttributes should trigger process.emit with correct parameters', () => {
        spyOn(process, 'emit');

        PublicReportingAPI.addAttributes([{ value: 'value' }], 'suite');

        expect(process.emit).toHaveBeenCalledWith(EVENTS.ADD_ATTRIBUTES, {
            attributes: [{ value: 'value' }],
            suite: 'suite',
        });
    });

    it('addLog should trigger process.emit with correct parameters', () => {
        spyOn(process, 'emit');

        PublicReportingAPI.addLog({ level: 'INFO', message: 'message' }, 'suite');

        expect(process.emit).toHaveBeenCalledWith(EVENTS.ADD_LOG, {
            log: { level: 'INFO', message: 'message' },
            suite: 'suite',
        });
    });

    it('addLaunchLog should trigger process.emit with correct parameters', () => {
        spyOn(process, 'emit');

        PublicReportingAPI.addLaunchLog({ level: 'INFO', message: 'message' });

        expect(process.emit).toHaveBeenCalledWith(EVENTS.ADD_LAUNCH_LOG, { level: 'INFO', message: 'message' });
    });

    it('setTestCaseId should trigger process.emit with correct parameters', () => {
        spyOn(process, 'emit');

        PublicReportingAPI.setTestCaseId('testCaseId', 'suite');

        expect(process.emit).toHaveBeenCalledWith(EVENTS.SET_TEST_CASE_ID, {
            testCaseId: 'testCaseId',
            suite: 'suite',
        });
    });

    it('setLaunchStatus should trigger process.emit with correct parameters', () => {
        spyOn(process, 'emit');

        PublicReportingAPI.setLaunchStatus('passed');

        expect(process.emit).toHaveBeenCalledWith(EVENTS.SET_LAUNCH_STATUS, 'passed');
    });

    it('setStatus should trigger process.emit with correct parameters', () => {
        spyOn(process, 'emit');

        PublicReportingAPI.setStatus('passed', 'suite');

        expect(process.emit).toHaveBeenCalledWith(EVENTS.SET_STATUS, {
            status: 'passed',
            suite: 'suite',
        });
    });
});
