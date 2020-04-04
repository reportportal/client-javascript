const ua = require('universal-analytics');
const { PJSON_VERSION, PJSON_NAME, GOOGLE_ANALYTICS_INSTANCE } = require('./constants');

class Analytics {
    constructor(agentParams) {
        this.agentParams = agentParams;
        this.visitorInstance = ua(GOOGLE_ANALYTICS_INSTANCE);
    }

    setPersistentParams() {
        this.visitorInstance.set('av', PJSON_VERSION);
        this.visitorInstance.set('an', PJSON_NAME);
    }

    trackEvent(event) {
        this.visitorInstance.event(event.category, event.action, event.label).send();
    }
}

module.exports = Analytics;
