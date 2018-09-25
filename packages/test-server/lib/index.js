"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _getPort = _interopRequireDefault(require("get-port"));

var _restify = _interopRequireDefault(require("restify"));

function _default(_x) {
  return _ref2.apply(this, arguments);
}

function _ref2() {
  _ref2 = (0, _asyncToGenerator2.default)(
  /*#__PURE__*/
  _regenerator.default.mark(function _callee(_ref) {
    var playbacks, port, server;
    return _regenerator.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            playbacks = _ref.playbacks;
            _context.next = 3;
            return (0, _getPort.default)({
              port: 5000
            });

          case 3:
            port = _context.sent;
            server = _restify.default.createServer();
            playbacks.forEach(function (_ref3) {
              var _ref3$req = _ref3.req,
                  preq = _ref3$req === void 0 ? {} : _ref3$req,
                  _ref3$res = _ref3.res,
                  pres = _ref3$res === void 0 ? {} : _ref3$res;
              var played = false;
              server.pre(function (req, res, next) {
                if (!played && req.method === (preq.method || 'GET') && req.url === (preq.url || '/')) {
                  played = true;
                  res.send(pres.code || 200, pres.body, pres.headers || {});
                } else {
                  return next();
                }
              });
            });
            server.listen(port);
            return _context.abrupt("return", {
              dispose: function dispose() {
                server.close();
              },
              port: port
            });

          case 8:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this);
  }));
  return _ref2.apply(this, arguments);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9pbmRleC5qcyJdLCJuYW1lcyI6WyJwbGF5YmFja3MiLCJwb3J0Iiwic2VydmVyIiwicmVzdGlmeSIsImNyZWF0ZVNlcnZlciIsImZvckVhY2giLCJyZXEiLCJwcmVxIiwicmVzIiwicHJlcyIsInBsYXllZCIsInByZSIsIm5leHQiLCJtZXRob2QiLCJ1cmwiLCJzZW5kIiwiY29kZSIsImJvZHkiLCJoZWFkZXJzIiwibGlzdGVuIiwiZGlzcG9zZSIsImNsb3NlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBQUE7O0FBQ0E7Ozs7Ozs7Ozs0QkFFZTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBa0JBLFlBQUFBLFNBQWxCLFFBQWtCQSxTQUFsQjtBQUFBO0FBQUEsbUJBQ00sc0JBQVE7QUFBRUMsY0FBQUEsSUFBSSxFQUFFO0FBQVIsYUFBUixDQUROOztBQUFBO0FBQ1BBLFlBQUFBLElBRE87QUFFUEMsWUFBQUEsTUFGTyxHQUVFQyxpQkFBUUMsWUFBUixFQUZGO0FBSWJKLFlBQUFBLFNBQVMsQ0FBQ0ssT0FBVixDQUFrQixpQkFBd0M7QUFBQSxvQ0FBckNDLEdBQXFDO0FBQUEsa0JBQWhDQyxJQUFnQywwQkFBekIsRUFBeUI7QUFBQSxvQ0FBckJDLEdBQXFCO0FBQUEsa0JBQWhCQyxJQUFnQiwwQkFBVCxFQUFTO0FBQ3hELGtCQUFJQyxNQUFNLEdBQUcsS0FBYjtBQUVBUixjQUFBQSxNQUFNLENBQUNTLEdBQVAsQ0FBVyxVQUFDTCxHQUFELEVBQU1FLEdBQU4sRUFBV0ksSUFBWCxFQUFvQjtBQUM3QixvQkFDRSxDQUFDRixNQUFELElBQ0dKLEdBQUcsQ0FBQ08sTUFBSixNQUFnQk4sSUFBSSxDQUFDTSxNQUFMLElBQWUsS0FBL0IsQ0FESCxJQUVHUCxHQUFHLENBQUNRLEdBQUosTUFBYVAsSUFBSSxDQUFDTyxHQUFMLElBQVksR0FBekIsQ0FITCxFQUlFO0FBQ0FKLGtCQUFBQSxNQUFNLEdBQUcsSUFBVDtBQUNBRixrQkFBQUEsR0FBRyxDQUFDTyxJQUFKLENBQVNOLElBQUksQ0FBQ08sSUFBTCxJQUFhLEdBQXRCLEVBQTJCUCxJQUFJLENBQUNRLElBQWhDLEVBQXNDUixJQUFJLENBQUNTLE9BQUwsSUFBZ0IsRUFBdEQ7QUFDRCxpQkFQRCxNQU9PO0FBQ0wseUJBQU9OLElBQUksRUFBWDtBQUNEO0FBQ0YsZUFYRDtBQVlELGFBZkQ7QUFpQkFWLFlBQUFBLE1BQU0sQ0FBQ2lCLE1BQVAsQ0FBY2xCLElBQWQ7QUFyQmEsNkNBdUJOO0FBQ0xtQixjQUFBQSxPQUFPLEVBQUUsbUJBQU07QUFDYmxCLGdCQUFBQSxNQUFNLENBQUNtQixLQUFQO0FBQ0QsZUFISTtBQUlMcEIsY0FBQUEsSUFBSSxFQUFKQTtBQUpLLGFBdkJNOztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEciLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZ2V0UG9ydCBmcm9tICdnZXQtcG9ydCc7XHJcbmltcG9ydCByZXN0aWZ5IGZyb20gJ3Jlc3RpZnknO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gKHsgcGxheWJhY2tzIH0pIHtcclxuICBjb25zdCBwb3J0ID0gYXdhaXQgZ2V0UG9ydCh7IHBvcnQ6IDUwMDAgfSk7XHJcbiAgY29uc3Qgc2VydmVyID0gcmVzdGlmeS5jcmVhdGVTZXJ2ZXIoKTtcclxuXHJcbiAgcGxheWJhY2tzLmZvckVhY2goKHsgcmVxOiBwcmVxID0ge30sIHJlczogcHJlcyA9IHt9IH0pID0+IHtcclxuICAgIGxldCBwbGF5ZWQgPSBmYWxzZTtcclxuXHJcbiAgICBzZXJ2ZXIucHJlKChyZXEsIHJlcywgbmV4dCkgPT4ge1xyXG4gICAgICBpZiAoXHJcbiAgICAgICAgIXBsYXllZFxyXG4gICAgICAgICYmIHJlcS5tZXRob2QgPT09IChwcmVxLm1ldGhvZCB8fCAnR0VUJylcclxuICAgICAgICAmJiByZXEudXJsID09PSAocHJlcS51cmwgfHwgJy8nKVxyXG4gICAgICApIHtcclxuICAgICAgICBwbGF5ZWQgPSB0cnVlO1xyXG4gICAgICAgIHJlcy5zZW5kKHByZXMuY29kZSB8fCAyMDAsIHByZXMuYm9keSwgcHJlcy5oZWFkZXJzIHx8IHt9KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gbmV4dCgpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc2VydmVyLmxpc3Rlbihwb3J0KTtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIGRpc3Bvc2U6ICgpID0+IHtcclxuICAgICAgc2VydmVyLmNsb3NlKCk7XHJcbiAgICB9LFxyXG4gICAgcG9ydFxyXG4gIH07XHJcbn1cclxuIl19