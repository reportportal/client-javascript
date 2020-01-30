const ua = require('universal-analytics');
const { PJSON_VERSION, PJSON_NAME, GOOGLE_ANALYTICS_INSTANCE } = require('./constants');

class Analytics {
    constructor() {
        this.visitorInstance = ua(GOOGLE_ANALYTICS_INSTANCE);
    }

    setPersistentParams(clientId) {
        this.visitorInstance.set('av', PJSON_VERSION);
        this.visitorInstance.set('an', PJSON_NAME);
        this.visitorInstance.set('cd1', clientId);
    }

    trackEvent(event) {
        this.visitorInstance.event(event.category, event.action).send();
    }
}

module.exports = Analytics;
