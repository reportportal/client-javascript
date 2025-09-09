// eslint-disable-next-line import/named
import { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';

export const addLogger = (axiosInstance: AxiosInstance): void => {
  axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const startDate = new Date();
    (config as any).startTime = startDate.valueOf();

    console.log(`Request method=${config.method} url=${config.url} [${startDate.toISOString()}]`);

    return config;
  });

  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
      const date = new Date();
      const { status, config } = response as AxiosResponse & { config: InternalAxiosRequestConfig };

      console.log(
        `Response status=${status} url=${config.url} time=${
          date.valueOf() - ((config as any).startTime ?? 0)
        }ms [${date.toISOString()}]`,
      );

      return response;
    },
    (error: AxiosError) => {
      const date = new Date();
      const { response, config } = error as AxiosError & { config: InternalAxiosRequestConfig };
      const status = response ? response.status : null;

      console.log(
        `Response ${status ? `status=${status}` : `message='${error.message}'`} url=${
          config && config.url
        } time=${
          date.valueOf() - ((config && (config as any).startTime) ?? 0)
        }ms [${date.toISOString()}]`,
      );

      return Promise.reject(error);
    },
  );
};
