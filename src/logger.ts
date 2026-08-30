import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

type TimedRequestConfig = InternalAxiosRequestConfig & { startTime?: number };

export const addLogger = (axiosInstance: AxiosInstance): void => {
  axiosInstance.interceptors.request.use((config: TimedRequestConfig) => {
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
          date.valueOf() - ((config as TimedRequestConfig).startTime ?? 0)
        }ms [${date.toISOString()}]`,
      );

      return response;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error: any) => {
      const date = new Date();
      const { response, config } = error;
      const status = response ? response.status : null;

      console.log(
        `Response ${status ? `status=${status}` : `message='${error.message}'`} url=${
          config?.url
        } time=${date.valueOf() - (config?.startTime ?? 0)}ms [${date.toISOString()}]`,
      );

      return Promise.reject(error);
    },
  );
};
