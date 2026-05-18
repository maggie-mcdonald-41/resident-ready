function jsonResponse(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify(data)
  };
}

function methodNotAllowed() {
  return jsonResponse(405, {
    success: false,
    error: "Method not allowed"
  });
}

function handleOptions() {
  return {
    statusCode: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    },
    body: ""
  };
}

function withCors(response) {
  return {
    ...response,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      ...(response.headers || {})
    }
  };
}

function readJsonBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (error) {
    return null;
  }
}

module.exports = {
  jsonResponse,
  methodNotAllowed,
  handleOptions,
  withCors,
  readJsonBody
};