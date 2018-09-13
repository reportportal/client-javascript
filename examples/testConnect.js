/* eslint-disable no-console */
const RPClient = require('../lib/report-portal-client.js');

const rpClient = new RPClient({
    token: '00000000-0000-0000-0000-000000000000',
    endpoint: 'http://your-instance.com:8080/api/v1',
    launch: 'LAUNCH_NAME',
    project: 'PROJECT_NAME',
});

rpClient.checkConnect().then((response) => {
    console.log('You have successfully connected to the server.');
    console.log(`You are using an account: ${response.full_name}`);
}, (error) => {
    console.log('Error connection to server');
    console.dir(error);
});
