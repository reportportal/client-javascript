const addLogger = (axiosInstance) => {
  axiosInstance.interceptors.request.use((config) => {
    const startDate = new Date();
    // eslint-disable-next-line no-param-reassign
    config.startTime = startDate.valueOf();

    console.log(`Request method=${config.method} url=${config.url} [${startDate.toISOString()}]`);

    return config;
  });

  axiosInstance.interceptors.response.use(
    (response) => {
      const date = new Date();
      const { status, config } = response;

      console.log(
        `Response status=${status} url=${config.url} time=${
          date.valueOf() - config.startTime
        }ms [${date.toISOString()}]`,
      );

      return response;
    },
    (error) => {
      const date = new Date();
      const { response, config } = error;
      const status = response ? response.status : null;

      console.log(
        `Response ${status ? `status=${status}` : `message='${error.message}'`} url=${
          config.url
        } time=${date.valueOf() - config.startTime}ms [${date.toISOString()}]`,
      );

      return Promise.reject(error);
    },
  );
};

module.exports = { addLogger };
