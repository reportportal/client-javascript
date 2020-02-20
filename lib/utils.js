const publishEvent = (event, msg = {}) => {
    process.emit(event, msg);
};

const subscribeToEvent = (event, msg = {}) => {
    process.emit(event, msg);
};

module.exports = { publishEvent, subscribeToEvent };
