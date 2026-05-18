const { jsonResponse, withCors } = require("./_shared/http");

exports.handler = async function () {
  return withCors(jsonResponse(200, {
    success: true,
    app: "Resident Ready",
    service: "resident-backend",
    checkedAt: new Date().toISOString()
  }));
};