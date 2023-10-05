//! Was added to support NodeJS 10.
if (!Promise.allSettled) {
  Promise.allSettled = function (promises) {
    return Promise.all(
      promises.map((p) =>
        Promise.resolve(p).then(
          (value) => ({
            status: 'fulfilled',
            value,
          }),
          (error) => ({
            status: 'rejected',
            reason: error,
          }),
        ),
      ),
    );
  };
}
