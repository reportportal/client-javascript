/* eslint-disable no-unused-expressions */
exports.fakeLaunchIds = ['12345', '123456', ''];
exports.fakeEndTime = 12345734;
exports.fakeMergeDataRQ = {
    description: 'Merged launch',
    end_time: module.fakeEndTime,
    extendSuitesDescription: true,
    launches: module.fakeLaunchIds,
    merge_type: 'BASIC',
    mode: 'DEFAULT',
    name: 'Test launch name',
};
