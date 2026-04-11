const DEFAULT_GA_MEASUREMENT_ID = "G-LK9C1Z4W11";

exports.handler = async () => {
  const measurementId = (process.env.GA_MEASUREMENT_ID || DEFAULT_GA_MEASUREMENT_ID).trim();
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": measurementId ? "public, max-age=300" : "no-store",
    },
    body: JSON.stringify({ measurementId }),
  };
};
