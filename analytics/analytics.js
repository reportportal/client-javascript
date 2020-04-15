const ua = require('universal-analytics');
const { GOOGLE_ANALYTICS_INSTANCE } = require('./constants');

class Analytics {
    constructor(agentParams) {
        this.agentParams = agentParams;
        this.visitorInstance = ua(GOOGLE_ANALYTICS_INSTANCE);
    }

    trackEvent(event) {
        this.visitorInstance.event(event.category, event.action, event.label).send();
    }
}

module.exports = Analytics;
