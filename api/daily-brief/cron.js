const handler = require("./.generated/index.js").default;
module.exports = (request, response) => {
  request.url = "/api/daily-brief?operation=generate";
  return handler(request, response);
};
