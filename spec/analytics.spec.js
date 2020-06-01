const Analytics = require('../analytics/analytics');
const { getAgentEventLabel } = require('../analytics/events');

const agentParams = {
    name: 'AgentName',
    version: 'AgentVersion',
};

describe('Analytics', () => {
    describe('class Analytics', () => {
        let analytics;

        beforeEach(() => {
            analytics = new Analytics(agentParams);
        });

        it('should be properly initialized', () => {
            expect(analytics.agentParams).toEqual(agentParams);
            expect(analytics.visitorInstance).toBeDefined();
        });

        it('trackEvent should called the method event with correct parameters', () => {
            spyOn(analytics.visitorInstance, 'event').and.returnValue({
                send: () => {},
            });

            analytics.trackEvent({
                category: 'category',
                action: 'action',
                label: 'label',
            });

            expect(analytics.visitorInstance.event).toHaveBeenCalledWith('category', 'action', 'label');
        });
    });

    describe('events', () => {
        it('getAgentEventLabel return correct label', () => {
            const expectedLabel = 'Agent name "AgentName", version "AgentVersion"';

            const label = getAgentEventLabel(agentParams);

            expect(label).toEqual(expectedLabel);
        });
    });
});
